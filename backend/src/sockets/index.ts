import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { setUserStatusService } from '../services/user.service';
import { registerChatHandlers } from './chat.handlers';

export interface AuthedSocket extends Socket {
  data: {
    userId: string;
    email: string;
  };
}

let io: Server | null = null;

export const initSocket = (httpServer: HttpServer): Server => {
  const allowedOrigins = [env.CLIENT_URL];
  if (env.EXTENSION_ORIGIN) allowedOrigins.push(env.EXTENSION_ORIGIN);

  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://')) {
          return cb(null, true);
        }
        return cb(new Error('Origin not allowed'), false);
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60_000,
    pingInterval: 25_000,
  });

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.toString().replace(/^Bearer\s+/i, '') ?? '');
      if (!token) return next(new Error('Missing auth token'));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      socket.data.email = payload.email;
      next();
    } catch {
      next(new Error('Invalid auth token'));
    }
  });

  io.on('connection', async (socket) => {
    const authed = socket as AuthedSocket;
    const { userId } = authed.data;

    socket.join(`user:${userId}`);
    await setUserStatusService(userId, 'online');
    socket.broadcast.emit('presence:update', { userId, status: 'online' });
    logger.info(`Socket connected user=${userId} sid=${socket.id}`);

    registerChatHandlers(authed);

    socket.on('disconnect', async () => {
      await setUserStatusService(userId, 'offline');
      socket.broadcast.emit('presence:update', {
        userId,
        status: 'offline',
        lastSeen: new Date().toISOString(),
      });
      logger.info(`Socket disconnected user=${userId} sid=${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};
