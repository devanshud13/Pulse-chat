'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { EMPTY_MESSAGES, EMPTY_STRING_ARRAY } from '@/constants/empty';
import { useDecryptedMessages } from '@/hooks/useDecryptedMessages';
import { cn } from '@/utils/cn';

interface Props {
  chat: Chat;
  /** When provided, renders a back arrow in the header to return to the chat list (mobile UX). */
  onBack?: () => void;
}

export function ChatWindow({ chat, onBack }: Props): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const rawMessages = useChatStore((s) => s.messagesByChat[chat._id]);
  const messages = rawMessages === undefined ? EMPTY_MESSAGES : rawMessages;
  const setMessages = useChatStore((s) => s.setMessages);
  const prependMessages = useChatStore((s) => s.prependMessages);
  const clearUnread = useChatStore((s) => s.clearUnread);
  const rawTyping = useChatStore((s) => s.typingByChat[chat._id]);
  const typingIds = rawTyping === undefined ? EMPTY_STRING_ARRAY : rawTyping;
  const applyPresenceFromMembers = useChatStore((s) => s.applyPresenceFromMembers);

  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [showInfo, setShowInfo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  /* Wraps every group inside the scroll container; observed by ResizeObserver
   * so we can re-snap to the bottom whenever its height grows (new message,
   * decryption populating a longer plaintext, image finishes loading, etc.). */
  const innerRef = useRef<HTMLDivElement>(null);
  /* Sticky pin: while true, every content-height change auto-snaps the scroll
   * to the bottom. We turn it off the instant the user scrolls up themselves
   * (tracked in `onScroll`) and turn it back on whenever they scroll back to
   * the bottom. Initial value `true` ensures opening a chat lands at the bottom. */
  const stickyRef = useRef(true);

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
    setPage(1);
    setHasMore(true);
    stickyRef.current = true;
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

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto'): void => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  /* On chat switch, force-pin to bottom and snap immediately. We snap once
   * synchronously and once on the next animation frame so that even if the
   * messages render *after* this effect fires, we still land at the bottom. */
  useEffect(() => {
    stickyRef.current = true;
    scrollToBottom('auto');
    const id = requestAnimationFrame(() => scrollToBottom('auto'));
    return () => cancelAnimationFrame(id);
  }, [chat._id, scrollToBottom]);

  /* Watch the inner content for any size change — covers new messages,
   * decryption replacing "🔒 Decrypting…" with longer plaintext, images
   * finishing their load, the typing indicator appearing, etc. While the
   * pin is sticky, every growth instantly re-snaps us to the bottom; once
   * the user scrolls up the pin clears and we leave them alone. */
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const ro = new ResizeObserver(() => {
      if (stickyRef.current) scrollToBottom('auto');
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [scrollToBottom]);

  const loadMore = async (): Promise<void> => {
    if (loading || !hasMore) return;
    /* Loading older messages prepends content above; explicitly opt out of
     * sticky-bottom while we adjust scrollTop manually to preserve the user's
     * reading position. */
    stickyRef.current = false;
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
    /* Re-evaluate stickiness on every user scroll: at-bottom pins again so
     * subsequent growth follows them; scrolling up unpins so new messages
     * don't yank them down while they're reading older history. */
    stickyRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 80) void loadMore();
  };

  const typingNames = useMemo(() => {
    return typingIds
      .map((id) => chat.members.find((m) => m._id === id))
      .filter((m): m is User => Boolean(m && m._id !== user?._id))
      .map((m) => m.name);
  }, [typingIds, chat.members, user?._id]);

  useDecryptedMessages(chat._id, messages, user?._id ?? null);

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
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          showInfo && 'hidden lg:flex',
        )}
      >
        <ChatHeader
          chat={chat}
          currentUserId={user?._id ?? ''}
          onToggleInfo={() => setShowInfo((s) => !s)}
          onBack={onBack}
        />
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto py-3 scrollbar-thin"
        >
          <div ref={innerRef} className="space-y-1">
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
        </div>
        <TypingIndicator names={typingNames} />
        <MessageComposer chat={chat} />
      </div>
      {showInfo && (
        <ChatInfoPanel
          chat={chat}
          currentUserId={user?._id ?? ''}
          onClose={() => setShowInfo(false)}
        />
      )}
    </div>
  );
}
