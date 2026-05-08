'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import dynamic from 'next/dynamic';
import { Paperclip, Pencil, SendHorizonal, Smile, X } from 'lucide-react';
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

/** Build the encryption envelope for `plaintext` against every chat member.
 *  Returns `null` if any recipient is missing a public key (we then fall back
 *  to plaintext). */
async function buildEnvelope(
  plaintext: string,
  memberIds: string[],
): Promise<{
  payloadContent: string;
  encryption: { enabled: boolean; iv?: string; keys: { user: string; key: string }[] };
} | null> {
  if (!plaintext) return null;
  const keys = await keyService.getPublicKeys(memberIds);
  const recipients = memberIds
    .map((id) => ({ userId: id, publicKey: keys[id] }))
    .filter((r): r is { userId: string; publicKey: string } => Boolean(r.publicKey));
  if (recipients.length !== memberIds.length || recipients.length === 0) return null;
  const env = await encryptForRecipients(plaintext, recipients);
  return {
    payloadContent: env.ciphertext,
    encryption: { enabled: true, iv: env.iv, keys: env.keys },
  };
}

export function MessageComposer({ chat }: Props): JSX.Element {
  const chatId = chat._id;
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);

  const me = useAuthStore((s) => s.user);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const replaceMessage = useChatStore((s) => s.replaceMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const editing = useChatStore((s) => s.editing);
  const cancelEditing = useChatStore((s) => s.cancelEditing);

  /* True when the store is asking us to edit a message that lives in *this*
     composer's chat. (Other open ChatWindows ignore the global `editing` state.) */
  const isEditing = Boolean(editing && editing.chatId === chatId);

  /* When the user picks "Edit" on a message, copy its plaintext into the
     composer and focus it. Pending uploads are dropped to keep the flow simple. */
  useEffect(() => {
    if (!isEditing || !editing) return;
    setText(editing.plaintext);
    setPendingFile(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
    /* Disable typing indicator while editing — it's not "typing a new message" semantically. */
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (isTyping.current) {
      getSocket().emit('typing:stop', chatId);
      isTyping.current = false;
    }
  }, [isEditing, editing, chatId]);

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

  /* Auto-grow the textarea as the user types. Reset to a single row first to
     measure scrollHeight correctly, then clamp to ~6 lines so it can never push
     the chat history off screen. */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = 160; // roughly 6 lines of 14px text + padding
    const next = Math.min(el.scrollHeight, max);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [text]);

  const triggerTyping = (): void => {
    if (isEditing) return;
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

  const exitEditMode = (): void => {
    cancelEditing();
    setText('');
  };

  /** PATCH the existing message (re-encrypted if E2E) and update the local store. */
  const sendEdit = async (): Promise<void> => {
    if (sending || !me || !editing) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed === editing.plaintext) {
      exitEditMode();
      return;
    }

    setSending(true);
    /* Optimistic in-place update — flip the body to the new text and tag it
       as edited so the user sees "edited" immediately. */
    updateMessage(chatId, editing.messageId, {
      plaintext: trimmed,
      content: trimmed,
      edited: true,
      updatedAt: new Date().toISOString(),
    });

    try {
      let payloadContent = trimmed;
      let encryption: {
        enabled: boolean;
        iv?: string;
        keys: { user: string; key: string }[];
      } = { enabled: false, keys: [] };
      const env = await buildEnvelope(
        trimmed,
        chat.members.map((m) => m._id),
      );
      if (env) {
        payloadContent = env.payloadContent;
        encryption = env.encryption;
      }
      const real = await messageService.edit(editing.messageId, {
        content: payloadContent,
        encryption: encryption.enabled ? encryption : undefined,
      });
      updateMessage(chatId, editing.messageId, {
        ...real,
        plaintext: trimmed,
      });
      exitEditMode();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ?? 'Failed to edit'
        : 'Failed to edit';
      toast.error(msg);
      /* Roll back to the original plaintext. */
      updateMessage(chatId, editing.messageId, {
        plaintext: editing.plaintext,
        content: editing.plaintext,
      });
    } finally {
      setSending(false);
    }
  };

  const send = async (): Promise<void> => {
    if (isEditing) return sendEdit();
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

      let payloadContent = trimmed;
      let encryption: {
        enabled: boolean;
        iv?: string;
        keys: { user: string; key: string }[];
      } = { enabled: false, keys: [] };
      if (trimmed) {
        const env = await buildEnvelope(
          trimmed,
          chat.members.map((m) => m._id),
        );
        if (env) {
          payloadContent = env.payloadContent;
          encryption = env.encryption;
        }
      }

      const real = await messageService.send({
        chatId,
        content: payloadContent,
        type: optimisticType,
        attachment,
        encryption: encryption.enabled ? encryption : undefined,
      });

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
      if (fileForOptimistic) {
        setTimeout(() => removeMessage(chatId, tempId), 5000);
      }
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Escape' && isEditing) {
      e.preventDefault();
      exitEditMode();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="border-t bg-background/80 p-3 backdrop-blur">
      {isEditing && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 text-primary">
            <Pencil className="h-3.5 w-3.5" />
            <span className="font-medium">Editing message</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={exitEditMode}
            aria-label="Cancel edit"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      {!isEditing && pendingFile && (
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
          disabled={isEditing}
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
            <div ref={popoverRef} className="absolute bottom-12 left-0 z-50">
              <EmojiPicker onSelect={(emoji) => setText((t) => t + emoji)} />
            </div>
          )}
        </div>
        <Textarea
          ref={textareaRef}
          value={text}
          rows={1}
          onChange={(e) => {
            setText(e.target.value);
            triggerTyping();
          }}
          onKeyDown={onKey}
          placeholder={isEditing ? 'Edit your message…' : 'Type a message…'}
          className="min-h-[40px] flex-1 resize-none leading-5"
        />
        <Button
          onClick={send}
          disabled={sending || uploading || (isEditing && !text.trim())}
          size="icon"
          aria-label={isEditing ? 'Save edit' : 'Send'}
        >
          <SendHorizonal className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
