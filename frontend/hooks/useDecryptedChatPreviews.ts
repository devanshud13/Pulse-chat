'use client';

import { useEffect } from 'react';
import { decryptEnvelope } from '@/lib/crypto';
import { keyService } from '@/services/key.service';
import { useChatStore } from '@/store/chat.store';
import type { Chat } from '@/types';

/**
 * Decrypts each chat's `lastMessage` preview so the sidebar can show real text
 * instead of the "🔒 Encrypted message" placeholder. Result is cached on the
 * chat record (`lastMessage.plaintext`) so we never re-decrypt the same
 * message id twice.
 *
 * Skipped:
 *  - chats with no last message
 *  - last messages without encryption (already plaintext)
 *  - last messages already carrying a cached `plaintext`
 *  - tombstones
 */
export function useDecryptedChatPreviews(chats: Chat[], myUserId: string | null): void {
  const setLastMessagePlaintext = useChatStore((s) => s.setLastMessagePlaintext);

  useEffect(() => {
    if (!myUserId) return;
    const priv = keyService.getPrivateKey(myUserId);
    if (!priv) return;

    let cancelled = false;
    (async () => {
      for (const c of chats) {
        if (cancelled) return;
        const last = c.lastMessage;
        if (!last) continue;
        if (last.deleted) continue;
        if (last.plaintext !== undefined) continue;
        if (!last.encryption?.enabled) continue;
        if (last.type !== 'text') continue;
        const myKey = last.encryption.keys.find((k) => k.user === myUserId);
        if (!myKey || !last.encryption.iv) continue;
        try {
          const plain = await decryptEnvelope(
            { ciphertext: last.content, iv: last.encryption.iv, encryptedKey: myKey.key },
            priv,
          );
          if (cancelled) return;
          setLastMessagePlaintext(c._id, last._id, plain);
        } catch {
          /* Silently skip — we'd rather show a blank preview than a noisy error. */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chats, myUserId, setLastMessagePlaintext]);
}
