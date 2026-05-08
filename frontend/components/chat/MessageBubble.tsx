'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  Download,
  FileIcon,
  MoreVertical,
  Pencil,
  Trash2,
  UserMinus,
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import type { Message, User } from '@/types';
import { UserAvatar } from './UserAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { messageService } from '@/services/chat.service';
import { useChatStore } from '@/store/chat.store';
import { cn } from '@/utils/cn';
import { formatBytes, formatTime } from '@/utils/format';

interface Props {
  message: Message;
  currentUserId: string;
  showAvatar: boolean;
  isGroup: boolean;
  membersCount: number;
}

/** Edits older than 15 minutes hit a backend window check, so don't even show
 *  the option client-side. */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

export function MessageBubble({
  message,
  currentUserId,
  showAvatar,
  isGroup,
  membersCount,
}: Props): JSX.Element {
  const sender = typeof message.sender === 'string' ? null : (message.sender as User);
  const senderId = typeof message.sender === 'string' ? message.sender : sender?._id;
  const mine = senderId === currentUserId;
  const readByOthers = message.readBy.filter((id) => id !== currentUserId).length;
  const allRead = readByOthers >= Math.max(0, membersCount - 1) && membersCount > 1;

  const removeMessage = useChatStore((s) => s.removeMessage);
  const restoreMessage = useChatStore((s) => s.restoreMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const markMessageDeleted = useChatStore((s) => s.markMessageDeleted);
  const startEditing = useChatStore((s) => s.startEditing);

  const [busy, setBusy] = useState(false);

  /* Optimistic delete-for-me: drop the message from the local list immediately,
   * then call the API in the background. If the API fails, slot it back in at
   * its original position so the user doesn't lose anything. */
  const onDeleteForMe = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    const list = useChatStore.getState().messagesByChat[message.chat] ?? [];
    const originalIndex = list.findIndex((m) => m._id === message._id);
    const snapshot: Message = { ...message };
    removeMessage(message.chat, message._id);
    try {
      await messageService.deleteForMe(message._id);
    } catch {
      restoreMessage(message.chat, snapshot, originalIndex >= 0 ? originalIndex : list.length);
      toast.error('Could not delete the message');
    } finally {
      setBusy(false);
    }
  };

  /* Optimistic delete-for-everyone: tombstone immediately, rollback on failure. */
  const onDeleteForEveryone = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    const snapshot: Message = { ...message };
    markMessageDeleted(message.chat, message._id);
    try {
      await messageService.deleteForEveryone(message._id);
    } catch {
      updateMessage(message.chat, message._id, {
        deleted: false,
        content: snapshot.content,
        attachment: snapshot.attachment,
        plaintext: snapshot.plaintext,
        encryption: snapshot.encryption,
      });
      toast.error('Could not delete the message');
    } finally {
      setBusy(false);
    }
  };

  if (message.deleted) {
    return (
      <div
        className={cn(
          'flex w-full items-end gap-2 px-2',
          mine ? 'justify-end' : 'justify-start',
        )}
      >
        {!mine && <div className="w-8 shrink-0" aria-hidden />}
        <div className="max-w-[78%] sm:max-w-[60%]">
          <div className="rounded-2xl border border-dashed bg-muted/30 px-4 py-2 text-xs italic text-muted-foreground">
            {mine ? 'You deleted this message' : 'This message was deleted'}
          </div>
        </div>
      </div>
    );
  }

  const body =
    message.encryption?.enabled && message.plaintext === undefined
      ? '🔒 Decrypting…'
      : message.plaintext ?? message.content;

  const isOptimistic = Boolean(message.pending);
  const failed = Boolean(message.failed);
  const canDeleteForEveryone = mine && !isOptimistic && !failed;
  const ageMs = Date.now() - new Date(message.createdAt).getTime();
  const canEdit =
    mine && !isOptimistic && !failed && message.type === 'text' && ageMs < EDIT_WINDOW_MS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'group/msg flex w-full items-end gap-2 px-2',
        mine ? 'justify-end' : 'justify-start',
      )}
    >
      {!mine && (
        <div className={cn('w-8', !showAvatar && 'invisible')}>
          {showAvatar && (
            <UserAvatar userId={senderId} name={sender?.name} src={sender?.avatar} size="sm" />
          )}
        </div>
      )}
      <div
        className={cn(
          'relative flex max-w-[78%] flex-col sm:max-w-[60%]',
          mine ? 'items-end' : 'items-start',
        )}
      >
        {!mine && isGroup && showAvatar && (
          <div className="mb-0.5 ml-1 text-[11px] font-medium text-primary/90">
            {sender?.name ?? 'User'}
          </div>
        )}
        <div
          className={cn(
            'group relative rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm transition-shadow hover:shadow-md',
            mine
              ? 'rounded-br-sm bg-primary text-primary-foreground'
              : 'rounded-bl-sm bg-muted text-foreground',
            isOptimistic && 'opacity-80',
            failed && 'ring-1 ring-destructive/60',
          )}
        >
          {!isOptimistic && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Message actions"
                  className={cn(
                    'absolute -top-2 z-10 grid h-6 w-6 place-items-center rounded-full border bg-background text-foreground/80 opacity-0 shadow-md outline-none transition-opacity',
                    'hover:opacity-100 focus-visible:opacity-100 group-hover/msg:opacity-100',
                    'data-[state=open]:opacity-100 sm:group-hover/msg:opacity-100',
                    '-right-2',
                  )}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align={mine ? 'end' : 'start'}
                className="w-52"
                sideOffset={6}
              >
                {canEdit && (
                  <>
                    <DropdownMenuItem
                      disabled={busy}
                      onSelect={(e) => {
                        e.preventDefault();
                        startEditing(
                          message.chat,
                          message._id,
                          message.plaintext ?? message.content,
                        );
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  disabled={busy}
                  onSelect={(e) => {
                    e.preventDefault();
                    void onDeleteForMe();
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <UserMinus className="mr-2 h-4 w-4" /> Delete for me
                </DropdownMenuItem>
                {canDeleteForEveryone && (
                  <DropdownMenuItem
                    disabled={busy}
                    onSelect={(e) => {
                      e.preventDefault();
                      void onDeleteForEveryone();
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete for everyone
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {message.type === 'image' && message.attachment && (
            <a
              href={message.attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Image
                src={message.attachment.url}
                alt={message.attachment.name}
                width={360}
                height={240}
                unoptimized
                className="mb-1 max-h-72 w-auto rounded-lg object-cover"
              />
            </a>
          )}
          {message.type === 'file' && message.attachment && (
            <a
              href={message.attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'mb-1 flex items-center gap-3 rounded-lg border p-2 text-sm',
                mine ? 'border-primary-foreground/30' : 'border-border',
              )}
            >
              <FileIcon className="h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{message.attachment.name}</div>
                <div className="text-xs opacity-70">{formatBytes(message.attachment.size)}</div>
              </div>
              <Download className="h-4 w-4 opacity-70" />
            </a>
          )}
          {body && <div className="whitespace-pre-wrap break-words">{body}</div>}
          <div
            className={cn(
              'mt-1 flex items-center justify-end gap-1 text-[10px]',
              mine ? 'text-primary-foreground/70' : 'text-muted-foreground',
            )}
          >
            {message.edited && <span className="italic opacity-80">edited</span>}
            <span>{formatTime(message.createdAt)}</span>
            {mine &&
              (failed ? (
                <AlertCircle className="h-3 w-3 text-destructive" />
              ) : isOptimistic ? (
                <Clock className="h-3 w-3" />
              ) : allRead ? (
                <CheckCheck className="h-3 w-3" />
              ) : (
                <Check className="h-3 w-3" />
              ))}
          </div>
        </div>
        {failed && mine && (
          <button
            type="button"
            onClick={() => removeMessage(message.chat, message._id)}
            className="mt-1 text-[10px] text-destructive hover:underline"
          >
            Failed to send · tap to dismiss
          </button>
        )}
      </div>
    </motion.div>
  );
}
