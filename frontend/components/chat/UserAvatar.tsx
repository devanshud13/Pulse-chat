'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useChatStore } from '@/store/chat.store';
import { initials } from '@/utils/format';
import { cn } from '@/utils/cn';

interface Props {
  userId?: string;
  name?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  className?: string;
}

const sizes: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
};

export function UserAvatar({
  userId,
  name,
  src,
  size = 'md',
  showStatus = false,
  className,
}: Props): JSX.Element {
  const presence = useChatStore((s) => (userId ? s.presence[userId] : undefined));
  const isOnline = presence?.status === 'online';

  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      <Avatar className={sizes[size]}>
        {src ? <AvatarImage src={src} alt={name ?? 'avatar'} /> : null}
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      {showStatus && (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-background',
            isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/50',
          )}
        />
      )}
    </div>
  );
}
