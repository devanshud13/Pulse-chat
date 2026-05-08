'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/utils/cn';

interface Props {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  className?: string;
  label?: string;
}

export function ParticipantVideo({
  stream,
  muted = false,
  mirror = false,
  className,
  label,
}: Props): JSX.Element {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {
      /* autoplay policies */
    });
  }, [stream]);

  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-black/80', className)}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={cn('h-full w-full object-cover', mirror && 'scale-x-[-1]')}
      />
      {label && (
        <div className="absolute bottom-3 left-3 rounded-lg bg-black/50 px-2 py-1 text-xs text-white backdrop-blur">
          {label}
        </div>
      )}
    </div>
  );
}
