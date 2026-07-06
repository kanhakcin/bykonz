/**
 * Crypto utilities using the native Web Crypto API.
 * Replaces the discontinued crypto-js library.
 */

/**
 * Derives a key and IV from a password and salt using PBKDF2.
 * This is a modern replacement for the legacy OpenSSL-style derivation.
 */
async function deriveKeyAndIv(password: string, salt: Uint8Array, keyLen: number, ivLen: number) {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);

  const keyBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 10000,
      hash: 'SHA-256',
    },
    passwordKey,
    (keyLen + ivLen) * 8,
  );

  const derivedBytes = new Uint8Array(keyBits);
  return {
    key: derivedBytes.slice(0, keyLen),
    iv: derivedBytes.slice(keyLen, keyLen + ivLen),
  };
}

/**
 * Decrypts data using AES-256-CBC with a password.
 * Supports the OpenSSL-compatible 'Salted__' format.
 */
export async function decryptAES(encryptedB64: string, password: string): Promise<string> {
  try {
    const combined = new Uint8Array(
      atob(encryptedB64)
        .split('')
        .map((c) => c.charCodeAt(0)),
    );

    // Check for 'Salted__' header
    const header = new TextDecoder().decode(combined.slice(0, 8));
    if (header !== 'Salted__') {
      throw new Error('Invalid encryption format');
    }

    const salt = combined.slice(8, 16);
    const ciphertext = combined.slice(16);

    const { key, iv } = await deriveKeyAndIv(password, salt, 32, 16);

    const cryptoKey = await window.crypto.subtle.importKey('raw', key, { name: 'AES-CBC' }, false, ['decrypt']);

    const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, ciphertext);

    return new TextDecoder().decode(decrypted);
  } catch (_error) {
    return '';
  }
}

/**
 * Generate random string for nonce/state
 */
export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);

  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(array[i] % chars.length);
  }
  return result;
}

/**
 * Hash string with SHA256
 */
export async function hashString(str: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await window.crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
