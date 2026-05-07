'use client';

import { useEffect, useRef } from 'react';
import { getSocket, reconnectWithFreshToken } from '@/services/socket';
import { useChatStore } from '@/store/chat.store';
import { useAuthStore } from '@/store/auth.store';
import type { Message } from '@/types';

interface NotificationPayload {
  chatId: string;
  messageId: string;
  title: string;
  body: string;
}

/**
 * Wires the singleton Socket.IO client to the chat store.
 *
 * Critical: this hook MUST NOT disconnect/reconnect on every render or
 * dependency change — that creates a flood of "WebSocket is closed before
 * the connection is established" errors and triggers React #185 (max
 * update depth) by oscillating store state.
 *
 * Strategy:
 *  1. One effect dedicated to connection lifecycle (depends only on user._id).
 *  2. One effect dedicated to attaching listeners (zustand actions are
 *     stable, so this only re-runs when the user changes).
 *  3. Latest `selectedChatId` and `onNotification` are read through refs
 *     inside the listeners — the listeners themselves never need to be
 *     re-bound.
 */
export const useSocketEvents = (
  onNotification?: (n: NotificationPayload) => void,
): void => {
  const user = useAuthStore((s) => s.user);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const bumpUnread = useChatStore((s) => s.bumpUnread);
  const setTyping = useChatStore((s) => s.setTyping);
  const setPresence = useChatStore((s) => s.setPresence);
  const markChatRead = useChatStore((s) => s.markChatRead);

  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?._id ?? null;

  const selectedChatIdRef = useRef<string | null>(null);
  selectedChatIdRef.current = useChatStore((s) => s.selectedChatId);

  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  const userId = user?._id;
  useEffect(() => {
    if (!userId) return;
    getSocket();
    reconnectWithFreshToken();
    /* Intentionally do NOT disconnect on unmount: chat page re-mounts
       frequently during route transitions. The socket service is a
       singleton and is torn down explicitly only on logout. */
  }, [userId]);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    const onMessage = (msg: Message): void => {
      appendMessage(msg.chat, msg);
      const senderId = typeof msg.sender === 'string' ? msg.sender : msg.sender._id;
      const me = userIdRef.current;
      if (me && senderId !== me && msg.chat !== selectedChatIdRef.current) {
        bumpUnread(msg.chat);
      }
    };
    const onTypingStart = (p: { chatId: string; userId: string }): void => {
      if (p.userId !== userIdRef.current) setTyping(p.chatId, p.userId, true);
    };
    const onTypingStop = (p: { chatId: string; userId: string }): void => {
      setTyping(p.chatId, p.userId, false);
    };
    const onPresence = (p: {
      userId: string;
      status: 'online' | 'offline';
      lastSeen?: string;
    }): void => {
      setPresence(p.userId, p.status, p.lastSeen);
    };
    const onRead = (p: { chatId: string; userId: string }): void => {
      markChatRead(p.chatId, p.userId);
    };
    const onNotify = (p: NotificationPayload): void => {
      onNotificationRef.current?.(p);
    };

    socket.on('message:new', onMessage);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('presence:update', onPresence);
    socket.on('message:read', onRead);
    socket.on('notification:new', onNotify);

    return () => {
      socket.off('message:new', onMessage);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('presence:update', onPresence);
      socket.off('message:read', onRead);
      socket.off('notification:new', onNotify);
    };
  }, [user, appendMessage, bumpUnread, setTyping, setPresence, markChatRead]);
};
