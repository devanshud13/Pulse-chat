'use client';

import { useEffect, useRef } from 'react';
import { getSocket, reconnectWithFreshToken } from '@/services/socket';
import { useChatStore } from '@/store/chat.store';
import { useAuthStore } from '@/store/auth.store';
import { playNotificationSound } from '@/lib/sound';
import type { Message } from '@/types';

interface NotificationPayload {
  chatId: string;
  messageId: string;
  title: string;
  body: string;
}

/**
 * Single source of truth for socket subscriptions. Only depends on the
 * authenticated user id — listeners read all other live state from the
 * stores via `getState()` so the effect never needs to re-run when chats
 * or selection change. This removes any chance of re-render storms or
 * WebSocket reconnect thrash that produces React #185.
 */
export const useSocketEvents = (
  onNotification?: (n: NotificationPayload) => void,
): void => {
  const userId = useAuthStore((s) => s.user?._id ?? null);

  const notifRef = useRef(onNotification);
  useEffect(() => {
    notifRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    if (!userId) return;
    const socket = getSocket();
    reconnectWithFreshToken();

    const onMessage = (msg: Message): void => {
      const me = useAuthStore.getState().user?._id;
      const selectedChatId = useChatStore.getState().selectedChatId;
      const senderId = typeof msg.sender === 'string' ? msg.sender : msg.sender._id;

      /* If this is our own message coming back via socket and we still have an
         optimistic placeholder for it, swap that placeholder out instead of
         appending — otherwise the chat shows the same message twice. */
      if (me && senderId === me) {
        const list = useChatStore.getState().messagesByChat[msg.chat] ?? [];
        if (list.some((m) => m._id === msg._id)) return;
        const pending = [...list].reverse().find((m) => m.pending);
        if (pending) {
          useChatStore.getState().replaceMessage(msg.chat, pending._id, msg);
          return;
        }
      }

      useChatStore.getState().appendMessage(msg.chat, msg);
      if (me && senderId !== me && msg.chat !== selectedChatId) {
        useChatStore.getState().bumpUnread(msg.chat);
      }

      /* Audible alert for incoming messages from someone else when the user
         either isn't looking at this browser tab, or is reading a different
         chat. We deliberately key off the same conditions used for toasts so
         a single source-of-truth governs "did the user see this yet?".
         Call event rows ('Audio call · 12m', etc.) skip the chime since the
         call UI already produced its own ringtone/state changes. */
      if (me && senderId !== me && msg.type !== 'call') {
        const tabHidden =
          typeof document !== 'undefined' &&
          (document.visibilityState !== 'visible' || !document.hasFocus());
        const otherChat = msg.chat !== selectedChatId;
        if (tabHidden || otherChat) {
          playNotificationSound();
        }
      }
    };
    const onTypingStart = (p: { chatId: string; userId: string }): void => {
      const me = useAuthStore.getState().user?._id;
      if (p.userId !== me) useChatStore.getState().setTyping(p.chatId, p.userId, true);
    };
    const onTypingStop = (p: { chatId: string; userId: string }): void => {
      useChatStore.getState().setTyping(p.chatId, p.userId, false);
    };
    const onPresence = (p: {
      userId: string;
      status: 'online' | 'offline';
      lastSeen?: string;
    }): void => {
      useChatStore.getState().setPresence(p.userId, p.status, p.lastSeen);
    };
    const onRead = (p: { chatId: string; userId: string }): void => {
      useChatStore.getState().markChatRead(p.chatId, p.userId);
    };
    const onDelete = (p: { _id: string; chat: string }): void => {
      useChatStore.getState().markMessageDeleted(p.chat, p._id);
    };
    const onEdit = (msg: Message): void => {
      const me = useAuthStore.getState().user?._id;
      const senderId = typeof msg.sender === 'string' ? msg.sender : msg.sender._id;
      /* The sender already updated locally via the PATCH response; no need to
         clobber their cached `plaintext` with the encrypted ciphertext. */
      if (senderId === me) {
        useChatStore.getState().updateMessage(msg.chat, msg._id, {
          edited: true,
          updatedAt: msg.updatedAt,
        });
        return;
      }
      /* Receivers need to drop the cached plaintext so `useDecryptedMessages`
         picks the new ciphertext up on the next pass. */
      useChatStore.getState().updateMessage(msg.chat, msg._id, {
        ...msg,
        plaintext: undefined,
      });
    };
    const onNotify = (p: NotificationPayload): void => {
      notifRef.current?.(p);
    };

    socket.on('message:new', onMessage);
    socket.on('message:delete', onDelete);
    socket.on('message:edit', onEdit);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('presence:update', onPresence);
    socket.on('message:read', onRead);
    socket.on('notification:new', onNotify);

    return () => {
      socket.off('message:new', onMessage);
      socket.off('message:delete', onDelete);
      socket.off('message:edit', onEdit);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('presence:update', onPresence);
      socket.off('message:read', onRead);
      socket.off('notification:new', onNotify);
    };
  }, [userId]);
};
