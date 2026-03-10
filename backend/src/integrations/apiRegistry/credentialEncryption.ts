// ============================================
// Court Access — API Credential Encryption (AES-256-GCM)
// Encrypts and decrypts API keys using COURTACCESS_API_KEY_SECRET.
// ============================================

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

// ---------------------------------------------------------------------------
// Secret Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the encryption secret from environment.
 * Throws if not configured — fail-fast for security.
 */
function getEncryptionSecret(): string {
  const secret = process.env.COURTACCESS_API_KEY_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      '[CredentialEncryption] COURTACCESS_API_KEY_SECRET is not set or too short (min 16 chars). ' +
      'Set this environment variable before using credential encryption.',
    );
  }
  return secret;
}

/**
 * Derive a 256-bit key from the secret using scrypt.
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH);
}

// ---------------------------------------------------------------------------
// Encrypt / Decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext API key.
 * Returns a Base64 string containing: salt + iv + authTag + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const secret = getEncryptionSecret();
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(secret, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: salt(32) + iv(16) + authTag(16) + ciphertext(variable)
  const packed = Buffer.concat([salt, iv, authTag, encrypted]);
  return packed.toString('base64');
}

/**
 * Decrypt a Base64-encoded encrypted API key.
 * Returns the original plaintext.
 */
export function decrypt(encryptedBase64: string): string {
  const secret = getEncryptionSecret();
  const packed = Buffer.from(encryptedBase64, 'base64');

  // Unpack: salt(32) + iv(16) + authTag(16) + ciphertext(rest)
  const salt = packed.subarray(0, SALT_LENGTH);
  const iv = packed.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = packed.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = deriveKey(secret, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Mask an API key for display (e.g. "sk-abc...xyz").
 * Shows first 6 and last 4 characters.
 */
export function maskApiKey(key: string): string {
  if (key.length <= 10) {
    return '****';
  }
  return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
}
