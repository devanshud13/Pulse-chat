'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useChatStore } from '@/store/chat.store';
import { useAuthStore } from '@/store/auth.store';
import { useSocketEvents } from '@/hooks/useSocketEvents';

export default function ChatPage(): JSX.Element {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const chats = useChatStore((s) => s.chats);
  const selectedChatId = useChatStore((s) => s.selectedChatId);
  const selectChat = useChatStore((s) => s.selectChat);

  const onNotification = useCallback(
    (n: { chatId: string; title: string; body: string }): void => {
      if (n.chatId === selectedChatId) return;
      toast(n.title, { description: n.body, duration: 4000 });
    },
    [selectedChatId],
  );

  useSocketEvents(onNotification);

  useEffect(() => {
    if (!selectedChatId && chats.length > 0) {
      selectChat(chats[0]._id);
    }
  }, [selectedChatId, chats, selectChat]);

  const selected = useMemo(
    () => chats.find((c) => c._id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  if (!user) return <></>;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar selectedId={selectedChatId} onSelect={(id) => selectChat(id)} />
      <main className="flex h-full min-w-0 flex-1">
        {selected ? (
          <ChatWindow chat={selected} key={selected._id} />
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
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
              Tip: search a teammate's name in the sidebar to start chatting
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
}
