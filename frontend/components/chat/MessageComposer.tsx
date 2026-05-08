'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import dynamic from 'next/dynamic';
import { Paperclip, SendHorizonal, Smile, X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { messageService, uploadService } from '@/services/chat.service';
import { keyService } from '@/services/key.service';
import { encryptForRecipients } from '@/lib/crypto';
import { getSocket } from '@/services/socket';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import type { Chat, Message } from '@/types';
import { formatBytes } from '@/utils/format';

const EmojiPicker = dynamic(
  () => import('./EmojiPicker').then((m) => m.EmojiPicker),
  { ssr: false },
);

interface Props {
  chat: Chat;
}

let tempCounter = 0;
function newTempId(): string {
  tempCounter += 1;
  return `temp-${Date.now()}-${tempCounter}`;
}

export function MessageComposer({ chat }: Props): JSX.Element {
  const chatId = chat._id;
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);

  const me = useAuthStore((s) => s.user);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const replaceMessage = useChatStore((s) => s.replaceMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (isTyping.current) {
        getSocket().emit('typing:stop', chatId);
        isTyping.current = false;
      }
    };
  }, [chatId]);

  useEffect(() => {
    if (!showEmoji) return;
    const onClick = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (emojiBtnRef.current?.contains(t)) return;
      setShowEmoji(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [showEmoji]);

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
    if (sending || !me) return;
    const trimmed = text.trim();
    if (!trimmed && !pendingFile) return;

    setSending(true);
    const tempId = newTempId();
    const now = new Date().toISOString();
    const fileForOptimistic = pendingFile;
    const optimisticType: 'text' | 'image' | 'file' = fileForOptimistic
      ? fileForOptimistic.type.startsWith('image/')
        ? 'image'
        : 'file'
      : 'text';

    /* 1. Render optimistic message immediately. The clock icon kicks in via
          `pending: true` until the server confirms with the real id. */
    const optimistic: Message = {
      _id: tempId,
      chat: chatId,
      sender: me,
      type: optimisticType,
      content: trimmed,
      readBy: [me._id],
      deliveredTo: [me._id],
      edited: false,
      deleted: false,
      createdAt: now,
      updatedAt: now,
      pending: true,
      plaintext: trimmed,
      attachment: fileForOptimistic
        ? {
            url: URL.createObjectURL(fileForOptimistic),
            name: fileForOptimistic.name,
            size: fileForOptimistic.size,
            mime: fileForOptimistic.type,
          }
        : undefined,
    };
    appendMessage(chatId, optimistic);
    setText('');
    setPendingFile(null);

    try {
      let attachment;
      if (fileForOptimistic) {
        setUploading(true);
        const uploaded = await uploadService.upload(fileForOptimistic);
        setUploading(false);
        attachment = uploaded;
      }

      /* 2. Try to encrypt the body with every member's RSA public key. If even
            one is missing we fall back to plaintext so we don't break the chat
            for users who haven't generated keys yet. */
      let payloadContent = trimmed;
      let encryption: {
        enabled: boolean;
        iv?: string;
        keys: { user: string; key: string }[];
      } = { enabled: false, keys: [] };

      if (trimmed) {
        const memberIds = chat.members.map((m) => m._id);
        const keys = await keyService.getPublicKeys(memberIds);
        const recipients = memberIds
          .map((id) => ({ userId: id, publicKey: keys[id] }))
          .filter((r): r is { userId: string; publicKey: string } => Boolean(r.publicKey));
        if (recipients.length === memberIds.length && recipients.length > 0) {
          const env = await encryptForRecipients(trimmed, recipients);
          payloadContent = env.ciphertext;
          encryption = { enabled: true, iv: env.iv, keys: env.keys };
        }
      }

      const real = await messageService.send({
        chatId,
        content: payloadContent,
        type: optimisticType,
        attachment,
        encryption: encryption.enabled ? encryption : undefined,
      });

      /* 3. Replace the optimistic shell with the canonical server copy.
            Cache the plaintext we already have so we don't re-decrypt our own
            outgoing message. */
      replaceMessage(chatId, tempId, { ...real, plaintext: trimmed });

      if (isTyping.current) {
        getSocket().emit('typing:stop', chatId);
        isTyping.current = false;
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ?? 'Failed to send'
        : 'Failed to send';
      toast.error(msg);
      updateMessage(chatId, tempId, { failed: true, pending: false });
      /* Roll back blob URL to free memory if attachment was optimistic. */
      if (fileForOptimistic) {
        setTimeout(() => removeMessage(chatId, tempId), 5000);
      }
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
            ref={emojiBtnRef}
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowEmoji((s) => !s)}
            aria-label="Emoji"
          >
            <Smile className="h-5 w-5" />
          </Button>
          {showEmoji && (
            <div
              ref={popoverRef}
              className="absolute bottom-12 left-0 z-50"
            >
              <EmojiPicker
                onSelect={(emoji) => {
                  setText((t) => t + emoji);
                }}
              />
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
