'use client';

import { useEffect } from 'react';
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

export const useSocketEvents = (onNotification?: (n: NotificationPayload) => void): void => {
  const user = useAuthStore((s) => s.user);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const bumpUnread = useChatStore((s) => s.bumpUnread);
  const setTyping = useChatStore((s) => s.setTyping);
  const setPresence = useChatStore((s) => s.setPresence);
  const markChatRead = useChatStore((s) => s.markChatRead);
  const selectedChatId = useChatStore((s) => s.selectedChatId);

  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    reconnectWithFreshToken();

    const onConnect = (): void => {
      /* No-op: presence is tracked server-side. */
    };

    const onMessage = (msg: Message): void => {
      appendMessage(msg.chat, msg);
      const senderId = typeof msg.sender === 'string' ? msg.sender : msg.sender._id;
      if (senderId !== user._id && msg.chat !== selectedChatId) {
        bumpUnread(msg.chat);
      }
    };

    const onTypingStart = (p: { chatId: string; userId: string }): void => {
      if (p.userId !== user._id) setTyping(p.chatId, p.userId, true);
    };
    const onTypingStop = (p: { chatId: string; userId: string }): void => {
      setTyping(p.chatId, p.userId, false);
    };
    const onPresence = (p: { userId: string; status: 'online' | 'offline'; lastSeen?: string }): void => {
      setPresence(p.userId, p.status, p.lastSeen);
    };
    const onRead = (p: { chatId: string; userId: string }): void => {
      markChatRead(p.chatId, p.userId);
    };
    const onNotify = (p: NotificationPayload): void => {
      onNotification?.(p);
    };

    socket.on('connect', onConnect);
    socket.on('message:new', onMessage);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('presence:update', onPresence);
    socket.on('message:read', onRead);
    socket.on('notification:new', onNotify);

    return () => {
      socket.off('connect', onConnect);
      socket.off('message:new', onMessage);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('presence:update', onPresence);
      socket.off('message:read', onRead);
      socket.off('notification:new', onNotify);
    };
  }, [user, selectedChatId, appendMessage, bumpUnread, setTyping, setPresence, markChatRead, onNotification]);
};
