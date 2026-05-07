/**
 * Runtime configuration for the extension. Edit these defaults before publishing,
 * or override at runtime via chrome.storage.local (`api_url`, `socket_url`, `frontend_url`).
 */
export const DEFAULTS = Object.freeze({
  API_URL: 'http://localhost:5000/api/v1',
  SOCKET_URL: 'http://localhost:5000',
  FRONTEND_URL: 'http://localhost:3000',
});

const KEYS = ['api_url', 'socket_url', 'frontend_url'];

export async function getConfig() {
  const stored = await chrome.storage.local.get(KEYS);
  return {
    apiUrl: stored.api_url || DEFAULTS.API_URL,
    socketUrl: stored.socket_url || DEFAULTS.SOCKET_URL,
    frontendUrl: stored.frontend_url || DEFAULTS.FRONTEND_URL,
  };
}

export async function setConfig(patch) {
  const next = {};
  if (patch.apiUrl) next.api_url = patch.apiUrl;
  if (patch.socketUrl) next.socket_url = patch.socketUrl;
  if (patch.frontendUrl) next.frontend_url = patch.frontendUrl;
  await chrome.storage.local.set(next);
}
