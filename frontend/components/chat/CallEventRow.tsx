'use client';

import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, Video, VideoOff } from 'lucide-react';
import type { CallMeta, Message, User } from '@/types';
import { cn } from '@/utils/cn';
import { formatTime } from '@/utils/format';

interface Props {
  message: Message;
  currentUserId: string;
}

function formatDuration(sec: number): string {
  if (sec < 1) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

interface RenderInfo {
  Icon: typeof Phone;
  tone: string;
  label: string;
}

function buildLabel(meta: CallMeta, mine: boolean): RenderInfo {
  const isVideo = meta.callType === 'video';
  const callWord = isVideo ? 'Video call' : 'Audio call';

  if (meta.status === 'completed') {
    const duration = meta.durationSec ? formatDuration(meta.durationSec) : '';
    return {
      Icon: isVideo ? Video : Phone,
      tone: 'text-emerald-500',
      label: duration ? `${callWord} · ${duration}` : callWord,
    };
  }
  if (meta.status === 'rejected') {
    return {
      Icon: isVideo ? VideoOff : PhoneOff,
      tone: 'text-rose-500',
      label: mine ? `${callWord} declined` : `Declined ${callWord.toLowerCase()}`,
    };
  }
  if (meta.status === 'missed') {
    return {
      Icon: PhoneMissed,
      tone: 'text-amber-500',
      label: mine ? `${callWord} not answered` : `Missed ${callWord.toLowerCase()}`,
    };
  }
  return {
    Icon: PhoneIncoming,
    tone: 'text-muted-foreground',
    label: `${callWord} failed`,
  };
}

export function CallEventRow({ message, currentUserId }: Props): JSX.Element | null {
  const meta = message.callMeta;
  if (!meta) return null;
  const initiatorId =
    typeof meta.initiator === 'string' ? meta.initiator : (meta.initiator as unknown as User)._id;
  const mine = initiatorId === currentUserId;
  const info = buildLabel(meta, mine);
  const Icon = info.Icon;

  return (
    <div className="flex w-full justify-center px-2">
      <div
        className={cn(
          'flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3.5 py-1.5 text-xs',
          info.tone,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="font-medium">{info.label}</span>
        <span className="text-muted-foreground">· {formatTime(message.createdAt)}</span>
      </div>
    </div>
  );
}
