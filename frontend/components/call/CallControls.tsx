'use client';

import {
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  PhoneOff,
  RefreshCw,
  Video,
  VideoOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

interface Props {
  audioOnly: boolean;
  localMuted: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  minimized: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onSwitchCamera: () => void;
  onToggleMinimize: () => void;
  onEnd: () => void;
}

export function CallControls({
  audioOnly,
  localMuted,
  cameraOn,
  screenSharing,
  minimized,
  onToggleMic,
  onToggleCamera,
  onToggleScreen,
  onSwitchCamera,
  onToggleMinimize,
  onEnd,
}: Props): JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 shadow-2xl backdrop-blur-xl',
        minimized && 'scale-90',
      )}
    >
      <Button
        type="button"
        size="icon"
        variant={localMuted ? 'destructive' : 'secondary'}
        className="h-12 w-12 rounded-full border border-white/10"
        onClick={onToggleMic}
        aria-label={localMuted ? 'Unmute' : 'Mute'}
      >
        {localMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </Button>
      {!audioOnly && (
        <>
          <Button
            type="button"
            size="icon"
            variant={cameraOn ? 'secondary' : 'destructive'}
            className="h-12 w-12 rounded-full border border-white/10"
            onClick={onToggleCamera}
            aria-label={cameraOn ? 'Camera off' : 'Camera on'}
          >
            {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-12 w-12 rounded-full border border-white/10"
            onClick={onSwitchCamera}
            aria-label="Switch camera"
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={screenSharing ? 'default' : 'secondary'}
            className="h-12 w-12 rounded-full border border-white/10"
            onClick={onToggleScreen}
            aria-label="Share screen"
          >
            <MonitorUp className="h-5 w-5" />
          </Button>
        </>
      )}
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="h-12 w-12 rounded-full border border-white/10"
        onClick={onToggleMinimize}
        aria-label={minimized ? 'Expand call' : 'Minimize call'}
      >
        {minimized ? <Maximize2 className="h-5 w-5" /> : <Minimize2 className="h-5 w-5" />}
      </Button>
      <Button
        type="button"
        size="icon"
        variant="destructive"
        className="h-12 w-12 rounded-full"
        onClick={onEnd}
        aria-label="End call"
      >
        <PhoneOff className="h-5 w-5" />
      </Button>
    </div>
  );
}
