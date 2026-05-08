'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useCallStore } from '@/store/call.store';
import { webRtcCallManager } from '@/webrtc/callManager';
import { IncomingCallModal } from './IncomingCallModal';
import { ActiveCallShell } from './ActiveCallShell';
import { PermissionPrompt } from './PermissionPrompt';

export function CallRoot(): JSX.Element {
  const userId = useAuthStore((s) => s.user?._id ?? null);
  const phase = useCallStore((s) => s.phase);
  const peerName = useCallStore((s) => s.peerName);
  const peerAvatar = useCallStore((s) => s.peerAvatar);
  const peerId = useCallStore((s) => s.peerId);
  const callType = useCallStore((s) => s.callType);
  const permissionIssue = useCallStore((s) => s.permissionIssue);
  const setPermissionIssue = useCallStore((s) => s.setPermissionIssue);

  useEffect(() => {
    if (!userId) {
      webRtcCallManager.unbindSocket();
      return;
    }
    webRtcCallManager.bindSocket();
  }, [userId]);

  if (!userId) return <></>;

  return (
    <>
      {phase === 'incoming-ringing' && peerId && callType && (
        <IncomingCallModal
          peerId={peerId}
          peerName={peerName}
          peerAvatar={peerAvatar}
          callType={callType}
          onAccept={() => webRtcCallManager.acceptIncoming()}
          onReject={() => webRtcCallManager.rejectIncoming()}
        />
      )}
      <ActiveCallShell phase={phase} />
      {permissionIssue && (
        <PermissionPrompt
          failure={permissionIssue}
          onClose={() => setPermissionIssue(null)}
        />
      )}
    </>
  );
}
