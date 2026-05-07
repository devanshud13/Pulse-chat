'use client';

import { motion } from 'framer-motion';
import { Check, CheckCheck, Download, FileIcon } from 'lucide-react';
import Image from 'next/image';
import type { Message, User } from '@/types';
import { UserAvatar } from './UserAvatar';
import { cn } from '@/utils/cn';
import { formatBytes, formatTime } from '@/utils/format';

interface Props {
  message: Message;
  currentUserId: string;
  showAvatar: boolean;
  isGroup: boolean;
  membersCount: number;
}

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

  if (message.deleted) {
    return (
      <div className={cn('flex w-full px-2', mine ? 'justify-end' : 'justify-start')}>
        <div className="rounded-2xl border border-dashed bg-muted/30 px-4 py-2 text-xs italic text-muted-foreground">
          Message deleted
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn('flex w-full items-end gap-2 px-2', mine ? 'justify-end' : 'justify-start')}
    >
      {!mine && (
        <div className={cn('w-8', !showAvatar && 'invisible')}>
          {showAvatar && (
            <UserAvatar userId={senderId} name={sender?.name} src={sender?.avatar} size="sm" />
          )}
        </div>
      )}
      <div className={cn('max-w-[78%] sm:max-w-[60%]', mine ? 'items-end' : 'items-start')}>
        {!mine && isGroup && showAvatar && (
          <div className="mb-0.5 ml-1 text-[11px] font-medium text-primary/90">
            {sender?.name ?? 'User'}
          </div>
        )}
        <div
          className={cn(
            'group rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm transition-shadow hover:shadow-md',
            mine
              ? 'rounded-br-sm bg-primary text-primary-foreground'
              : 'rounded-bl-sm bg-muted text-foreground',
          )}
        >
          {message.type === 'image' && message.attachment && (
            <a href={message.attachment.url} target="_blank" rel="noopener noreferrer" className="block">
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
          {message.content && <div className="whitespace-pre-wrap break-words">{message.content}</div>}
          <div
            className={cn(
              'mt-1 flex items-center justify-end gap-1 text-[10px]',
              mine ? 'text-primary-foreground/70' : 'text-muted-foreground',
            )}
          >
            <span>{formatTime(message.createdAt)}</span>
            {mine && (allRead ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
