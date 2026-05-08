import { getSocket } from '@/services/socket';
import { useAuthStore } from '@/store/auth.store';
import { useCallStore } from '@/store/call.store';
import { toast } from 'sonner';
import { createPeerConnection, bindRemoteStream } from './peerConnection';
import { acquireLocalMedia, acquireDisplayMedia } from './mediaManager';

type WireSdp = RTCSessionDescriptionInit;

interface CallCreatedPayload {
  callId: string;
  calleeId: string;
  chatId: string;
  type: 'audio' | 'video';
}

interface IncomingPayload {
  callId: string;
  chatId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  type: 'audio' | 'video';
}

interface AcceptedPayload {
  callId: string;
  chatId: string;
  calleeId?: string;
  callerId?: string;
  type: 'audio' | 'video';
}

export class WebRtcCallManager {
  private listeners = new Set<() => void>();
  private socketBound = false;

  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private localStop: (() => void) | null = null;
  private remoteStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private screenStop: (() => void) | null = null;

  private pendingRemoteIce: RTCIceCandidateInit[] = [];
  private hasSetRemoteDescription = false;

  private durationTimer: ReturnType<typeof setInterval> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private ringAudio: HTMLAudioElement | null = null;

  private connectedAt = 0;
  private lastAudioBytes = 0;
  private lastStatsTime = 0;
  private iceRestartAttempted = false;

  subscribeStreams(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emitStreams(): void {
    this.listeners.forEach((fn) => fn());
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  bindSocket(): void {
    if (this.socketBound) return;
    this.socketBound = true;
    const socket = getSocket();

    socket.on('call:created', this.onCallCreated);
    socket.on('incoming-call', this.onIncomingCall);
    socket.on('call:accepted', this.onCallAccepted);
    socket.on('call:rejected', this.onCallRejected);
    socket.on('call:timeout', this.onCallTimeout);
    socket.on('call-busy', this.onCallBusy);
    socket.on('call:ended', this.onCallEnded);
    socket.on('call:error', this.onCallError);
    socket.on('webrtc-offer', this.onOffer);
    socket.on('webrtc-answer', this.onAnswer);
    socket.on('ice-candidate', this.onIce);
    socket.on('peer-toggle-mic', this.onPeerMic);
    socket.on('peer-toggle-camera', this.onPeerCam);
  }

  unbindSocket(): void {
    if (!this.socketBound) return;
    const socket = getSocket();
    socket.off('call:created', this.onCallCreated);
    socket.off('incoming-call', this.onIncomingCall);
    socket.off('call:accepted', this.onCallAccepted);
    socket.off('call:rejected', this.onCallRejected);
    socket.off('call:timeout', this.onCallTimeout);
    socket.off('call-busy', this.onCallBusy);
    socket.off('call:ended', this.onCallEnded);
    socket.off('call:error', this.onCallError);
    socket.off('webrtc-offer', this.onOffer);
    socket.off('webrtc-answer', this.onAnswer);
    socket.off('ice-candidate', this.onIce);
    socket.off('peer-toggle-mic', this.onPeerMic);
    socket.off('peer-toggle-camera', this.onPeerCam);
    this.socketBound = false;
  }

  /** Outgoing: show UI immediately, then ask server to ring peer. */
  startOutgoing(
    chatId: string,
    type: 'audio' | 'video',
    peer: { id: string; name: string; avatar?: string },
  ): void {
    useCallStore.getState().setOutgoingRinging({
      callId: null,
      chatId,
      type,
      peerId: peer.id,
      peerName: peer.name,
      peerAvatar: peer.avatar,
    });
    getSocket().emit('call-user', { chatId, type });
  }

  cancelOutgoingIfPending(): void {
    const { phase, callId } = useCallStore.getState();
    if (phase === 'outgoing-ringing' && !callId) {
      useCallStore.getState().reset();
    }
  }

  acceptIncoming(): void {
    const { callId, callType } = useCallStore.getState();
    if (!callId || !callType) return;
    this.stopRingtone();
    useCallStore.getState().setConnecting();
    void (async () => {
      await this.prepareCalleeMedia(callType);
      const st = useCallStore.getState();
      if (!st.callId || st.callId !== callId || st.phase === 'idle') return;
      getSocket().emit('accept-call', { callId });
    })();
  }

  rejectIncoming(): void {
    const { callId } = useCallStore.getState();
    this.stopRingtone();
    if (callId) getSocket().emit('reject-call', { callId });
    this.cleanupPeer();
    useCallStore.getState().reset();
  }

  endCall(): void {
    const { callId } = useCallStore.getState();
    const durationSec =
      this.connectedAt > 0 ? Math.max(0, Math.floor((Date.now() - this.connectedAt) / 1000)) : 0;
    if (callId) {
      getSocket().emit('end-call', { callId, durationSec });
    }
    this.stopRingtone();
    this.cleanupPeer();
    useCallStore.getState().reset();
  }

  toggleMic(): void {
    const { callId, localMuted } = useCallStore.getState();
    if (!this.localStream || !callId) return;
    const next = !localMuted;
    this.localStream.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    useCallStore.getState().setLocalMuted(next);
    getSocket().emit('toggle-mic', { callId, muted: next });
  }

  toggleCamera(): void {
    const { callId, cameraOn } = useCallStore.getState();
    if (!this.localStream || !callId) return;
    const nextOff = cameraOn;
    this.localStream.getVideoTracks().forEach((t) => {
      t.enabled = !nextOff;
    });
    useCallStore.getState().setCameraOn(!nextOff);
    getSocket().emit('toggle-camera', { callId, enabled: !nextOff });
  }

  async switchCamera(): Promise<void> {
    if (!this.pc || !this.localStream) return;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    const settings = videoTrack.getSettings();
    const facing = settings.facingMode === 'environment' ? 'user' : 'environment';
    const next = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing } },
      audio: false,
    });
    const nv = next.getVideoTracks()[0];
    if (!nv) return;
    this.localStream.removeTrack(videoTrack);
    videoTrack.stop();
    this.localStream.addTrack(nv);
    const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
    if (sender) await sender.replaceTrack(nv);
    this.emitStreams();
  }

  async toggleScreenShare(): Promise<void> {
    const { callId, screenSharing, callType } = useCallStore.getState();
    if (!this.pc || !callId || callType !== 'video') return;

    if (screenSharing) {
      this.screenStop?.();
      this.screenStop = null;
      this.screenStream = null;
      useCallStore.getState().setScreenSharing(false);
      const cam = this.localStream?.getVideoTracks()[0];
      const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender && cam) await sender.replaceTrack(cam);
      return;
    }

    try {
      const { stream, stop } = await acquireDisplayMedia();
      this.screenStream = stream;
      this.screenStop = stop;
      const v = stream.getVideoTracks()[0];
      const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender && v) await sender.replaceTrack(v);
      useCallStore.getState().setScreenSharing(true);
      v.onended = () => {
        void this.toggleScreenShare();
      };
    } catch {
      toast.error('Screen share was blocked or cancelled');
    }
  }

  private readonly onCallCreated = (p: CallCreatedPayload): void => {
    useCallStore.getState().setCallId(p.callId);
  };

  private readonly onIncomingCall = (p: IncomingPayload): void => {
    const me = useAuthStore.getState().user?._id;
    if (p.callerId === me) return;
    useCallStore.getState().setIncoming({
      callId: p.callId,
      chatId: p.chatId,
      type: p.type,
      peerId: p.callerId,
      peerName: p.callerName,
      peerAvatar: p.callerAvatar,
    });
    this.playRingtone();
  };

  private readonly onCallAccepted = (p: AcceptedPayload): void => {
    this.stopRingtone();
    const role = useCallStore.getState().role;
    if (role === 'caller') {
      useCallStore.getState().setConnecting();
      void this.runCallerNegotiation(p);
    }
  };

  private readonly onCallRejected = (): void => {
    this.stopRingtone();
    toast.message('Call declined');
    this.cleanupPeer();
    useCallStore.getState().reset();
  };

  private readonly onCallTimeout = (): void => {
    this.stopRingtone();
    toast.message('Call timed out');
    this.cleanupPeer();
    useCallStore.getState().reset();
  };

  private readonly onCallBusy = (): void => {
    toast.error('User is busy');
    this.cleanupPeer();
    useCallStore.getState().reset();
  };

  private readonly onCallEnded = (): void => {
    this.stopRingtone();
    this.cleanupPeer();
    useCallStore.getState().reset();
  };

  private readonly onCallError = (p: { message?: string }): void => {
    toast.error(p?.message ?? 'Call error');
    this.cleanupPeer();
    useCallStore.getState().reset();
  };

  private readonly onPeerMic = (p: { callId: string; muted: boolean }): void => {
    if (p.callId !== useCallStore.getState().callId) return;
    useCallStore.getState().setRemoteMuted(p.muted);
  };

  private readonly onPeerCam = (p: { callId: string; enabled: boolean }): void => {
    if (p.callId !== useCallStore.getState().callId) return;
    useCallStore.getState().setRemoteCameraOn(p.enabled);
  };

  private readonly onOffer = async (p: { callId: string; sdp: WireSdp }): Promise<void> => {
    const st = useCallStore.getState();
    if (p.callId !== st.callId || st.role !== 'callee') return;
    let attempts = 0;
    while (!this.localStream && attempts < 120 && useCallStore.getState().callId === p.callId) {
      await new Promise((r) => setTimeout(r, 50));
      attempts += 1;
    }
    if (!this.localStream) {
      toast.error('Could not prepare media for this call');
      return;
    }
    try {
      if (!this.pc) {
        this.ensureCalleePc();
      }
      if (!this.pc) return;
      await this.pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
      this.hasSetRemoteDescription = true;
      await this.flushIceQueue();
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      getSocket().emit('webrtc-answer', { callId: p.callId, sdp: this.pc.localDescription ?? answer });
      this.wireConnectionLifecycle();
    } catch {
      toast.error('Could not answer call');
      this.endCall();
    }
  };

  private readonly onAnswer = async (p: { callId: string; sdp: WireSdp }): Promise<void> => {
    const st = useCallStore.getState();
    if (p.callId !== st.callId || st.role !== 'caller') return;
    try {
      if (!this.pc) return;
      await this.pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
      this.hasSetRemoteDescription = true;
      await this.flushIceQueue();
      this.wireConnectionLifecycle();
    } catch {
      toast.error('Could not complete connection');
      this.endCall();
    }
  };

  private readonly onIce = async (p: { callId: string; candidate: RTCIceCandidateInit | null }): Promise<void> => {
    if (p.callId !== useCallStore.getState().callId) return;
    if (p.candidate === null) return;
    if (!this.pc) {
      this.pendingRemoteIce.push(p.candidate);
      return;
    }
    if (!this.hasSetRemoteDescription) {
      this.pendingRemoteIce.push(p.candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(p.candidate);
    } catch {
      /* ignore stale */
    }
  };

  private async flushIceQueue(): Promise<void> {
    if (!this.pc) return;
    const batch = this.pendingRemoteIce.splice(0, this.pendingRemoteIce.length);
    for (const c of batch) {
      try {
        await this.pc.addIceCandidate(c);
      } catch {
        /* ignore */
      }
    }
  }

  private async prepareCalleeMedia(kind: 'audio' | 'video'): Promise<void> {
    try {
      this.releaseLocalMedia();
      const cap: 'audio' | 'video' = kind === 'audio' ? 'audio' : 'video';
      const { stream, stop } = await acquireLocalMedia(cap);
      this.localStream = stream;
      this.localStop = stop;
      useCallStore.getState().setCameraOn(stream.getVideoTracks().length > 0);
      this.emitStreams();
    } catch {
      toast.error('Microphone or camera permission denied');
      const { callId } = useCallStore.getState();
      if (callId) getSocket().emit('reject-call', { callId });
      this.cleanupPeer();
      useCallStore.getState().reset();
    }
  }

  private async runCallerNegotiation(p: AcceptedPayload): Promise<void> {
    const kind = p.type;
    const callId = useCallStore.getState().callId;
    if (!callId) return;
    try {
      this.releaseLocalMedia();
      const { stream, stop } = await acquireLocalMedia(kind === 'audio' ? 'audio' : 'video');
      this.localStream = stream;
      this.localStop = stop;
      useCallStore.getState().setCameraOn(stream.getVideoTracks().length > 0);
      this.emitStreams();

      this.pc = createPeerConnection();
      bindRemoteStream(this.pc, (stream) => {
        this.remoteStream = stream;
        this.emitStreams();
      });

      stream.getTracks().forEach((track) => {
        this.pc?.addTrack(track, stream);
      });

      this.pc.onicecandidate = (ev) => {
        const id = useCallStore.getState().callId;
        if (ev.candidate && id) {
          getSocket().emit('ice-candidate', {
            callId: id,
            candidate: ev.candidate.toJSON(),
          });
        }
      };

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.hasSetRemoteDescription = false;
      getSocket().emit('webrtc-offer', {
        callId,
        sdp: this.pc.localDescription ?? offer,
      });
      this.wireConnectionLifecycle();
    } catch {
      toast.error('Could not start media');
      this.endCall();
    }
  }

  private ensureCalleePc(): void {
    const st = useCallStore.getState();
    if (!this.localStream || !st.callId) return;
    if (this.pc) return;

    this.pc = createPeerConnection();
    bindRemoteStream(this.pc, (stream) => {
      this.remoteStream = stream;
      this.emitStreams();
    });

    this.localStream.getTracks().forEach((t) => {
      this.pc?.addTrack(t, this.localStream!);
    });

    this.pc.onicecandidate = (ev) => {
      const id = useCallStore.getState().callId;
      if (ev.candidate && id) {
        getSocket().emit('ice-candidate', {
          callId: id,
          candidate: ev.candidate.toJSON(),
        });
      }
    };
    this.hasSetRemoteDescription = false;
  }

  private wireConnectionLifecycle(): void {
    if (!this.pc) return;
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      if (state === 'connected') {
        useCallStore.getState().setActive();
        useCallStore.getState().setReconnecting(false);
        this.iceRestartAttempted = false;
        if (this.connectedAt === 0) {
          this.connectedAt = Date.now();
          useCallStore.getState().clearDuration();
          this.durationTimer = setInterval(() => {
            useCallStore.getState().tickDuration();
          }, 1000);
          this.startStatsLoop();
        }
      }
      if (state === 'disconnected') {
        useCallStore.getState().setReconnecting(true);
      }
      if (state === 'failed') {
        void this.tryIceRestart();
      }
    };
  }

  private async tryIceRestart(): Promise<void> {
    if (!this.pc || this.iceRestartAttempted) {
      toast.error('Connection lost');
      this.endCall();
      return;
    }
    this.iceRestartAttempted = true;
    try {
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      const { callId, role } = useCallStore.getState();
      if (!callId) return;
      if (role === 'caller') {
        getSocket().emit('webrtc-offer', { callId, sdp: this.pc.localDescription ?? offer });
      }
    } catch {
      this.endCall();
    }
  }

  private startStatsLoop(): void {
    this.stopStatsLoop();
    this.lastAudioBytes = 0;
    this.lastStatsTime = performance.now();
    this.statsTimer = setInterval(() => {
      void this.pollStats();
    }, 2000);
  }

  private stopStatsLoop(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  private async pollStats(): Promise<void> {
    if (!this.pc) return;
    const report = await this.pc.getStats();
    let audioBytes = 0;
    let packetsReceived = 0;
    let packetsLost = 0;
    report.forEach((r) => {
      if (r.type === 'inbound-rtp' && 'kind' in r && r.kind === 'audio') {
        const bytes = 'bytesReceived' in r ? Number(r.bytesReceived) : 0;
        audioBytes = Math.max(audioBytes, bytes);
        if ('packetsReceived' in r) packetsReceived += Number(r.packetsReceived);
        if ('packetsLost' in r) packetsLost += Number(r.packetsLost);
      }
    });
    const now = performance.now();
    const delta = now - this.lastStatsTime;
    const speaking = delta > 0 && audioBytes > this.lastAudioBytes + 50;
    this.lastAudioBytes = audioBytes;
    this.lastStatsTime = now;
    useCallStore.getState().setRemoteSpeaking(speaking);

    const lossRate =
      packetsReceived + packetsLost > 0 ? packetsLost / (packetsReceived + packetsLost) : 0;
    if (packetsReceived === 0) {
      useCallStore.getState().setNetworkQuality('unknown');
    } else if (lossRate < 0.02) {
      useCallStore.getState().setNetworkQuality('good');
    } else if (lossRate < 0.08) {
      useCallStore.getState().setNetworkQuality('fair');
    } else {
      useCallStore.getState().setNetworkQuality('poor');
    }
  }

  private playRingtone(): void {
    if (typeof window === 'undefined') return;
    if (!this.ringAudio) {
      this.ringAudio = new Audio('/sounds/notification.mp3');
      this.ringAudio.loop = true;
      this.ringAudio.volume = 0.55;
    }
    void this.ringAudio.play().catch(() => {
      /* autoplay blocked until gesture */
    });
  }

  private stopRingtone(): void {
    if (this.ringAudio) {
      this.ringAudio.pause();
      this.ringAudio.currentTime = 0;
    }
  }

  private releaseLocalMedia(): void {
    this.localStop?.();
    this.localStop = null;
    this.localStream = null;
    this.screenStop?.();
    this.screenStop = null;
    this.screenStream = null;
    this.emitStreams();
  }

  private cleanupPeer(): void {
    this.stopRingtone();
    this.stopStatsLoop();
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
    this.connectedAt = 0;
    this.pendingRemoteIce = [];
    this.hasSetRemoteDescription = false;
    this.iceRestartAttempted = false;
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.ontrack = null;
      this.pc.close();
      this.pc = null;
    }
    this.releaseLocalMedia();
    this.remoteStream = null;
    this.emitStreams();
  }
}

export const webRtcCallManager = new WebRtcCallManager();
