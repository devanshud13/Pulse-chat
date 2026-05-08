'use client';

import { ArrowLeft, Info, Lock, Phone, Video } from 'lucide-react';
import type { Chat, User } from '@/types';
import { Button } from '@/components/ui/button';
import { UserAvatar } from './UserAvatar';
import { useChatStore } from '@/store/chat.store';
import { formatRelative } from '@/utils/format';

interface Props {
  chat: Chat;
  currentUserId: string;
  onToggleInfo: () => void;
  /** Mobile-only: shows a back arrow to return to the chat list. */
  onBack?: () => void;
}

export function ChatHeader({ chat, currentUserId, onToggleInfo, onBack }: Props): JSX.Element {
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
    <div className="flex items-center gap-2 border-b bg-background/70 px-2 py-3 backdrop-blur sm:gap-3 sm:px-4">
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to chats"
          onClick={onBack}
          className="md:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <UserAvatar
        userId={counterpart?._id}
        name={title}
        src={chat.isGroup ? chat.avatar : counterpart?.avatar}
        showStatus={!chat.isGroup}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{title}</span>
          <Lock
            className="h-3 w-3 shrink-0 text-muted-foreground"
            aria-label="End-to-end encrypted"
          />
        </div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <Button variant="ghost" size="icon" disabled className="hidden sm:inline-flex">
        <Phone className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" disabled className="hidden sm:inline-flex">
        <Video className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onToggleInfo} aria-label="Toggle details">
        <Info className="h-5 w-5" />
      </Button>
    </div>
  );
}
