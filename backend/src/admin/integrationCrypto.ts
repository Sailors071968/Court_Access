// ============================================================================
// Provider Integrations — credential encryption at rest (AES-256-CBC).
// Uses INTEGRATION_ENCRYPTION_KEY, falling back to JWT_SECRET, so stored
// provider secrets are never persisted in plaintext.
// ============================================================================

import crypto from 'crypto';

function key(): Buffer {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET || 'courtaccess-dev-integration-key';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptSecret(encoded: string): string {
  const [ivHex, dataHex] = encoded.split(':');
  if (!ivHex || !dataHex) return '';
  const decipher = crypto.createDecipheriv('aes-256-cbc', key(), Buffer.from(ivHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

/** Mask a secret to a non-reversible hint like "••••••••abcd". */
export function maskSecret(plain: string): string {
  if (!plain) return '';
  if (plain.length <= 4) return '••••';
  return `••••••••${plain.slice(-4)}`;
}
