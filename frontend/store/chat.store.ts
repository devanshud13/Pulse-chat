import { create } from 'zustand';
import type { Chat, Message, User } from '@/types';

interface ChatState {
  chats: Chat[];
  unread: Record<string, number>;
  selectedChatId: string | null;
  messagesByChat: Record<string, Message[]>;
  typingByChat: Record<string, string[]>;
  presence: Record<string, { status: 'online' | 'offline'; lastSeen?: string }>;

  setChats: (chats: Chat[]) => void;
  upsertChat: (chat: Chat) => void;
  setUnread: (unread: Record<string, number>) => void;
  bumpUnread: (chatId: string) => void;
  clearUnread: (chatId: string) => void;

  selectChat: (chatId: string | null) => void;

  setMessages: (chatId: string, messages: Message[]) => void;
  prependMessages: (chatId: string, messages: Message[]) => void;
  appendMessage: (chatId: string, message: Message) => void;
  removeMessage: (chatId: string, messageId: string) => void;
  markChatRead: (chatId: string, userId: string) => void;

  setTyping: (chatId: string, userId: string, typing: boolean) => void;

  setPresence: (userId: string, status: 'online' | 'offline', lastSeen?: string) => void;
  applyPresenceFromMembers: (members: User[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  unread: {},
  selectedChatId: null,
  messagesByChat: {},
  typingByChat: {},
  presence: {},

  setChats: (chats) =>
    set((state) => {
      let presenceChanged = false;
      const presence = { ...state.presence };
      for (const c of chats) {
        for (const m of c.members) {
          const cur = presence[m._id];
          if (!cur || cur.status !== m.status || cur.lastSeen !== m.lastSeen) {
            presence[m._id] = { status: m.status, lastSeen: m.lastSeen };
            presenceChanged = true;
          }
        }
      }
      return presenceChanged ? { chats, presence } : { chats };
    }),

  upsertChat: (chat) =>
    set((state) => {
      const exists = state.chats.find((c) => c._id === chat._id);
      const next = exists
        ? state.chats.map((c) => (c._id === chat._id ? chat : c))
        : [chat, ...state.chats];
      return { chats: next };
    }),

  setUnread: (unread) => set({ unread }),
  bumpUnread: (chatId) =>
    set((state) => ({ unread: { ...state.unread, [chatId]: (state.unread[chatId] ?? 0) + 1 } })),
  clearUnread: (chatId) =>
    set((state) => {
      if (!(chatId in state.unread)) return {};
      const next = { ...state.unread };
      delete next[chatId];
      return { unread: next };
    }),

  selectChat: (chatId) => set({ selectedChatId: chatId }),

  setMessages: (chatId, messages) =>
    set((state) => ({ messagesByChat: { ...state.messagesByChat, [chatId]: messages } })),
  prependMessages: (chatId, messages) =>
    set((state) => ({
      messagesByChat: {
        ...state.messagesByChat,
        [chatId]: [...messages, ...(state.messagesByChat[chatId] ?? [])],
      },
    })),
  appendMessage: (chatId, message) =>
    set((state) => {
      const existing = state.messagesByChat[chatId] ?? [];
      if (existing.some((m) => m._id === message._id)) return {};
      const chats = state.chats.map((c) =>
        c._id === chatId ? { ...c, lastMessage: message, updatedAt: message.createdAt } : c,
      );
      return {
        messagesByChat: { ...state.messagesByChat, [chatId]: [...existing, message] },
        chats,
      };
    }),
  removeMessage: (chatId, messageId) =>
    set((state) => ({
      messagesByChat: {
        ...state.messagesByChat,
        [chatId]: (state.messagesByChat[chatId] ?? []).filter((m) => m._id !== messageId),
      },
    })),
  markChatRead: (chatId, userId) =>
    set((state) => {
      const list = state.messagesByChat[chatId];
      if (!list) return {};
      return {
        messagesByChat: {
          ...state.messagesByChat,
          [chatId]: list.map((m) =>
            m.readBy.includes(userId) ? m : { ...m, readBy: [...m.readBy, userId] },
          ),
        },
      };
    }),

  setTyping: (chatId, userId, typing) =>
    set((state) => {
      const current = new Set(state.typingByChat[chatId] ?? []);
      if (typing) current.add(userId);
      else current.delete(userId);
      return { typingByChat: { ...state.typingByChat, [chatId]: [...current] } };
    }),

  setPresence: (userId, status, lastSeen) =>
    set((state) => {
      const cur = state.presence[userId];
      if (cur && cur.status === status && cur.lastSeen === lastSeen) return {};
      return { presence: { ...state.presence, [userId]: { status, lastSeen } } };
    }),

  applyPresenceFromMembers: (members) =>
    set((state) => {
      let changed = false;
      const next = { ...state.presence };
      for (const m of members) {
        const cur = next[m._id];
        if (!cur || cur.status !== m.status || cur.lastSeen !== m.lastSeen) {
          next[m._id] = { status: m.status, lastSeen: m.lastSeen };
          changed = true;
        }
      }
      if (!changed) return {};
      return { presence: next };
    }),
}));
