'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, VideoOff, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/chat/UserAvatar';
import { useCallStore, type CallPhase, type NetworkQuality } from '@/store/call.store';
import { webRtcCallManager } from '@/webrtc/callManager';
import { ParticipantVideo } from './ParticipantVideo';
import { CallControls } from './CallControls';
import { cn } from '@/utils/cn';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function NetworkBars({ quality }: { quality: NetworkQuality }): JSX.Element {
  const active = quality === 'good' ? 3 : quality === 'fair' ? 2 : quality === 'poor' ? 1 : 0;
  return (
    <div className="flex items-end gap-0.5" title={`Network: ${quality}`}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            'w-1 rounded-sm bg-white/30',
            i === 1 && 'h-2',
            i === 2 && 'h-3',
            i === 3 && 'h-4',
            i <= active && 'bg-emerald-400',
            quality === 'poor' && i <= active && 'bg-amber-500',
          )}
        />
      ))}
    </div>
  );
}

interface ShellProps {
  phase: CallPhase;
}

export function ActiveCallShell({ phase }: ShellProps): JSX.Element {
  const peerName = useCallStore((s) => s.peerName);
  const peerAvatar = useCallStore((s) => s.peerAvatar);
  const peerId = useCallStore((s) => s.peerId);
  const callId = useCallStore((s) => s.callId);
  const callType = useCallStore((s) => s.callType);
  const minimized = useCallStore((s) => s.minimized);
  const fullscreen = useCallStore((s) => s.fullscreen);
  const localMuted = useCallStore((s) => s.localMuted);
  const cameraOn = useCallStore((s) => s.cameraOn);
  const screenSharing = useCallStore((s) => s.screenSharing);
  const remoteMuted = useCallStore((s) => s.remoteMuted);
  const remoteCameraOn = useCallStore((s) => s.remoteCameraOn);
  const remoteSpeaking = useCallStore((s) => s.remoteSpeaking);
  const remoteScreenSharing = useCallStore((s) => s.remoteScreenSharing);
  const networkQuality = useCallStore((s) => s.networkQuality);
  const durationSec = useCallStore((s) => s.durationSec);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return webRtcCallManager.subscribeStreams(() => {
      setLocalStream(webRtcCallManager.getLocalStream());
      setRemoteStream(webRtcCallManager.getRemoteStream());
    });
  }, []);

  useEffect(() => {
    setLocalStream(webRtcCallManager.getLocalStream());
    setRemoteStream(webRtcCallManager.getRemoteStream());
  }, [phase]);

  const audioOnly = callType === 'audio';

  const toggleFs = (): void => {
    const el = shellRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen().catch(() => undefined);
      useCallStore.getState().setFullscreen(true);
    } else {
      void document.exitFullscreen();
      useCallStore.getState().setFullscreen(false);
    }
  };

  useEffect(() => {
    const onFs = (): void => {
      useCallStore.getState().setFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  if (phase === 'idle' || phase === 'incoming-ringing') return <></>;

  const onCancelOutgoing = (): void => {
    if (callId) webRtcCallManager.endCall();
    else webRtcCallManager.cancelOutgoingIfPending();
  };

  if (minimized && (phase === 'active' || phase === 'connecting' || phase === 'reconnecting')) {
    return (
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-4 right-4 z-[95] flex w-[min(100vw-2rem,20rem)] flex-col gap-2 rounded-2xl border border-white/10 bg-black/70 p-3 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar userId={peerId ?? ''} name={peerName} src={peerAvatar} size="sm" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{peerName}</div>
              <div className="text-xs text-white/60">{formatDuration(durationSec)}</div>
            </div>
          </div>
          <NetworkBars quality={networkQuality} />
        </div>
        {!audioOnly && (
          <ParticipantVideo stream={remoteStream} muted={remoteMuted} className="aspect-video w-full" />
        )}
        <CallControls
          audioOnly={audioOnly}
          localMuted={localMuted}
          cameraOn={cameraOn}
          screenSharing={screenSharing}
          minimized
          onToggleMic={() => webRtcCallManager.toggleMic()}
          onToggleCamera={() => webRtcCallManager.toggleCamera()}
          onToggleScreen={() => void webRtcCallManager.toggleScreenShare()}
          onSwitchCamera={() => void webRtcCallManager.switchCamera()}
          onToggleMinimize={() => useCallStore.getState().setMinimized(false)}
          onEnd={() => webRtcCallManager.endCall()}
        />
      </motion.div>
    );
  }

  if (phase === 'outgoing-ringing') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-gradient-to-b from-background/95 via-violet-950/40 to-background/95 backdrop-blur-xl"
      >
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="mb-6"
        >
          <UserAvatar userId={peerId ?? ''} name={peerName} src={peerAvatar} size="lg" showStatus />
        </motion.div>
        <h2 className="text-xl font-semibold">Calling {peerName}…</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {callType === 'video' ? 'Video call' : 'Voice call'}
        </p>
        <Button variant="destructive" className="mt-10 rounded-full px-8" onClick={onCancelOutgoing}>
          Cancel
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={shellRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        'fixed inset-0 z-[95] flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950/80 text-white',
        fullscreen && 'rounded-none',
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar userId={peerId ?? ''} name={peerName} src={peerAvatar} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium">{peerName}</div>
            <div className="flex items-center gap-2 text-xs text-white/60">
              {phase === 'reconnecting' ? (
                <span className="flex items-center gap-1 text-amber-300">
                  <Loader2 className="h-3 w-3 animate-spin" /> Reconnecting…
                </span>
              ) : phase === 'connecting' ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Connecting…
                </span>
              ) : (
                <>
                  <span>{formatDuration(durationSec)}</span>
                  {remoteMuted && <WifiOff className="h-3 w-3" />}
                  {!remoteMuted && <Wifi className="h-3 w-3 text-emerald-400" />}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NetworkBars quality={networkQuality} />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="border-white/10 bg-white/10 text-white hover:bg-white/20"
            onClick={toggleFs}
          >
            {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 p-4">
        <div
          className={cn(
            'relative min-h-[40vh] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-inner md:min-h-0',
            remoteSpeaking && 'ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-transparent',
          )}
        >
          {audioOnly ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-4">
              <UserAvatar userId={peerId ?? ''} name={peerName} src={peerAvatar} size="lg" showStatus />
              <p className="text-sm text-white/70">{remoteMuted ? 'Muted' : 'Connected'}</p>
            </div>
          ) : (
            <>
              <ParticipantVideo
                stream={remoteStream}
                muted={remoteMuted}
                className="h-full min-h-[280px] w-full md:min-h-0"
                label={peerName}
              />
              {/* Camera-off overlay only when peer is *not* screen sharing — if
                  they're sharing, the screen frames travel on the same video
                  track and we should keep showing them. */}
              {!remoteCameraOn && !remoteScreenSharing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <VideoOffPlaceholder name={peerName} />
                </div>
              )}
            </>
          )}
        </div>

        {!audioOnly && (
          /* Floating PIP — draggable, sized to its content (aspect-video).
             Keeping it absolute on every breakpoint avoids the long empty
             column we used to get on desktop where the wrapper stretched
             to row height while the inner video stayed 16:9. */
          <motion.div
            drag
            dragMomentum={false}
            dragElastic={0.15}
            dragConstraints={shellRef}
            className="absolute bottom-24 right-6 z-20 w-40 cursor-grab overflow-hidden rounded-xl border-2 border-white/20 bg-black/60 shadow-2xl active:cursor-grabbing md:bottom-6 md:right-6 md:w-56"
          >
            <ParticipantVideo stream={localStream} muted mirror className="aspect-video w-full" label="You" />
            {!cameraOn && !screenSharing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-xs">
                Camera off
              </div>
            )}
            {screenSharing && (
              <div className="absolute left-1 top-1 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-medium">
                Sharing
              </div>
            )}
          </motion.div>
        )}
      </div>

      <div className="flex justify-center border-t border-white/10 bg-black/30 px-4 py-4 backdrop-blur">
        <CallControls
          audioOnly={audioOnly}
          localMuted={localMuted}
          cameraOn={cameraOn}
          screenSharing={screenSharing}
          minimized={false}
          onToggleMic={() => webRtcCallManager.toggleMic()}
          onToggleCamera={() => webRtcCallManager.toggleCamera()}
          onToggleScreen={() => void webRtcCallManager.toggleScreenShare()}
          onSwitchCamera={() => void webRtcCallManager.switchCamera()}
          onToggleMinimize={() => useCallStore.getState().setMinimized(true)}
          onEnd={() => webRtcCallManager.endCall()}
        />
      </div>
    </motion.div>
  );
}

function VideoOffPlaceholder({ name }: { name: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 text-white/80">
      <VideoOff className="h-12 w-12 opacity-50" />
      <span className="text-sm">{name} turned off camera</span>
    </div>
  );
}
