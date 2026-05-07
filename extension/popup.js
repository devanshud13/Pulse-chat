const $ = (id) => document.getElementById(id);

function show(stateId) {
  for (const id of ['loading', 'logged-out', 'logged-in']) {
    const el = $(id);
    if (!el) continue;
    el.classList.toggle('hidden', id !== stateId);
  }
}

function initials(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
}

function renderState(state) {
  const conn = $('conn');
  conn.classList.toggle('online', state.authenticated);
  conn.classList.toggle('offline', !state.authenticated);

  if (!state.authenticated) {
    show('logged-out');
    return;
  }

  show('logged-in');
  const user = state.user || {};
  $('user-name').textContent = user.name || 'Pulse user';
  $('user-email').textContent = user.email || '';
  const avatar = $('avatar');
  if (user.avatar) {
    avatar.style.backgroundImage = `url(${JSON.stringify(user.avatar)})`;
    avatar.textContent = '';
  } else {
    avatar.style.backgroundImage = 'linear-gradient(135deg, #7c3aed, #22d3ee)';
    avatar.textContent = initials(user.name);
  }
  $('unread-count').textContent = String(state.unread ?? 0);

  if (state.config) {
    $('cfg-api').value = state.config.apiUrl || '';
    $('cfg-socket').value = state.config.socketUrl || '';
    $('cfg-frontend').value = state.config.frontendUrl || '';
  }
}

async function refresh() {
  show('loading');
  chrome.runtime.sendMessage({ target: 'background', type: 'STATE_GET' }, (res) => {
    if (chrome.runtime.lastError || !res?.ok) {
      show('logged-out');
      return;
    }
    renderState(res);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  $('open-login').addEventListener('click', () => {
    chrome.runtime.sendMessage({
      target: 'background',
      type: 'OPEN_FRONTEND',
      payload: { path: '/login' },
    });
    window.close();
  });

  $('open-chat').addEventListener('click', () => {
    chrome.runtime.sendMessage({
      target: 'background',
      type: 'OPEN_FRONTEND',
      payload: { path: '/chat' },
    });
    window.close();
  });

  $('logout').addEventListener('click', () => {
    chrome.runtime.sendMessage({ target: 'background', type: 'AUTH_LOGOUT' }, () => {
      void refresh();
    });
  });

  $('save-config').addEventListener('click', () => {
    const apiUrl = $('cfg-api').value.trim();
    const socketUrl = $('cfg-socket').value.trim();
    const frontendUrl = $('cfg-frontend').value.trim();
    chrome.runtime.sendMessage(
      {
        target: 'background',
        type: 'CONFIG_SET',
        payload: { apiUrl, socketUrl, frontendUrl },
      },
      () => {
        void refresh();
      },
    );
  });

  void refresh();
});
