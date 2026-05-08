'use client';

import { useEffect } from 'react';
import { decryptEnvelope } from '@/lib/crypto';
import { keyService } from '@/services/key.service';
import { useChatStore } from '@/store/chat.store';
import type { Message } from '@/types';

/**
 * Walks the latest message list for a chat and decrypts any encrypted messages
 * we haven't decrypted yet, caching the plaintext on the message object.
 *
 * Cheap: skips messages already carrying `plaintext`, plaintext (unencrypted)
 * messages, or tombstones.
 */
export function useDecryptedMessages(
  chatId: string,
  messages: Message[],
  myUserId: string | null,
): void {
  const updateMessage = useChatStore((s) => s.updateMessage);

  useEffect(() => {
    if (!myUserId) return;
    const priv = keyService.getPrivateKey(myUserId);
    if (!priv) return;

    let cancelled = false;
    (async () => {
      for (const m of messages) {
        if (cancelled) return;
        if (m.deleted) continue;
        if (m.plaintext !== undefined) continue;
        if (!m.encryption?.enabled) continue;
        const myKey = m.encryption.keys.find((k) => k.user === myUserId);
        if (!myKey || !m.encryption.iv) {
          updateMessage(chatId, m._id, { plaintext: '[unable to decrypt]' });
          continue;
        }
        try {
          const plain = await decryptEnvelope(
            { ciphertext: m.content, iv: m.encryption.iv, encryptedKey: myKey.key },
            priv,
          );
          if (cancelled) return;
          updateMessage(chatId, m._id, { plaintext: plain });
        } catch {
          if (cancelled) return;
          updateMessage(chatId, m._id, { plaintext: '[unable to decrypt]' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chatId, messages, myUserId, updateMessage]);
}
