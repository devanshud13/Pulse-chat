import { getConfig } from './config.js';
import { getTokens, setTokens, clearTokens } from './auth.js';

async function refreshAccess() {
  const { apiUrl } = await getConfig();
  const { refreshToken } = await getTokens();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      await clearTokens();
      return null;
    }
    const json = await res.json();
    const access = json?.data?.accessToken;
    const newRefresh = json?.data?.refreshToken;
    if (access) {
      await setTokens({ accessToken: access, refreshToken: newRefresh ?? refreshToken });
      return access;
    }
    return null;
  } catch {
    return null;
  }
}

export async function authedFetch(path, init = {}) {
  const { apiUrl } = await getConfig();
  let { accessToken } = await getTokens();
  if (!accessToken) return null;

  const doFetch = (token) =>
    fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

  let res = await doFetch(accessToken);
  if (res.status === 401) {
    const refreshed = await refreshAccess();
    if (!refreshed) return null;
    accessToken = refreshed;
    res = await doFetch(accessToken);
  }
  if (!res.ok) return null;
  return res.json();
}

export async function fetchUnreadTotal() {
  const json = await authedFetch('/messages/unread/total');
  return json?.data?.count ?? 0;
}

export async function fetchMe() {
  const json = await authedFetch('/users/me');
  return json?.data ?? null;
}
