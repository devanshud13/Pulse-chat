'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import type { Chat, Message, User } from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { messageService } from '@/services/chat.service';
import { getSocket } from '@/services/socket';
import { ChatHeader } from './ChatHeader';
import { ChatInfoPanel } from './ChatInfoPanel';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import { formatDate } from '@/utils/format';

interface Props {
  chat: Chat;
}

export function ChatWindow({ chat }: Props): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const messages = useChatStore((s) => s.messagesByChat[chat._id] ?? []);
  const setMessages = useChatStore((s) => s.setMessages);
  const prependMessages = useChatStore((s) => s.prependMessages);
  const clearUnread = useChatStore((s) => s.clearUnread);
  const typingIds = useChatStore((s) => s.typingByChat[chat._id] ?? []);
  const applyPresenceFromMembers = useChatStore((s) => s.applyPresenceFromMembers);

  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [showInfo, setShowInfo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialLoad = useRef(true);

  useEffect(() => {
    applyPresenceFromMembers(chat.members);
  }, [chat.members, applyPresenceFromMembers]);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    socket.emit('chat:join', chat._id);
    return () => {
      socket.emit('chat:leave', chat._id);
    };
  }, [chat._id, user]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    initialLoad.current = true;
    setPage(1);
    setHasMore(true);
    (async () => {
      try {
        const res = await messageService.list(chat._id, 1, 30);
        if (!active) return;
        setMessages(chat._id, res.items);
        setHasMore(res.items.length === res.limit && res.total > res.items.length);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [chat._id, setMessages]);

  useEffect(() => {
    if (!user) return;
    if (messages.length === 0) return;
    void messageService.markRead(chat._id);
    getSocket().emit('message:read', chat._id);
    clearUnread(chat._id);
  }, [chat._id, messages.length, user, clearUnread]);

  useEffect(() => {
    if (!scrollRef.current) return;
    if (initialLoad.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      initialLoad.current = false;
      return;
    }
    const last = messages[messages.length - 1];
    if (!last) return;
    const senderId = typeof last.sender === 'string' ? last.sender : last.sender._id;
    const isMine = senderId === user?._id;
    const el = scrollRef.current;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (isMine || nearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, user?._id]);

  const loadMore = async (): Promise<void> => {
    if (loading || !hasMore) return;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setLoading(true);
    try {
      const next = page + 1;
      const res = await messageService.list(chat._id, next, 30);
      prependMessages(chat._id, res.items);
      setPage(next);
      setHasMore(res.items.length === res.limit);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } finally {
      setLoading(false);
    }
  };

  const onScroll = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 80) void loadMore();
  };

  const typingNames = useMemo(() => {
    return typingIds
      .map((id) => chat.members.find((m) => m._id === id))
      .filter((m): m is User => Boolean(m && m._id !== user?._id))
      .map((m) => m.name);
  }, [typingIds, chat.members, user?._id]);

  const grouped = useMemo(() => {
    const out: { date: string; messages: Message[] }[] = [];
    for (const m of messages) {
      const d = formatDate(m.createdAt);
      const last = out[out.length - 1];
      if (!last || last.date !== d) out.push({ date: d, messages: [m] });
      else last.messages.push(m);
    }
    return out;
  }, [messages]);

  return (
    <div className="flex h-full min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          chat={chat}
          currentUserId={user?._id ?? ''}
          onToggleInfo={() => setShowInfo((s) => !s)}
        />
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 space-y-1 overflow-y-auto py-3 scrollbar-thin"
        >
          {hasMore && (
            <div className="flex justify-center py-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <button
                  onClick={() => void loadMore()}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Load earlier messages
                </button>
              )}
            </div>
          )}
          {grouped.map((g) => (
            <motion.div
              key={g.date}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-1"
            >
              <div className="my-2 flex items-center justify-center">
                <span className="rounded-full bg-muted/60 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {g.date}
                </span>
              </div>
              {g.messages.map((m, idx) => {
                const senderId = typeof m.sender === 'string' ? m.sender : m.sender._id;
                const prev = g.messages[idx - 1];
                const prevSender = prev
                  ? typeof prev.sender === 'string'
                    ? prev.sender
                    : prev.sender._id
                  : null;
                const showAvatar = prevSender !== senderId;
                return (
                  <MessageBubble
                    key={m._id}
                    message={m}
                    currentUserId={user?._id ?? ''}
                    showAvatar={showAvatar}
                    isGroup={chat.isGroup}
                    membersCount={chat.members.length}
                  />
                );
              })}
            </motion.div>
          ))}
        </div>
        <TypingIndicator names={typingNames} />
        <MessageComposer chatId={chat._id} />
      </div>
      {showInfo && <ChatInfoPanel chat={chat} currentUserId={user?._id ?? ''} />}
    </div>
  );
}
