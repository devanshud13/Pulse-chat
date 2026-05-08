'use client';

import { motion } from 'framer-motion';
import type { Chat, User } from '@/types';
import { UserAvatar } from './UserAvatar';
import { Badge } from '@/components/ui/badge';
import { formatTime } from '@/utils/format';
import { cn } from '@/utils/cn';

interface Props {
  chat: Chat;
  currentUserId: string;
  active: boolean;
  unread: number;
  onClick: () => void;
}

export function ChatListItem({ chat, currentUserId, active, unread, onClick }: Props): JSX.Element {
  const counterpart: User | undefined = chat.isGroup
    ? undefined
    : chat.members.find((m) => m._id !== currentUserId);

  const title = chat.isGroup ? chat.name ?? 'Group' : counterpart?.name ?? 'Direct';
  const last = chat.lastMessage;
  /* Encrypted previews live behind the user's private key. While we're still
   * unwrapping it (see `useDecryptedChatPreviews`) we show an empty subtitle
   * rather than a "🔒 Encrypted message" placeholder — the real text fills in
   * a tick later once decryption resolves. */
  const callPreview = (() => {
    if (!last || last.type !== 'call' || !last.callMeta) return null;
    const t = last.callMeta.callType === 'video' ? 'Video call' : 'Audio call';
    if (last.callMeta.status === 'completed') return `${t} ended`;
    if (last.callMeta.status === 'rejected') return `${t} declined`;
    if (last.callMeta.status === 'missed') return `Missed ${t.toLowerCase()}`;
    return `${t} failed`;
  })();

  const subtitle = !last
    ? 'Say hi 👋'
    : last.deleted
      ? 'Message deleted'
      : callPreview
        ? callPreview
        : last.type === 'image'
          ? '📷 Photo'
          : last.type === 'file'
            ? '📎 File'
            : last.encryption?.enabled
              ? last.plaintext ?? ''
              : last.content || 'Say hi 👋';

  return (
    <motion.button
      whileHover={{ x: 2 }}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
        active ? 'bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-accent/60',
      )}
    >
      <UserAvatar
        userId={counterpart?._id}
        name={title}
        src={chat.isGroup ? chat.avatar : counterpart?.avatar}
        showStatus={!chat.isGroup}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {chat.lastMessage ? formatTime(chat.lastMessage.createdAt) : ''}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
          {unread > 0 && (
            <Badge className="h-5 min-w-[20px] justify-center px-1.5 text-[10px]">
              {unread > 99 ? '99+' : unread}
            </Badge>
          )}
        </div>
      </div>
    </motion.button>
  );
}
