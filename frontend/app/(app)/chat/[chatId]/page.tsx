'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useChatStore } from '@/store/chat.store';
import { chatService } from '@/services/chat.service';

export default function ChatByIdPage(): JSX.Element {
  const params = useParams<{ chatId: string }>();
  const router = useRouter();
  const upsertChat = useChatStore((s) => s.upsertChat);
  const selectChat = useChatStore((s) => s.selectChat);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const chat = await chatService.getById(params.chatId);
        if (!active) return;
        upsertChat(chat);
        selectChat(chat._id);
      } finally {
        if (active) router.replace('/chat');
      }
    })();
    return () => {
      active = false;
    };
  }, [params.chatId, router, upsertChat, selectChat]);

  return (
    <div className="grid min-h-screen place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
