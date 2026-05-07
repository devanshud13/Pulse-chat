import { io, Socket } from 'socket.io-client';
import { tokenStorage } from './api';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:5000';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (socket && socket.connected) return socket;
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    auth: { token: tokenStorage.getAccess() ?? '' },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
};

export const reconnectWithFreshToken = (): void => {
  if (!socket) return;
  socket.auth = { token: tokenStorage.getAccess() ?? '' };
  socket.disconnect().connect();
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};
