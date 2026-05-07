import { AuthedSocket } from './index';
import { Chat } from '../models/Chat';
import { logger } from '../utils/logger';
import { markChatReadService } from '../services/message.service';
import { broadcastReadReceipt } from './emitters';

export const registerChatHandlers = (socket: AuthedSocket): void => {
  const { userId } = socket.data;

  socket.on('chat:join', async (chatId: string) => {
    try {
      const chat = await Chat.findById(chatId).select('members');
      if (!chat) return;
      if (!chat.members.some((m) => m.toString() === userId)) return;
      socket.join(`chat:${chatId}`);
    } catch (err) {
      logger.error('chat:join error', err);
    }
  });

  socket.on('chat:leave', (chatId: string) => {
    socket.leave(`chat:${chatId}`);
  });

  socket.on('typing:start', (chatId: string) => {
    socket.to(`chat:${chatId}`).emit('typing:start', { chatId, userId });
  });

  socket.on('typing:stop', (chatId: string) => {
    socket.to(`chat:${chatId}`).emit('typing:stop', { chatId, userId });
  });

  socket.on('message:read', async (chatId: string) => {
    try {
      await markChatReadService(chatId, userId);
      broadcastReadReceipt(chatId, userId);
    } catch (err) {
      logger.error('message:read error', err);
    }
  });
};
