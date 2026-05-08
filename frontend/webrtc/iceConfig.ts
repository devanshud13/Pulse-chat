/**
 * Builds RTCIceServer[] from public env. STUN defaults to Google public STUN.
 * TURN is only added when URL + username + credential are all set.
 */
export function buildIceServers(): RTCIceServer[] {
  const rawStun = process.env.NEXT_PUBLIC_STUN_URL?.trim();
  const stunUrls = rawStun
    ? rawStun.split(',').map((u) => u.trim()).filter(Boolean)
    : ['stun:stun.l.google.com:19302'];

  const servers: RTCIceServer[] = stunUrls.map((urls) => ({ urls }));

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL?.trim();
  const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME?.trim();
  const turnCred = process.env.NEXT_PUBLIC_TURN_CREDENTIAL?.trim();
  if (turnUrl && turnUser && turnCred) {
    const turnUrls = turnUrl.split(',').map((u) => u.trim()).filter(Boolean);
    if (turnUrls.length > 0) {
      servers.push({
        urls: turnUrls,
        username: turnUser,
        credential: turnCred,
      });
    }
  }

  return servers;
}

export const defaultRtcConfiguration = (): RTCConfiguration => ({
  iceServers: buildIceServers(),
  iceCandidatePoolSize: 10,
});
