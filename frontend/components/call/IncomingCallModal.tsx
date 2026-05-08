'use client';

import { motion } from 'framer-motion';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/chat/UserAvatar';

interface Props {
  peerName: string;
  peerAvatar?: string;
  peerId: string;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({
  peerName,
  peerAvatar,
  peerId,
  callType,
  onAccept,
  onReject,
}: Props): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
    >
      <motion.div
        animate={{ boxShadow: ['0 0 0 0 rgba(124,58,237,0.35)', '0 0 0 16px rgba(124,58,237,0)', '0 0 0 0 rgba(124,58,237,0.35)'] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-b from-card/95 to-card/80 p-8 text-center shadow-2xl backdrop-blur-xl"
      >
        <div className="mx-auto mb-4 flex justify-center">
          <UserAvatar userId={peerId} name={peerName} src={peerAvatar} size="lg" showStatus />
        </div>
        <h2 className="text-lg font-semibold">{peerName}</h2>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {callType === 'video' ? (
            <>
              <Video className="h-4 w-4" /> Incoming video call
            </>
          ) : (
            <>
              <Phone className="h-4 w-4" /> Incoming voice call
            </>
          )}
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={onReject}
            aria-label="Decline"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          <Button
            type="button"
            className="h-14 w-14 rounded-full bg-emerald-600 hover:bg-emerald-700"
            size="icon"
            onClick={onAccept}
            aria-label="Accept"
          >
            {callType === 'video' ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
