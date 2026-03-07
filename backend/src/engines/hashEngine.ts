// ============================================
// Court Access — Hash Engine
// Dual-hash (SHA-256 + SHA3-256) consistent with constitutional engines.
// ============================================

import { createHash } from 'crypto';
import { sha3_256 } from 'js-sha3';

export function computeSHA256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function computeSHA3_256(input: string): string {
  return sha3_256(input);
}

export function computeBufferSHA256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function computeBufferSHA3_256(buffer: Buffer): string {
  return sha3_256(buffer);
}
