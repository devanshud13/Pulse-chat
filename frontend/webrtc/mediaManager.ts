export type CaptureKind = 'audio' | 'video';

export interface LocalMediaHandles {
  stream: MediaStream;
  stop: () => void;
}

/**
 * Acquires microphone / camera. Callers should invoke `stop()` on teardown
 * to release hardware promptly (critical on mobile).
 */
export async function acquireLocalMedia(kind: CaptureKind): Promise<LocalMediaHandles> {
  const constraints: MediaStreamConstraints =
    kind === 'audio'
      ? { audio: { echoCancellation: true, noiseSuppression: true }, video: false }
      : {
          audio: { echoCancellation: true, noiseSuppression: true },
          video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  const stop = (): void => {
    stream.getTracks().forEach((t) => {
      t.stop();
    });
  };

  return { stream, stop };
}

export async function acquireDisplayMedia(): Promise<LocalMediaHandles> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 30 } },
    audio: true,
  });
  const stop = (): void => {
    stream.getTracks().forEach((t) => t.stop());
  };
  return { stream, stop };
}
