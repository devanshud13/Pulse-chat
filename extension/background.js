import { getConfig, setConfig } from './utils/config.js';
import { getTokens, setTokens, clearTokens } from './utils/auth.js';
import { fetchUnreadTotal, fetchMe } from './utils/api.js';

const ALARM_NAME = 'pulse-poll';
const OFFSCREEN_DOCUMENT = chrome.runtime.getURL('offscreen.html');

async function hasOffscreen() {
  if (!chrome.runtime.getContexts) return false;
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [OFFSCREEN_DOCUMENT],
  });
  return contexts.length > 0;
}

async function ensureOffscreen() {
  try {
    if (await hasOffscreen()) return;
    /* AUDIO_PLAYBACK lets the offscreen page play the notification chime when
       the user has no Pulse tab open; the other reasons keep the persistent
       Socket.IO connection alive on Chrome's idle worker cycle. */
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['BLOBS', 'WORKERS', 'AUDIO_PLAYBACK'],
      justification:
        'Maintain a persistent Socket.IO connection and play notification sound for incoming chat messages.',
    });
  } catch (err) {
    console.warn('[pulse] offscreen create failed', err);
  }
}

/**
 * True when at least one tab on the configured frontend origin is open. We use
 * this to suppress the extension's own chime when the website is already
 * playing it in-tab — otherwise the user would hear the sound twice.
 */
async function isWebsiteTabOpen() {
  try {
    const { frontendUrl } = await getConfig();
    if (!frontendUrl) return false;
    const url = new URL(frontendUrl);
    const tabs = await chrome.tabs.query({ url: `${url.origin}/*` });
    return Array.isArray(tabs) && tabs.length > 0;
  } catch (err) {
    console.warn('[pulse] tab query failed', err);
    return false;
  }
}

async function closeOffscreen() {
  try {
    if (await hasOffscreen()) {
      await chrome.offscreen.closeDocument();
    }
  } catch (err) {
    console.warn('[pulse] offscreen close failed', err);
  }
}

async function notifyOffscreen(type, payload) {
  try {
    await chrome.runtime.sendMessage({ target: 'offscreen', type, payload });
  } catch {
    /* offscreen not yet listening */
  }
}

async function setBadge(count) {
  await chrome.action.setBadgeBackgroundColor({ color: '#7c3aed' });
  await chrome.action.setBadgeTextColor?.({ color: '#ffffff' }).catch(() => undefined);
  await chrome.action.setBadgeText({ text: count > 0 ? (count > 99 ? '99+' : String(count)) : '' });
}

async function showNotification(payload) {
  const id = `pulse-${payload.messageId || Date.now()}`;
  await chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title: payload.title || 'New message',
    message: payload.body || '',
    priority: 2,
  });
  if (payload.chatId) {
    await chrome.storage.session?.set?.({ [id]: payload.chatId }).catch(() => undefined);
    await chrome.storage.local.set({ [`notif:${id}`]: payload.chatId });
  }
  /* Only play the chime when there is no open Pulse tab — the website plays
     its own sound when one of its tabs is loaded, even in the background. */
  if (!(await isWebsiteTabOpen())) {
    await ensureOffscreen();
    await notifyOffscreen('PLAY_SOUND', {});
  }
}

async function syncFromServer() {
  const { accessToken } = await getTokens();
  if (!accessToken) {
    await setBadge(0);
    return;
  }
  const total = await fetchUnreadTotal();
  await setBadge(total);
}

async function startup() {
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 });
  const { accessToken } = await getTokens();
  if (accessToken) {
    await ensureOffscreen();
    await notifyOffscreen('CONNECT', { token: accessToken });
    await syncFromServer();
  } else {
    await setBadge(0);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void startup();
});
chrome.runtime.onStartup.addListener(() => {
  void startup();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  void (async () => {
    const { accessToken } = await getTokens();
    if (accessToken) {
      await ensureOffscreen();
      await notifyOffscreen('PING', {});
      await syncFromServer();
    } else {
      await setBadge(0);
      await closeOffscreen();
    }
  })();
});

chrome.notifications.onClicked.addListener(async (id) => {
  const stored = await chrome.storage.local.get(`notif:${id}`);
  const chatId = stored[`notif:${id}`];
  const { frontendUrl } = await getConfig();
  const url = chatId ? `${frontendUrl}/chat/${chatId}` : `${frontendUrl}/chat`;
  await chrome.tabs.create({ url });
  await chrome.notifications.clear(id);
  await chrome.storage.local.remove(`notif:${id}`);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    if (!message || typeof message !== 'object') return sendResponse({ ok: false });

    if (message.target && message.target !== 'background') return;

    switch (message.type) {
      case 'AUTH_SET': {
        await setTokens({
          accessToken: message.payload?.accessToken,
          refreshToken: message.payload?.refreshToken,
        });
        const me = await fetchMe();
        if (me) await setTokens({ user: me });
        await ensureOffscreen();
        await notifyOffscreen('CONNECT', { token: message.payload?.accessToken });
        await syncFromServer();
        return sendResponse({ ok: true });
      }
      case 'AUTH_LOGOUT': {
        await clearTokens();
        await setBadge(0);
        await notifyOffscreen('DISCONNECT', {});
        await closeOffscreen();
        return sendResponse({ ok: true });
      }
      case 'CONFIG_SET': {
        await setConfig(message.payload || {});
        await notifyOffscreen('RECONNECT', {});
        return sendResponse({ ok: true });
      }
      case 'STATE_GET': {
        const tokens = await getTokens();
        const config = await getConfig();
        const total = await fetchUnreadTotal().catch(() => 0);
        return sendResponse({
          ok: true,
          authenticated: Boolean(tokens.accessToken),
          user: tokens.user,
          unread: total,
          config,
        });
      }
      case 'OPEN_FRONTEND': {
        const { frontendUrl } = await getConfig();
        const url = message.payload?.path ? `${frontendUrl}${message.payload.path}` : `${frontendUrl}/chat`;
        await chrome.tabs.create({ url });
        return sendResponse({ ok: true });
      }
      case 'OFFSCREEN_NOTIFICATION': {
        const payload = message.payload || {};
        await showNotification(payload);
        await syncFromServer();
        return sendResponse({ ok: true });
      }
      case 'OFFSCREEN_STATUS': {
        return sendResponse({ ok: true });
      }
      default:
        return sendResponse({ ok: false, error: 'unknown type' });
    }
  })();
  return true;
});

void startup();
