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
  /** Replaces a temporary (`tempId`) optimistic message with the server copy. */
  replaceMessage: (chatId: string, tempId: string, real: Message) => void;
  /** Updates flags on a pending optimistic message (e.g. mark `failed: true`). */
  updateMessage: (chatId: string, messageId: string, patch: Partial<Message>) => void;
  removeMessage: (chatId: string, messageId: string) => void;
  /** Marks a message tombstoned across all chat panes (used by `message:delete`). */
  markMessageDeleted: (chatId: string, messageId: string) => void;
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
  replaceMessage: (chatId, tempId, real) =>
    set((state) => {
      const list = state.messagesByChat[chatId];
      if (!list) return {};
      const idx = list.findIndex((m) => m._id === tempId);
      if (idx === -1) return {};
      const next = list.slice();
      next[idx] = real;
      const chats = state.chats.map((c) =>
        c._id === chatId ? { ...c, lastMessage: real, updatedAt: real.createdAt } : c,
      );
      return {
        messagesByChat: { ...state.messagesByChat, [chatId]: next },
        chats,
      };
    }),
  updateMessage: (chatId, messageId, patch) =>
    set((state) => {
      const list = state.messagesByChat[chatId];
      if (!list) return {};
      const idx = list.findIndex((m) => m._id === messageId);
      if (idx === -1) return {};
      const next = list.slice();
      next[idx] = { ...next[idx], ...patch };
      return { messagesByChat: { ...state.messagesByChat, [chatId]: next } };
    }),
  removeMessage: (chatId, messageId) =>
    set((state) => ({
      messagesByChat: {
        ...state.messagesByChat,
        [chatId]: (state.messagesByChat[chatId] ?? []).filter((m) => m._id !== messageId),
      },
    })),
  markMessageDeleted: (chatId, messageId) =>
    set((state) => {
      const list = state.messagesByChat[chatId];
      if (!list) return {};
      const idx = list.findIndex((m) => m._id === messageId);
      if (idx === -1) return {};
      const tomb: Message = {
        ...list[idx],
        deleted: true,
        content: '',
        attachment: undefined,
        plaintext: undefined,
        encryption: { enabled: false, keys: [] },
      };
      const next = list.slice();
      next[idx] = tomb;
      const chats = state.chats.map((c) =>
        c._id === chatId && c.lastMessage?._id === messageId ? { ...c, lastMessage: tomb } : c,
      );
      return {
        messagesByChat: { ...state.messagesByChat, [chatId]: next },
        chats,
      };
    }),
  markChatRead: (chatId, userId) =>
    set((state) => {
      const list = state.messagesByChat[chatId];
      if (!list) return {};
      let changed = false;
      const next = list.map((m) => {
        if (m.readBy.includes(userId)) return m;
        changed = true;
        return { ...m, readBy: [...m.readBy, userId] };
      });
      if (!changed) return {};
      return {
        messagesByChat: {
          ...state.messagesByChat,
          [chatId]: next,
        },
      };
    }),

  setTyping: (chatId, userId, typing) =>
    set((state) => {
      const prev = state.typingByChat[chatId] ?? [];
      const nextSet = new Set(prev);
      if (typing) nextSet.add(userId);
      else nextSet.delete(userId);
      const next = [...nextSet];
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) {
        return {};
      }
      return { typingByChat: { ...state.typingByChat, [chatId]: next } };
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

/** Clears chat UI state — call on logout / auth failure / new login so stale chats don’t leak across sessions. */
export function resetChatState(): void {
  useChatStore.setState({
    chats: [],
    unread: {},
    selectedChatId: null,
    messagesByChat: {},
    typingByChat: {},
    presence: {},
  });
}
