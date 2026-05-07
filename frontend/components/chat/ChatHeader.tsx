'use client';

import { Info, Phone, Video } from 'lucide-react';
import type { Chat, User } from '@/types';
import { Button } from '@/components/ui/button';
import { UserAvatar } from './UserAvatar';
import { useChatStore } from '@/store/chat.store';
import { formatRelative } from '@/utils/format';

interface Props {
  chat: Chat;
  currentUserId: string;
  onToggleInfo: () => void;
}

export function ChatHeader({ chat, currentUserId, onToggleInfo }: Props): JSX.Element {
  const counterpart: User | undefined = chat.isGroup
    ? undefined
    : chat.members.find((m) => m._id !== currentUserId);
  const presence = useChatStore((s) => (counterpart ? s.presence[counterpart._id] : undefined));

  const title = chat.isGroup ? chat.name ?? 'Group' : counterpart?.name ?? 'Direct';
  const subtitle = chat.isGroup
    ? `${chat.members.length} members`
    : presence?.status === 'online'
      ? 'Online'
      : presence?.lastSeen
        ? `Last seen ${formatRelative(presence.lastSeen)}`
        : 'Offline';

  return (
    <div className="flex items-center gap-3 border-b bg-background/70 px-4 py-3 backdrop-blur">
      <UserAvatar
        userId={counterpart?._id}
        name={title}
        src={chat.isGroup ? chat.avatar : counterpart?.avatar}
        showStatus={!chat.isGroup}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <Button variant="ghost" size="icon" disabled>
        <Phone className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" disabled>
        <Video className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onToggleInfo} aria-label="Toggle details">
        <Info className="h-5 w-5" />
      </Button>
    </div>
  );
}
