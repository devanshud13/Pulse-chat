import { defaultRtcConfiguration } from './iceConfig';

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection(defaultRtcConfiguration());
}

export function bindRemoteStream(
  pc: RTCPeerConnection,
  onTrack: (stream: MediaStream) => void,
): void {
  pc.ontrack = (ev: RTCTrackEvent) => {
    const [stream] = ev.streams;
    if (stream) onTrack(stream);
  };
}
