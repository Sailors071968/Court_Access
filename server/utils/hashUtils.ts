// ============================================
// Court Access — Hash Utilities
// Dual-hash (SHA-256 + SHA3-256) consistent with constitutional engines
// ============================================

import { createHash } from 'crypto';
import { sha3_256 } from 'js-sha3';

/**
 * Compute SHA-256 hash of a string.
 * Deterministic — same input always produces same output.
 */
export function computeSHA256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Compute SHA3-256 hash of a string.
 * Deterministic — same input always produces same output.
 */
export function computeSHA3_256(input: string): string {
  return sha3_256(input);
}

/**
 * Compute SHA-256 hash of a Buffer (for file hashing).
 */
export function computeBufferSHA256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Compute SHA3-256 hash of a Buffer.
 */
export function computeBufferSHA3_256(buffer: Buffer): string {
  return sha3_256(buffer);
}
