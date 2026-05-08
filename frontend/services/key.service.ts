/**
 * Manages this user's RSA key pair for end-to-end encryption.
 *
 * To make E2E work across multiple browsers / devices for the same user we
 * encrypt the private key with a key derived from their password (PBKDF2)
 * and store *that* on the server alongside the public key. Any browser the
 * user logs into can recover the same key pair by decrypting with the
 * password they just typed.
 *
 *   - Login / signup → `unlockOrInit(userId, password)` does the dance.
 *   - Page refresh / hydrate → `ensureKeyPair(userId)` only consults
 *     localStorage (no password is available outside a fresh login).
 *   - Logout → `clear()` wipes everything in this browser.
 */
import { api } from './api';
import {
  exportPrivateKey,
  exportPublicKey,
  generateRsaKeyPair,
  importPrivateKey,
  unwrapPrivateKey,
  wrapPrivateKey,
} from '@/lib/crypto';
import type { ApiResponse } from '@/types';

const PRIV_KEY_PREFIX = 'chat_e2e_priv:';

interface KeyBundle {
  publicKey: string;
  encryptedPrivateKey: string;
  keySalt: string;
  keyIv: string;
}

let cachedPrivate: { userId: string; key: CryptoKey } | null = null;
const publicKeyCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

function lsKey(userId: string): string {
  return `${PRIV_KEY_PREFIX}${userId}`;
}

function hasSubtle(): boolean {
  return typeof window !== 'undefined' && Boolean(window.crypto?.subtle);
}

async function fetchServerBundle(): Promise<Partial<KeyBundle> | null> {
  try {
    const { data } = await api.get<ApiResponse<Partial<KeyBundle>>>(
      '/users/me/key-bundle',
    );
    return data.data ?? null;
  } catch {
    return null;
  }
}

async function uploadServerBundle(bundle: KeyBundle): Promise<void> {
  try {
    await api.post('/users/me/key-bundle', bundle);
  } catch {
    /* Non-fatal — next login can re-attempt the upload. */
  }
}

export const keyService = {
  /** Called from login / signup. Has the user's password in scope so we can
   *  decrypt (or, on first run, encrypt + upload) the private-key bundle. */
  async unlockOrInit(userId: string, password: string): Promise<CryptoKey | null> {
    if (!hasSubtle()) return null;
    if (cachedPrivate?.userId === userId) return cachedPrivate.key;

    const serverBundle = await fetchServerBundle();

    /* ---- Path 1: server already has a wrapped private key — try to
                    decrypt it with the password we just received. ---- */
    if (
      serverBundle?.encryptedPrivateKey &&
      serverBundle.keySalt &&
      serverBundle.keyIv
    ) {
      try {
        const priv = await unwrapPrivateKey(
          {
            encryptedPrivateKey: serverBundle.encryptedPrivateKey,
            keySalt: serverBundle.keySalt,
            keyIv: serverBundle.keyIv,
          },
          password,
        );
        cachedPrivate = { userId, key: priv };
        const privB64 = await exportPrivateKey(priv);
        localStorage.setItem(lsKey(userId), privB64);
        return priv;
      } catch {
        /* Wrong password or salt drift — fall through to local fallback so we
         * don't accidentally clobber an existing local key. */
      }
    }

    /* ---- Path 2: legacy migration — local key exists but server has no
                    bundle yet. Re-wrap and upload so other devices can sync. ---- */
    const stored = localStorage.getItem(lsKey(userId));
    if (stored && serverBundle && !serverBundle.encryptedPrivateKey) {
      try {
        const priv = await importPrivateKey(stored);
        cachedPrivate = { userId, key: priv };
        if (serverBundle.publicKey) {
          const wrapped = await wrapPrivateKey(priv, password);
          await uploadServerBundle({
            publicKey: serverBundle.publicKey,
            ...wrapped,
          });
        }
        return priv;
      } catch {
        /* Stored key corrupt — fall through to regenerate. */
      }
    }

    /* ---- Path 3: brand new (or legacy with no public key on server). Mint
                    a fresh key pair, wrap, upload, persist locally. ---- */
    const pair = await generateRsaKeyPair();
    cachedPrivate = { userId, key: pair.privateKey };
    const [pubB64, privB64, wrapped] = await Promise.all([
      exportPublicKey(pair.publicKey),
      exportPrivateKey(pair.privateKey),
      wrapPrivateKey(pair.privateKey, password),
    ]);
    localStorage.setItem(lsKey(userId), privB64);
    await uploadServerBundle({ publicKey: pubB64, ...wrapped });
    return pair.privateKey;
  },

  /** Hydrate / refresh path — no password available, so we can only re-use
   *  whatever's already in localStorage. Never generates new keys here
   *  (would otherwise overwrite the server bundle and lock the user out
   *  of every other device). */
  async ensureKeyPair(userId: string): Promise<CryptoKey | null> {
    if (!hasSubtle()) return null;
    if (cachedPrivate?.userId === userId) return cachedPrivate.key;
    const stored = localStorage.getItem(lsKey(userId));
    if (!stored) return null;
    try {
      const key = await importPrivateKey(stored);
      cachedPrivate = { userId, key };
      return key;
    } catch {
      return null;
    }
  },

  getPrivateKey(userId: string): CryptoKey | null {
    return cachedPrivate?.userId === userId ? cachedPrivate.key : null;
  },

  /** Drops cached private key + cleans the localStorage entry on logout. */
  clear(userId?: string): void {
    if (typeof window === 'undefined') return;
    if (userId) localStorage.removeItem(lsKey(userId));
    cachedPrivate = null;
    publicKeyCache.clear();
    inflight.clear();
  },

  async getPublicKeys(userIds: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const missing: string[] = [];
    for (const id of userIds) {
      const cached = publicKeyCache.get(id);
      if (cached) result[id] = cached;
      else missing.push(id);
    }
    if (missing.length === 0) return result;

    const cacheKey = missing.sort().join(',');
    let promise = inflight.get(cacheKey);
    if (!promise) {
      promise = (async () => {
        try {
          const { data } = await api.get<ApiResponse<Record<string, string>>>(
            '/users/public-keys',
            { params: { ids: missing.join(',') } },
          );
          for (const [id, key] of Object.entries(data.data ?? {})) {
            if (key) publicKeyCache.set(id, key);
          }
          return null;
        } catch {
          return null;
        }
      })();
      inflight.set(cacheKey, promise);
    }
    await promise;
    inflight.delete(cacheKey);
    for (const id of missing) {
      const cached = publicKeyCache.get(id);
      if (cached) result[id] = cached;
    }
    return result;
  },
};
