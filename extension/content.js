/**
 * Content script: listens for postMessage events from the Pulse Chat
 * frontend and forwards JWT tokens (or logout) to the background worker.
 * Also performs a one-shot sync when the page first loads, by reading
 * the tokens from localStorage if available.
 */

(function () {
  const ALLOWED_TYPES = new Set(['CHAT_AUTH_TOKEN', 'CHAT_AUTH_LOGOUT']);

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (!ALLOWED_TYPES.has(data.type)) return;

    if (data.type === 'CHAT_AUTH_TOKEN') {
      chrome.runtime.sendMessage({
        target: 'background',
        type: 'AUTH_SET',
        payload: { accessToken: data.accessToken, refreshToken: data.refreshToken },
      });
    } else if (data.type === 'CHAT_AUTH_LOGOUT') {
      chrome.runtime.sendMessage({ target: 'background', type: 'AUTH_LOGOUT' });
    }
  });

  try {
    const access = window.localStorage.getItem('chat_access_token');
    const refresh = window.localStorage.getItem('chat_refresh_token');
    if (access && refresh) {
      chrome.runtime.sendMessage({
        target: 'background',
        type: 'AUTH_SET',
        payload: { accessToken: access, refreshToken: refresh },
      });
    }
  } catch {
    /* localStorage may be blocked on some pages — ignore. */
  }
})();
