import { IMessage } from '../models/Message';
import { Chat } from '../models/Chat';
import { getIO } from './index';
import { createNotificationService } from '../services/notification.service';
import { logger } from '../utils/logger';

interface PopulatedSender {
  _id: { toString(): string };
  name?: string;
  avatar?: string;
}

export const broadcastNewMessage = async (message: IMessage): Promise<void> => {
  try {
    const io = getIO();
    const chat = await Chat.findById(message.chat).select('members isGroup name');
    if (!chat) return;

    const senderId = (message.sender as unknown as PopulatedSender)._id.toString();
    const senderName = (message.sender as unknown as PopulatedSender).name ?? 'New message';

    io.to(`chat:${message.chat.toString()}`).emit('message:new', message);

    for (const memberId of chat.members) {
      const memberStr = memberId.toString();
      if (memberStr === senderId) continue;
      io.to(`user:${memberStr}`).emit('message:new', message);
      io.to(`user:${memberStr}`).emit('notification:new', {
        chatId: message.chat.toString(),
        messageId: message._id.toString(),
        title: chat.isGroup ? `${senderName} • ${chat.name ?? 'Group'}` : senderName,
        body:
          message.type === 'text'
            ? message.content.slice(0, 140)
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
              ? message.content.slice(0, 140)
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
    io.to(`chat:${message.chat.toString()}`).emit('message:delete', payload);
    for (const memberId of chat.members) {
      io.to(`user:${memberId.toString()}`).emit('message:delete', payload);
    }
  } catch (err) {
    logger.error('broadcastMessageDeleted error', err);
  }
};
