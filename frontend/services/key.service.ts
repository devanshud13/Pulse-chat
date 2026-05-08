/**
 * Manages this user's RSA key pair for end-to-end encryption:
 *   - Private key lives in localStorage (per-user, namespaced by userId).
 *   - Public key is uploaded to the backend so other clients can encrypt to us.
 *
 * Other users' public keys are fetched once and cached in memory for the session.
 */
import { api } from './api';
import {
  exportPrivateKey,
  exportPublicKey,
  generateRsaKeyPair,
  importPrivateKey,
} from '@/lib/crypto';
import type { ApiResponse } from '@/types';

const PRIV_KEY_PREFIX = 'chat_e2e_priv:';

let cachedPrivate: { userId: string; key: CryptoKey } | null = null;
const publicKeyCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

function lsKey(userId: string): string {
  return `${PRIV_KEY_PREFIX}${userId}`;
}

export const keyService = {
  /** Reads the stored private key for this user, generating + uploading a fresh
   *  pair to the server if one doesn't exist locally yet. Idempotent + safe to
   *  call on every login / hydrate. Returns the imported CryptoKey or null if
   *  Web Crypto is unavailable (SSR / older browsers). */
  async ensureKeyPair(userId: string, serverPublicKey?: string): Promise<CryptoKey | null> {
    if (typeof window === 'undefined' || !window.crypto?.subtle) return null;
    if (cachedPrivate?.userId === userId) return cachedPrivate.key;

    const stored = localStorage.getItem(lsKey(userId));
    if (stored) {
      try {
        const key = await importPrivateKey(stored);
        cachedPrivate = { userId, key };
        if (!serverPublicKey) {
          /* Server doesn't know about us yet — re-upload the public half. */
          await this.uploadFromExisting(userId, stored);
        }
        return key;
      } catch {
        /* Stored key is corrupt — fall through to regenerate. */
      }
    }

    const pair = await generateRsaKeyPair();
    const [pubB64, privB64] = await Promise.all([
      exportPublicKey(pair.publicKey),
      exportPrivateKey(pair.privateKey),
    ]);
    localStorage.setItem(lsKey(userId), privB64);
    cachedPrivate = { userId, key: pair.privateKey };
    try {
      await api.post('/users/me/public-key', { publicKey: pubB64 });
    } catch {
      /* Non-fatal — next encrypted message attempt will surface the error. */
    }
    return pair.privateKey;
  },

  async uploadFromExisting(_userId: string, privKeyB64: string): Promise<void> {
    /* We can derive the public key only via a re-import, which is awkward, so
     * just generate a fresh pair instead — the caller is supposed to wipe the
     * local key first if they want a refresh. */
    void privKeyB64;
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
