import { create } from 'zustand';
import type { PermissionFailure } from '@/lib/mediaPermissions';

export type CallPhase =
  | 'idle'
  | 'outgoing-ringing'
  | 'incoming-ringing'
  | 'connecting'
  | 'active'
  | 'reconnecting';

export type NetworkQuality = 'good' | 'fair' | 'poor' | 'unknown';

export interface CallStoreState {
  phase: CallPhase;
  minimized: boolean;
  fullscreen: boolean;
  callId: string | null;
  chatId: string | null;
  callType: 'audio' | 'video' | null;
  role: 'caller' | 'callee' | null;
  peerId: string | null;
  peerName: string;
  peerAvatar?: string;
  localMuted: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  remoteMuted: boolean;
  remoteCameraOn: boolean;
  remoteSpeaking: boolean;
  /** True while the peer is sharing their screen. We keep this separate
   *  from `remoteCameraOn` because they replace the camera track with the
   *  display track on the same video sender — peer's "camera" is technically
   *  off but the stream is still valid and should be rendered, not covered
   *  by the "turned off camera" placeholder. */
  remoteScreenSharing: boolean;
  networkQuality: NetworkQuality;
  error: string | null;
  durationSec: number;
  /** Surfaces "we couldn't access your hardware" UI without aborting via toast. */
  permissionIssue: PermissionFailure | null;
}

interface CallStoreActions {
  reset: () => void;
  setOutgoingRinging: (p: {
    callId: string | null;
    chatId: string;
    type: 'audio' | 'video';
    peerName: string;
    peerAvatar?: string;
    peerId: string;
  }) => void;
  setIncoming: (p: {
    callId: string;
    chatId: string;
    type: 'audio' | 'video';
    peerName: string;
    peerAvatar?: string;
    peerId: string;
  }) => void;
  setConnecting: () => void;
  setActive: () => void;
  setReconnecting: (v: boolean) => void;
  setMinimized: (v: boolean) => void;
  setFullscreen: (v: boolean) => void;
  setLocalMuted: (v: boolean) => void;
  setCameraOn: (v: boolean) => void;
  setScreenSharing: (v: boolean) => void;
  setRemoteMuted: (v: boolean) => void;
  setRemoteCameraOn: (v: boolean) => void;
  setRemoteSpeaking: (v: boolean) => void;
  setRemoteScreenSharing: (v: boolean) => void;
  setNetworkQuality: (q: NetworkQuality) => void;
  setError: (msg: string | null) => void;
  tickDuration: () => void;
  clearDuration: () => void;
  setCallId: (callId: string) => void;
  setPermissionIssue: (issue: PermissionFailure | null) => void;
}

const initial: CallStoreState = {
  phase: 'idle',
  minimized: false,
  fullscreen: false,
  callId: null,
  chatId: null,
  callType: null,
  role: null,
  peerId: null,
  peerName: '',
  peerAvatar: undefined,
  localMuted: false,
  cameraOn: true,
  screenSharing: false,
  remoteMuted: false,
  remoteCameraOn: true,
  remoteSpeaking: false,
  remoteScreenSharing: false,
  networkQuality: 'unknown',
  error: null,
  durationSec: 0,
  permissionIssue: null,
};

export const useCallStore = create<CallStoreState & CallStoreActions>((set) => ({
  ...initial,

  reset: () => set({ ...initial }),

  setOutgoingRinging: (p) =>
    set({
      phase: 'outgoing-ringing',
      callId: p.callId,
      chatId: p.chatId,
      callType: p.type,
      role: 'caller',
      peerId: p.peerId,
      peerName: p.peerName,
      peerAvatar: p.peerAvatar,
      error: null,
      durationSec: 0,
      minimized: false,
      localMuted: false,
      cameraOn: true,
      screenSharing: false,
      remoteMuted: false,
      remoteCameraOn: true,
      remoteSpeaking: false,
      remoteScreenSharing: false,
      networkQuality: 'unknown',
    }),

  setIncoming: (p) =>
    set({
      phase: 'incoming-ringing',
      callId: p.callId,
      chatId: p.chatId,
      callType: p.type,
      role: 'callee',
      peerId: p.peerId,
      peerName: p.peerName,
      peerAvatar: p.peerAvatar,
      error: null,
      durationSec: 0,
      minimized: false,
      localMuted: false,
      cameraOn: true,
      screenSharing: false,
      remoteMuted: false,
      remoteCameraOn: true,
      remoteSpeaking: false,
      remoteScreenSharing: false,
      networkQuality: 'unknown',
    }),

  setConnecting: () => set({ phase: 'connecting' }),
  setActive: () => set({ phase: 'active' }),
  setReconnecting: (v) => set({ phase: v ? 'reconnecting' : 'active' }),
  setMinimized: (v) => set({ minimized: v }),
  setFullscreen: (v) => set({ fullscreen: v }),
  setLocalMuted: (v) => set({ localMuted: v }),
  setCameraOn: (v) => set({ cameraOn: v }),
  setScreenSharing: (v) => set({ screenSharing: v }),
  setRemoteMuted: (v) => set({ remoteMuted: v }),
  setRemoteCameraOn: (v) => set({ remoteCameraOn: v }),
  setRemoteSpeaking: (v) => set({ remoteSpeaking: v }),
  setRemoteScreenSharing: (v) => set({ remoteScreenSharing: v }),
  setNetworkQuality: (q) => set({ networkQuality: q }),
  setError: (msg) => set({ error: msg }),
  tickDuration: () => set((s) => ({ durationSec: s.durationSec + 1 })),
  clearDuration: () => set({ durationSec: 0 }),
  setCallId: (callId) => set({ callId }),
  setPermissionIssue: (issue) => set({ permissionIssue: issue }),
}));
