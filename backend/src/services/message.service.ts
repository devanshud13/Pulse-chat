import { Types } from 'mongoose';
import { Message, IAttachment, IEncryption, IMessage, MessageType } from '../models/Message';
import { Chat } from '../models/Chat';
import { ApiError } from '../utils/ApiError';
import { cloudinary } from '../config/cloudinary';
import { logger } from '../utils/logger';

const POPULATE_SENDER = { path: 'sender', select: 'name email avatar' };

/**
 * Strips the encryption envelope so that `userId` only sees their *own* RSA-
 * wrapped AES key. Other recipients' wrapped keys are removed from the wire,
 * so a malicious client (or a leaked DB row served to one client) can never
 * reveal even the encrypted form of another user's session key.
 *
 * Each user's wrapped key is still encrypted with their public key so it was
 * never readable by anyone else cryptographically — but stripping it removes
 * the metadata leak entirely. Net effect: the JSON each client receives now
 * looks exactly like a 1:1 message even in groups.
 */
export const filterEncryptionForRecipient = <T extends Record<string, unknown>>(
  message: T & { encryption?: IEncryption | null },
  userId: string,
): T => {
  const enc = message.encryption;
  if (!enc?.enabled) return message;
  const myKey = enc.keys?.find((k) => k.user.toString() === userId);
  return {
    ...message,
    encryption: {
      enabled: true,
      iv: enc.iv,
      keys: myKey ? [myKey] : [],
    },
  } as T;
};

/** Convert a Mongoose message doc to a plain object suitable for transport. */
export const messageToJson = (m: IMessage): Record<string, unknown> => {
  const obj = m.toObject({ versionKey: false }) as Record<string, unknown>;
  return obj;
};

interface CreateMessageInput {
  chatId: string;
  senderId: string;
  content?: string;
  type?: MessageType;
  attachment?: IAttachment;
  encryption?: IEncryption;
}

export const createMessageService = async (input: CreateMessageInput) => {
  const chat = await Chat.findById(input.chatId);
  if (!chat) throw ApiError.notFound('Chat not found');
  if (!chat.members.some((m) => m.toString() === input.senderId)) {
    throw ApiError.forbidden('You are not a member of this chat');
  }
  if (!input.content?.trim() && !input.attachment) {
    throw ApiError.badRequest('Message must have content or attachment');
  }

  const message = await Message.create({
    chat: new Types.ObjectId(input.chatId),
    sender: new Types.ObjectId(input.senderId),
    type: input.type ?? (input.attachment ? (input.attachment.mime.startsWith('image/') ? 'image' : 'file') : 'text'),
    content: input.content ?? '',
    attachment: input.attachment,
    readBy: [new Types.ObjectId(input.senderId)],
    deliveredTo: [new Types.ObjectId(input.senderId)],
    encryption: input.encryption ?? { enabled: false, keys: [] },
  });

  chat.lastMessage = message._id;
  chat.updatedAt = new Date();
  await chat.save();

  return message.populate(POPULATE_SENDER);
};

export const listMessagesService = async (
  chatId: string,
  userId: string,
  page: number,
  limit: number,
) => {
  const chat = await Chat.findById(chatId);
  if (!chat) throw ApiError.notFound('Chat not found');
  if (!chat.members.some((m) => m.toString() === userId)) {
    throw ApiError.forbidden('You are not a member of this chat');
  }
  const skip = (page - 1) * limit;
  /* Hide messages the caller hid for themselves (delete-for-me).
     Tombstoned (deleted-for-everyone) messages stay visible as a placeholder. */
  const filter = { chat: chatId, deletedFor: { $ne: new Types.ObjectId(userId) } };
  const [items, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(POPULATE_SENDER),
    Message.countDocuments(filter),
  ]);
  /* Each recipient only sees their own wrapped AES key — never anyone else's. */
  const sanitized = items
    .reverse()
    .map((m) => filterEncryptionForRecipient(messageToJson(m), userId));
  return { items: sanitized, total, page, limit };
};

export const markChatReadService = async (chatId: string, userId: string): Promise<number> => {
  const result = await Message.updateMany(
    { chat: chatId, readBy: { $ne: userId } },
    { $addToSet: { readBy: new Types.ObjectId(userId) } },
  );
  return result.modifiedCount ?? 0;
};

export const unreadCountsByChat = async (userId: string): Promise<Record<string, number>> => {
  const chats = await Chat.find({ members: userId }).select('_id');
  const chatIds = chats.map((c) => c._id);
  const agg = await Message.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        chat: { $in: chatIds },
        readBy: { $ne: new Types.ObjectId(userId) },
        sender: { $ne: new Types.ObjectId(userId) },
        deleted: false,
        deletedFor: { $ne: new Types.ObjectId(userId) },
      },
    },
    { $group: { _id: '$chat', count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(agg.map((a) => [a._id.toString(), a.count]));
};

export const totalUnreadService = async (userId: string): Promise<number> => {
  return Message.countDocuments({
    readBy: { $ne: userId },
    sender: { $ne: userId },
    deleted: false,
    deletedFor: { $ne: new Types.ObjectId(userId) },
    chat: { $in: (await Chat.find({ members: userId }).select('_id')).map((c) => c._id) },
  });
};

/** Hides the message for `userId` only — counterpart still sees it. */
export const deleteForMeService = async (messageId: string, userId: string) => {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound('Message not found');
  const chat = await Chat.findById(message.chat).select('members');
  if (!chat || !chat.members.some((m) => m.toString() === userId)) {
    throw ApiError.forbidden('You are not a member of this chat');
  }
  if (!message.deletedFor.some((id) => id.toString() === userId)) {
    message.deletedFor.push(new Types.ObjectId(userId));
    await message.save();
  }
  return message.populate(POPULATE_SENDER);
};

/** Tombstones the message for everyone in the chat AND removes any Cloudinary asset
 *  to free remote storage. Only the original sender is allowed. */
export const deleteForEveryoneService = async (messageId: string, userId: string) => {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound('Message not found');
  if (message.sender.toString() !== userId) {
    throw ApiError.forbidden('Only the sender can delete a message for everyone');
  }

  if (message.attachment?.publicId) {
    try {
      const isImage = message.attachment.mime.startsWith('image/');
      await cloudinary.uploader.destroy(message.attachment.publicId, {
        resource_type: isImage ? 'image' : 'raw',
        invalidate: true,
      });
    } catch (err) {
      logger.error('cloudinary destroy failed', err);
    }
  }

  message.deleted = true;
  message.content = '';
  message.attachment = undefined;
  message.encryption = { enabled: false, keys: [] };
  await message.save();
  return message.populate(POPULATE_SENDER);
};

/** Edit a text message. Only the original sender, only non-deleted messages,
 *  and only within a 15-minute window (matches WhatsApp UX). */
const EDIT_WINDOW_MS = 15 * 60 * 1000;
export const editMessageService = async (
  messageId: string,
  userId: string,
  patch: { content: string; encryption?: IEncryption },
) => {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound('Message not found');
  if (message.deleted) throw ApiError.badRequest('Cannot edit a deleted message');
  if (message.sender.toString() !== userId) {
    throw ApiError.forbidden('You can only edit your own messages');
  }
  if (message.type !== 'text') throw ApiError.badRequest('Only text messages can be edited');
  const ageMs = Date.now() - message.createdAt.getTime();
  if (ageMs > EDIT_WINDOW_MS) {
    throw ApiError.badRequest('Edit window has expired');
  }

  message.content = patch.content;
  if (patch.encryption) {
    message.encryption = patch.encryption;
  }
  message.edited = true;
  message.editedAt = new Date();
  await message.save();
  return message.populate(POPULATE_SENDER);
};

/** Clears all messages for `userId` only — counterpart's view is untouched.
 *  When `withMedia` is true, also destroys any Cloudinary assets the user
 *  *uploaded themselves* in this chat (frees their cloud storage without
 *  affecting the other party's copies of those files). */
export const clearChatForUserService = async (
  chatId: string,
  userId: string,
  withMedia: boolean,
): Promise<{ cleared: number; mediaDeleted: number }> => {
  const chat = await Chat.findById(chatId).select('members');
  if (!chat) throw ApiError.notFound('Chat not found');
  if (!chat.members.some((m) => m.toString() === userId)) {
    throw ApiError.forbidden('You are not a member of this chat');
  }

  let mediaDeleted = 0;
  if (withMedia) {
    const ownAttachments = await Message.find({
      chat: chatId,
      sender: userId,
      'attachment.publicId': { $exists: true, $ne: null },
      deletedFor: { $ne: new Types.ObjectId(userId) },
    }).select('attachment');
    for (const m of ownAttachments) {
      if (!m.attachment?.publicId) continue;
      try {
        const isImage = m.attachment.mime.startsWith('image/');
        await cloudinary.uploader.destroy(m.attachment.publicId, {
          resource_type: isImage ? 'image' : 'raw',
          invalidate: true,
        });
        mediaDeleted++;
      } catch (err) {
        logger.error('cloudinary destroy failed during clearChat', err);
      }
    }
  }

  const result = await Message.updateMany(
    { chat: chatId, deletedFor: { $ne: new Types.ObjectId(userId) } },
    { $addToSet: { deletedFor: new Types.ObjectId(userId) } },
  );

  return { cleared: result.modifiedCount ?? 0, mediaDeleted };
};

/** @deprecated kept for backwards compat — equivalent to delete-for-everyone. */
export const deleteMessageService = deleteForEveryoneService;
