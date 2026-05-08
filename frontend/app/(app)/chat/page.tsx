'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useChatStore } from '@/store/chat.store';
import { useAuthStore } from '@/store/auth.store';
import { useSocketEvents } from '@/hooks/useSocketEvents';
import { cn } from '@/utils/cn';

export default function ChatPage(): JSX.Element {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const chats = useChatStore((s) => s.chats);
  const selectedChatId = useChatStore((s) => s.selectedChatId);
  const selectChat = useChatStore((s) => s.selectChat);

  const onNotification = useCallback(
    (n: { chatId: string; title: string; body: string }): void => {
      const current = useChatStore.getState().selectedChatId;
      if (n.chatId === current) return;
      toast(n.title, { description: n.body, duration: 4000 });
    },
    [],
  );

  useSocketEvents(onNotification);

  /* On mobile, we want to start with the chat list visible (no chat opened by
     default). On desktop we still auto-pick the first chat for a faster start. */
  const autoSelectDone = useRef(false);
  useEffect(() => {
    if (selectedChatId) {
      autoSelectDone.current = true;
      return;
    }
    if (chats.length === 0 || autoSelectDone.current) return;
    autoSelectDone.current = true;
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      selectChat(chats[0]._id);
    }
  }, [selectedChatId, chats, selectChat]);

  const selected = useMemo(
    () => chats.find((c) => c._id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  if (!user) return <></>;

  /* Layout: on mobile we show *either* the sidebar OR the chat window, never both,
     mirroring WhatsApp / Telegram. On md+ they sit side by side. */
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div
        className={cn(
          'h-full w-full md:w-[340px] md:shrink-0 md:border-r',
          selected ? 'hidden md:flex' : 'flex',
        )}
      >
        <Sidebar selectedId={selectedChatId} onSelect={(id) => selectChat(id)} />
      </div>
      <main
        className={cn(
          'h-full min-w-0 flex-1',
          selected ? 'flex' : 'hidden md:flex',
        )}
      >
        {selected ? (
          <ChatWindow chat={selected} key={selected._id} onBack={() => selectChat(null)} />
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="hidden flex-1 flex-col items-center justify-center gap-4 p-8 text-center md:flex"
          >
            <div className="grid h-20 w-20 place-items-center rounded-2xl bg-primary/10 text-primary animate-float">
              <MessageCircle className="h-10 w-10" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Select a conversation</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose an existing chat or start a new one to send a message.
              </p>
            </div>
            <button
              onClick={() => router.push('/chat')}
              className="text-xs text-muted-foreground hover:underline"
            >
              Tip: search a teammate&apos;s name in the sidebar to start chatting
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
}
