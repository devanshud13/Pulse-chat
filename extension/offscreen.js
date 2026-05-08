/**
 * Persistent Socket.IO connection lives in this offscreen document so it
 * survives the service worker's idle termination cycle. The page receives
 * commands from background.js via chrome.runtime.onMessage.
 *
 * Audio playback also runs here (offscreen reason AUDIO_PLAYBACK), used to
 * play the notification chime when no Pulse website tab is open.
 */

let socket = null;
let currentToken = '';
let chime = null;

function playChime() {
  try {
    if (!chime) {
      chime = new Audio(chrome.runtime.getURL('sounds/notification.mp3'));
      chime.preload = 'auto';
      chime.volume = 0.8;
    }
    chime.currentTime = 0;
    const p = chime.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('[pulse-offscreen] audio play failed', err));
    }
  } catch (err) {
    console.warn('[pulse-offscreen] audio init failed', err);
  }
}

function getSocketUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['socket_url'], (out) => {
      resolve(out.socket_url || 'http://localhost:5000');
    });
  });
}

async function connect(token) {
  currentToken = token;
  if (!token) return;
  if (typeof io === 'undefined') {
    console.warn('[pulse-offscreen] socket.io client unavailable');
    return;
  }
  if (socket && socket.connected) {
    if (socket.auth?.token === token) return;
    socket.auth = { token };
    socket.disconnect().connect();
    return;
  }
  if (socket) socket.disconnect();

  const url = await getSocketUrl();
  socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 8000,
  });

  socket.on('connect', () => {
    console.log('[pulse-offscreen] connected');
  });

  socket.on('connect_error', (err) => {
    console.warn('[pulse-offscreen] connect_error', err?.message || err);
  });

  socket.on('disconnect', (reason) => {
    console.log('[pulse-offscreen] disconnected', reason);
  });

  socket.on('notification:new', (payload) => {
    chrome.runtime.sendMessage({
      target: 'background',
      type: 'OFFSCREEN_NOTIFICATION',
      payload,
    });
  });

  socket.on('message:new', () => {
    chrome.runtime.sendMessage({
      target: 'background',
      type: 'OFFSCREEN_STATUS',
    });
  });
}

function disconnect() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentToken = '';
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.target !== 'offscreen') return;
  void (async () => {
    switch (message.type) {
      case 'CONNECT':
        await connect(message.payload?.token || '');
        sendResponse({ ok: true });
        break;
      case 'DISCONNECT':
        disconnect();
        sendResponse({ ok: true });
        break;
      case 'RECONNECT':
        if (currentToken) await connect(currentToken);
        sendResponse({ ok: true });
        break;
      case 'PING':
        if (socket && !socket.connected && currentToken) {
          await connect(currentToken);
        }
        sendResponse({ ok: true });
        break;
      case 'PLAY_SOUND':
        playChime();
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ ok: false });
    }
  })();
  return true;
});

(async () => {
  const out = await chrome.storage.local.get(['access_token']);
  if (out.access_token) {
    await connect(out.access_token);
  }
})();
