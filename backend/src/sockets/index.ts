import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { setUserStatusService } from '../services/user.service';
import { registerChatHandlers } from './chat.handlers';
import { registerCallHandlers } from './call.handlers';
import { setSocketServer, getSocketServer } from './ioRegistry';
import { forceEndCallsForUser } from '../services/callSession.service';

export interface AuthedSocket extends Socket {
  data: {
    userId: string;
    email: string;
  };
}

const buildAllowedOrigins = (): string[] => {
  const list = [env.CLIENT_URL];
  if (env.EXTENSION_ORIGIN) list.push(env.EXTENSION_ORIGIN);
  if (env.SOCKET_CORS_ORIGIN) {
    for (const raw of env.SOCKET_CORS_ORIGIN.split(',')) {
      const o = raw.trim();
      if (o) list.push(o);
    }
  }
  return list;
};

export const initSocket = (httpServer: HttpServer): Server => {
  const allowedOrigins = buildAllowedOrigins();

  const io = new Server(httpServer, {
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

  setSocketServer(io);

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
    registerCallHandlers(authed);

    socket.on('disconnect', async () => {
      const ended = forceEndCallsForUser(userId);
      if (ended) {
        const ioServer = getSocketServer();
        const payload = { callId: ended.callId, by: userId, reason: 'peer-left' as const };
        ioServer.to(`user:${ended.callerId}`).emit('call:ended', payload);
        ioServer.to(`user:${ended.calleeId}`).emit('call:ended', payload);
      }
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

export const getIO = (): Server => getSocketServer();
