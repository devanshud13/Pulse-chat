/**
 * Centralized microphone / camera permission preflight. Browsers will
 * normally pop the system prompt the first time `getUserMedia` is called,
 * but only when the surrounding Permissions-Policy and secure-context rules
 * are satisfied. This helper provides a single funnel so the call manager
 * can distinguish between "user denied" and "your site is blocked from
 * even asking" — and surface different UI for each.
 */

export type PermissionFailure =
  | { kind: 'denied'; needsCamera: boolean; needsMic: boolean }
  | { kind: 'unavailable'; needsCamera: boolean; needsMic: boolean; message: string }
  | { kind: 'insecure-context'; needsCamera: boolean; needsMic: boolean }
  | { kind: 'policy-blocked'; needsCamera: boolean; needsMic: boolean };

export interface PermissionSuccess {
  kind: 'granted';
  stream: MediaStream;
}

export type PermissionResult = PermissionSuccess | PermissionFailure;

const isSecureContext = (): boolean =>
  typeof window !== 'undefined' && (window.isSecureContext || location.hostname === 'localhost');

/**
 * Checks whether Permissions-Policy / Feature-Policy actually allows the
 * features we need for this document. Browsers expose two different
 * surfaces for this — the older `document.featurePolicy` and the newer
 * `document.permissionsPolicy`. Either returning `false` definitively
 * means our HTTP header is wrong (or missing), and `getUserMedia` will
 * throw a `NotAllowedError` whose message *doesn't* mention "policy",
 * making it indistinguishable from a user denial. Detecting it ahead of
 * time lets us surface the correct fix-it copy.
 */
function policyAllows(feature: 'microphone' | 'camera'): boolean {
  if (typeof document === 'undefined') return true;
  const doc = document as Document & {
    featurePolicy?: { allowsFeature: (f: string) => boolean };
    permissionsPolicy?: { allowsFeature: (f: string) => boolean };
  };
  if (doc.permissionsPolicy?.allowsFeature) return doc.permissionsPolicy.allowsFeature(feature);
  if (doc.featurePolicy?.allowsFeature) return doc.featurePolicy.allowsFeature(feature);
  return true;
}

/**
 * Acquires user media with full error classification. Returns a stream on
 * success; a rich failure object otherwise so callers can render a useful
 * "why this failed and how to fix it" prompt.
 */
export async function requestCallMedia(kind: 'audio' | 'video'): Promise<PermissionResult> {
  const needsMic = true;
  const needsCamera = kind === 'video';

  if (!isSecureContext()) {
    return { kind: 'insecure-context', needsCamera, needsMic };
  }
  if (!navigator?.mediaDevices?.getUserMedia) {
    return {
      kind: 'unavailable',
      needsCamera,
      needsMic,
      message: 'Your browser does not support media capture',
    };
  }
  if (!policyAllows('microphone') || (needsCamera && !policyAllows('camera'))) {
    return { kind: 'policy-blocked', needsCamera, needsMic };
  }

  const constraints: MediaStreamConstraints =
    kind === 'audio'
      ? { audio: { echoCancellation: true, noiseSuppression: true }, video: false }
      : {
          audio: { echoCancellation: true, noiseSuppression: true },
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return { kind: 'granted', stream };
  } catch (e) {
    const err = e as DOMException;
    /* The Permissions-Policy block usually shows up *before* the catch
     * via the preflight `policyAllows()` check above. Some Chromium
     * versions still throw NotAllowedError without that signal, so we
     * also string-match for "policy" / "feature policy" / "blocked by"
     * wording as a backup classification. Fall back to plain denial
     * otherwise. */
    const msg = (err?.message ?? '').toLowerCase();
    if (msg.includes('policy') || msg.includes('blocked by')) {
      return { kind: 'policy-blocked', needsCamera, needsMic };
    }
    if (
      err?.name === 'NotFoundError' ||
      err?.name === 'OverconstrainedError' ||
      err?.name === 'NotReadableError'
    ) {
      return {
        kind: 'unavailable',
        needsCamera,
        needsMic,
        message:
          err?.name === 'NotReadableError'
            ? 'Camera or microphone is being used by another app'
            : 'No camera or microphone was found',
      };
    }
    return { kind: 'denied', needsCamera, needsMic };
  }
}
