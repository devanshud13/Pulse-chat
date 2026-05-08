/**
 * End-to-end encryption helpers built on the Web Crypto API.
 *
 * Scheme (per message):
 *   1. Generate a random 256-bit AES-GCM session key.
 *   2. Encrypt the plaintext with that key + a random 96-bit IV.
 *   3. RSA-OAEP-encrypt the AES key once per recipient using their public key
 *      (each chat member, including the sender so they can read their own
 *      message later from another device / after refresh).
 *   4. Send `{ ciphertext, iv, keys: { user, encryptedAesKey }[] }` over the wire.
 *
 * The server never sees plaintext or any private key.
 *
 * Note: file/image attachments are *not* encrypted — they're stored on Cloudinary
 * with a public URL so the CDN works. Only the message body is E2E-protected.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

const RSA_ALGO: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
  hash: 'SHA-256',
};

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function getCrypto(): SubtleCrypto {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto is unavailable in this environment');
  }
  return window.crypto.subtle;
}

export async function generateRsaKeyPair(): Promise<CryptoKeyPair> {
  return getCrypto().generateKey(RSA_ALGO, true, ['encrypt', 'decrypt']);
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const spki = await getCrypto().exportKey('spki', key);
  return bufToB64(spki);
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const pkcs8 = await getCrypto().exportKey('pkcs8', key);
  return bufToB64(pkcs8);
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  return getCrypto().importKey('spki', b64ToBuf(b64), RSA_ALGO, false, ['encrypt']);
}

export async function importPrivateKey(b64: string): Promise<CryptoKey> {
  return getCrypto().importKey('pkcs8', b64ToBuf(b64), RSA_ALGO, false, ['decrypt']);
}

export interface EncryptedEnvelope {
  ciphertext: string;
  iv: string;
  keys: { user: string; key: string }[];
}

export async function encryptForRecipients(
  plaintext: string,
  recipients: { userId: string; publicKey: string }[],
): Promise<EncryptedEnvelope> {
  const subtle = getCrypto();
  const aes = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    aes,
    enc.encode(plaintext),
  );
  const rawAes = await subtle.exportKey('raw', aes);

  const keys = await Promise.all(
    recipients.map(async (r) => {
      const pub = await importPublicKey(r.publicKey);
      const encKey = await subtle.encrypt({ name: 'RSA-OAEP' }, pub, rawAes);
      return { user: r.userId, key: bufToB64(encKey) };
    }),
  );

  return { ciphertext: bufToB64(ciphertextBuf), iv: bufToB64(iv), keys };
}

export async function decryptEnvelope(
  envelope: { ciphertext: string; iv: string; encryptedKey: string },
  privateKey: CryptoKey,
): Promise<string> {
  const subtle = getCrypto();
  const rawAes = await subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    b64ToBuf(envelope.encryptedKey),
  );
  const aes = await subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, ['decrypt']);
  const plain = await subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(b64ToBuf(envelope.iv)) },
    aes,
    b64ToBuf(envelope.ciphertext),
  );
  return dec.decode(plain);
}
