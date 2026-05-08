import { Types } from 'mongoose';
import { Message, IAttachment, IEncryption, MessageType } from '../models/Message';
import { Chat } from '../models/Chat';
import { ApiError } from '../utils/ApiError';
import { cloudinary } from '../config/cloudinary';
import { logger } from '../utils/logger';

const POPULATE_SENDER = { path: 'sender', select: 'name email avatar' };

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
  return { items: items.reverse(), total, page, limit };
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

/** @deprecated kept for backwards compat — equivalent to delete-for-everyone. */
export const deleteMessageService = deleteForEveryoneService;
