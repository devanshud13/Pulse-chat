/* Persisted auth state, kept in chrome.storage.local so it survives SW termination. */

const KEYS = {
  ACCESS: 'access_token',
  REFRESH: 'refresh_token',
  USER: 'user',
};

export async function getTokens() {
  const out = await chrome.storage.local.get([KEYS.ACCESS, KEYS.REFRESH, KEYS.USER]);
  return {
    accessToken: out[KEYS.ACCESS] || '',
    refreshToken: out[KEYS.REFRESH] || '',
    user: out[KEYS.USER] || null,
  };
}

export async function setTokens({ accessToken, refreshToken, user }) {
  const patch = {};
  if (typeof accessToken === 'string') patch[KEYS.ACCESS] = accessToken;
  if (typeof refreshToken === 'string') patch[KEYS.REFRESH] = refreshToken;
  if (user !== undefined) patch[KEYS.USER] = user;
  await chrome.storage.local.set(patch);
}

export async function clearTokens() {
  await chrome.storage.local.remove(Object.values(KEYS));
}
