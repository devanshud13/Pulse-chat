import { IMessage } from '../models/Message';
import { Chat } from '../models/Chat';
import { getIO } from './index';
import { createNotificationService } from '../services/notification.service';
import {
  filterEncryptionForRecipient,
  messageToJson,
} from '../services/message.service';
import { logger } from '../utils/logger';

interface PopulatedSender {
  _id: { toString(): string };
  name?: string;
  avatar?: string;
}

/**
 * Per-recipient broadcast — each user only ever sees their own wrapped AES key,
 * never anyone else's. We deliberately don't emit to `chat:<id>` rooms because
 * a single broadcast there would leak the full encryption envelope to every
 * tab joined to that chat.
 */
export const broadcastNewMessage = async (message: IMessage): Promise<void> => {
  try {
    const io = getIO();
    const chat = await Chat.findById(message.chat).select('members isGroup name');
    if (!chat) return;

    const senderId = (message.sender as unknown as PopulatedSender)._id.toString();
    const senderName = (message.sender as unknown as PopulatedSender).name ?? 'New message';
    const baseJson = messageToJson(message);

    for (const memberId of chat.members) {
      const memberStr = memberId.toString();
      const sanitized = filterEncryptionForRecipient(baseJson, memberStr);
      io.to(`user:${memberStr}`).emit('message:new', sanitized);
      if (memberStr === senderId) continue;
      io.to(`user:${memberStr}`).emit('notification:new', {
        chatId: message.chat.toString(),
        messageId: message._id.toString(),
        title: chat.isGroup ? `${senderName} • ${chat.name ?? 'Group'}` : senderName,
        body:
          message.type === 'text'
            ? /* The body is encrypted ciphertext when E2E is on, so we send
                 a generic placeholder instead. The client can decrypt the
                 actual message and rewrite the toast/native banner. */
              message.encryption?.enabled
              ? '🔒 New message'
              : message.content.slice(0, 140)
            : message.type === 'image'
              ? 'Sent an image'
              : `Sent a file: ${message.attachment?.name ?? ''}`,
      });

      try {
        await createNotificationService({
          userId: memberStr,
          type: 'message',
          title: chat.isGroup ? `${senderName} • ${chat.name ?? 'Group'}` : senderName,
          body:
            message.type === 'text'
              ? message.encryption?.enabled
                ? '🔒 New message'
                : message.content.slice(0, 140)
              : message.type === 'image'
                ? 'Sent an image'
                : `Sent a file: ${message.attachment?.name ?? ''}`,
          chatId: message.chat.toString(),
          messageId: message._id.toString(),
        });
      } catch (err) {
        logger.error('createNotification error', err);
      }
    }
  } catch (err) {
    logger.error('broadcastNewMessage error', err);
  }
};

export const broadcastReadReceipt = (chatId: string, readerId: string): void => {
  try {
    const io = getIO();
    io.to(`chat:${chatId}`).emit('message:read', { chatId, userId: readerId });
  } catch (err) {
    logger.error('broadcastReadReceipt error', err);
  }
};

export const broadcastMessageDeleted = async (message: IMessage): Promise<void> => {
  try {
    const io = getIO();
    const chat = await Chat.findById(message.chat).select('members');
    if (!chat) return;
    const payload = {
      _id: message._id.toString(),
      chat: message.chat.toString(),
      deleted: true,
    };
    for (const memberId of chat.members) {
      io.to(`user:${memberId.toString()}`).emit('message:delete', payload);
    }
  } catch (err) {
    logger.error('broadcastMessageDeleted error', err);
  }
};

export const broadcastMessageEdited = async (message: IMessage): Promise<void> => {
  try {
    const io = getIO();
    const chat = await Chat.findById(message.chat).select('members');
    if (!chat) return;
    const baseJson = messageToJson(message);
    for (const memberId of chat.members) {
      const memberStr = memberId.toString();
      const sanitized = filterEncryptionForRecipient(baseJson, memberStr);
      io.to(`user:${memberStr}`).emit('message:edit', sanitized);
    }
  } catch (err) {
    logger.error('broadcastMessageEdited error', err);
  }
};
