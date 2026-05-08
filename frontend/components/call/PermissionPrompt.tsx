'use client';

import { motion } from 'framer-motion';
import { Camera, Mic, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PermissionFailure } from '@/lib/mediaPermissions';

interface Props {
  failure: PermissionFailure;
  onClose: () => void;
}

/**
 * Friendly "we need permission" overlay for the call flow. We can't unblock
 * the system permission programmatically, so the actionable copy varies by
 * the failure kind: hard denial → site settings link; insecure context →
 * HTTPS prompt; policy block → embedder hint; missing hardware → plain info.
 */
export function PermissionPrompt({ failure, onClose }: Props): JSX.Element {
  const title =
    failure.kind === 'unavailable'
      ? 'Device unavailable'
      : failure.kind === 'insecure-context'
        ? 'HTTPS required'
        : failure.kind === 'policy-blocked'
          ? 'Permissions blocked'
          : 'Permission needed';

  const lines: string[] = [];
  if (failure.kind === 'denied') {
    lines.push(
      `We need access to your ${
        failure.needsCamera ? 'camera and microphone' : 'microphone'
      } to start the call.`,
      'Click the lock icon in your address bar, set the permission to "Allow", then try again.',
    );
  } else if (failure.kind === 'insecure-context') {
    lines.push(
      'Browsers only allow camera and microphone access on HTTPS pages.',
      'Open the site over HTTPS and try again.',
    );
  } else if (failure.kind === 'policy-blocked') {
    lines.push(
      'A page-level Permissions Policy is blocking media access from this document.',
      'If you opened the chat inside an iframe or sandbox, open it directly to start a call.',
    );
  } else {
    lines.push(failure.message);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur"
    >
      <motion.div
        initial={{ scale: 0.95, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-card/95 to-card/80 p-6 shadow-2xl"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-500">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {failure.needsMic && (
                <span className="inline-flex items-center gap-1">
                  <Mic className="h-3 w-3" /> Microphone
                </span>
              )}
              {failure.needsCamera && (
                <span className="inline-flex items-center gap-1">
                  <Camera className="h-3 w-3" /> Camera
                </span>
              )}
            </div>
          </div>
        </div>
        <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          {lines.map((l) => (
            <li key={l}>• {l}</li>
          ))}
        </ul>
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Got it</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
