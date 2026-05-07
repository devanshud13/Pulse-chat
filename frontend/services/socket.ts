import { io, Socket } from 'socket.io-client';
import { tokenStorage } from './api';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:5000';

interface AuthedSocket extends Socket {
  auth: { token: string };
}

let socket: AuthedSocket | null = null;

const buildSocket = (token: string): AuthedSocket => {
  return io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20_000,
  }) as AuthedSocket;
};

export const getSocket = (): Socket => {
  if (socket) return socket;
  const token = tokenStorage.getAccess() ?? '';
  socket = buildSocket(token);
  return socket;
};

/**
 * Re-attach a fresh JWT to the singleton socket. Only forces a reconnect
 * when the token has actually changed — avoids the WebSocket handshake
 * thrash that happens when the chat page rapidly re-renders.
 */
export const reconnectWithFreshToken = (): void => {
  const token = tokenStorage.getAccess() ?? '';
  if (!socket) {
    socket = buildSocket(token);
    return;
  }
  const current = socket.auth?.token ?? '';
  if (current === token && socket.connected) return;
  socket.auth = { token };
  if (!socket.connected) {
    socket.connect();
    return;
  }
  socket.disconnect().connect();
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};
