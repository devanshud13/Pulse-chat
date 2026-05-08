import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Defense-in-depth Permissions-Policy header. We already declare this in
 * `next.config.mjs#headers()` but middleware runs at the edge for *every*
 * response (including dynamic / streamed routes that occasionally bypass
 * static `headers` rules in older Next builds). Setting it here too
 * guarantees `getUserMedia` works on the call screen no matter how the
 * route is rendered.
 *
 * `(self)` means the feature is allowed on this exact origin only — the
 * page is not embeddable in someone else's iframe with mic/camera access,
 * which is exactly what we want for a chat app.
 */
const POLICY = [
  'microphone=(self)',
  'camera=(self)',
  'display-capture=(self)',
  'autoplay=(self)',
].join(', ');

export function middleware(_req: NextRequest): NextResponse {
  const res = NextResponse.next();
  res.headers.set('Permissions-Policy', POLICY);
  return res;
}

export const config = {
  /* Skip Next internals and static assets — they don't need the header
     and excluding them keeps the edge function invocation count low. */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sounds|icons).*)'],
};
