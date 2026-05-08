/**
 * Notification sound — single shared HTMLAudioElement, played on demand.
 *
 * Browsers gate `audio.play()` behind a user gesture; the *first* call after
 * page load may reject if the user hasn't clicked anywhere yet. We swallow
 * that rejection silently and rely on subsequent gestures (which happen
 * constantly on a chat app) to enable playback. Calling `primeNotificationSound`
 * once on a user gesture is the cleanest way to guarantee playback even when
 * the tab is later backgrounded.
 */

let audio: HTMLAudioElement | null = null;
let primed = false;

const SRC = '/sounds/notification.mp3';

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!audio) {
    audio = new Audio(SRC);
    audio.preload = 'auto';
    audio.volume = 0.7;
  }
  return audio;
}

/** Call once on a real user gesture (click / keydown). Idempotent. */
export function primeNotificationSound(): void {
  if (primed) return;
  const a = ensureAudio();
  if (!a) return;
  /* Play muted at zero, then immediately reset — Chrome counts this as a
     successful gesture-driven start so later background plays don't fail. */
  const wasMuted = a.muted;
  a.muted = true;
  a.play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = wasMuted;
      primed = true;
    })
    .catch(() => {
      a.muted = wasMuted;
    });
}

/** Plays the notification chime if audio is available. Errors are swallowed. */
export function playNotificationSound(): void {
  const a = ensureAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
  } catch {
    /* Some browsers throw if the audio isn't loaded yet — safe to ignore. */
  }
  a.play().catch(() => {
    /* Autoplay blocked or no gesture yet — silent no-op. */
  });
}
