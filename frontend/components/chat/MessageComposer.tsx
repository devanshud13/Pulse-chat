'use client';

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Paperclip, SendHorizonal, Smile, X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { messageService, uploadService } from '@/services/chat.service';
import { getSocket } from '@/services/socket';
import { useChatStore } from '@/store/chat.store';
import { formatBytes } from '@/utils/format';

const EMOJIS = ['😀', '😂', '😍', '🔥', '🚀', '👍', '🎉', '❤️', '😎', '🤔', '👀', '✨'];

interface Props {
  chatId: string;
}

export function MessageComposer({ chatId }: Props): JSX.Element {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);
  const appendMessage = useChatStore((s) => s.appendMessage);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (isTyping.current) {
        getSocket().emit('typing:stop', chatId);
        isTyping.current = false;
      }
    };
  }, [chatId]);

  const triggerTyping = (): void => {
    const socket = getSocket();
    if (!isTyping.current) {
      socket.emit('typing:start', chatId);
      isTyping.current = true;
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit('typing:stop', chatId);
      isTyping.current = false;
    }, 1500);
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File too large (max 25MB)');
      return;
    }
    setPendingFile(file);
    e.target.value = '';
  };

  const send = async (): Promise<void> => {
    if (sending) return;
    if (!text.trim() && !pendingFile) return;
    setSending(true);
    try {
      let attachment;
      let type: 'text' | 'image' | 'file' = 'text';
      if (pendingFile) {
        setUploading(true);
        const uploaded = await uploadService.upload(pendingFile);
        setUploading(false);
        attachment = uploaded;
        type = pendingFile.type.startsWith('image/') ? 'image' : 'file';
      }
      const msg = await messageService.send({
        chatId,
        content: text.trim(),
        type,
        attachment,
      });
      appendMessage(chatId, msg);
      setText('');
      setPendingFile(null);
      if (isTyping.current) {
        getSocket().emit('typing:stop', chatId);
        isTyping.current = false;
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ?? 'Failed to send'
        : 'Failed to send';
      toast.error(msg);
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="border-t bg-background/80 p-3 backdrop-blur">
      {pendingFile && (
        <div className="mb-2 flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-xs">
          <div className="min-w-0">
            <div className="truncate font-medium">{pendingFile.name}</div>
            <div className="text-muted-foreground">{formatBytes(pendingFile.size)}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setPendingFile(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,application/pdf,application/zip,.doc,.docx,.xls,.xlsx,.txt"
          onChange={onFile}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileRef.current?.click()}
          aria-label="Attach file"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowEmoji((s) => !s)}
            aria-label="Emoji"
          >
            <Smile className="h-5 w-5" />
          </Button>
          {showEmoji && (
            <div className="absolute bottom-12 left-0 z-10 grid w-56 grid-cols-6 gap-1 rounded-lg border bg-popover p-2 shadow-lg">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="rounded p-1 text-xl hover:bg-accent"
                  onClick={() => {
                    setText((t) => t + e);
                    setShowEmoji(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <Textarea
          value={text}
          rows={1}
          onChange={(e) => {
            setText(e.target.value);
            triggerTyping();
          }}
          onKeyDown={onKey}
          placeholder="Type a message…"
          className="min-h-[40px] max-h-32 flex-1"
        />
        <Button onClick={send} disabled={sending || uploading} size="icon" aria-label="Send">
          <SendHorizonal className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
