// ============================================================================
// Phase 68 — Document Validation Layer
// Validates documents before ingestion: file size, MIME type, duplicates,
// SHA-256 hash check.
// ============================================================================

import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationConfig {
  maxFileSizeBytes: number;
  allowedMimeTypes: string[];
  enableDuplicateDetection: boolean;
  enableHashCheck: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    fileSizeBytes: number;
    mimeType: string | null;
    sha256Hash: string | null;
    isDuplicate: boolean;
    validatedAt: string;
  };
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/html',
    'application/rtf',
    'image/png',
    'image/jpeg',
    'image/tiff',
  ],
  enableDuplicateDetection: true,
  enableHashCheck: true,
};

// ---------------------------------------------------------------------------
// MIME Type Detection
// ---------------------------------------------------------------------------

const MIME_SIGNATURES: Array<{ bytes: number[]; offset: number; mimeType: string }> = [
  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, mimeType: 'application/pdf' }, // %PDF
  { bytes: [0xD0, 0xCF, 0x11, 0xE0], offset: 0, mimeType: 'application/msword' }, // DOC
  { bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, // DOCX/ZIP
  { bytes: [0x89, 0x50, 0x4E, 0x47], offset: 0, mimeType: 'image/png' }, // PNG
  { bytes: [0xFF, 0xD8, 0xFF], offset: 0, mimeType: 'image/jpeg' }, // JPEG
  { bytes: [0x49, 0x49, 0x2A, 0x00], offset: 0, mimeType: 'image/tiff' }, // TIFF (little endian)
  { bytes: [0x4D, 0x4D, 0x00, 0x2A], offset: 0, mimeType: 'image/tiff' }, // TIFF (big endian)
  { bytes: [0x7B, 0x5C, 0x72, 0x74, 0x66], offset: 0, mimeType: 'application/rtf' }, // RTF {\rtf
];

/**
 * Detect MIME type from file buffer using magic bytes.
 */
export function detectMimeType(buffer: Buffer): string | null {
  for (const sig of MIME_SIGNATURES) {
    if (buffer.length < sig.offset + sig.bytes.length) continue;
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[sig.offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) return sig.mimeType;
  }

  // Check if it's plain text (all printable ASCII + whitespace)
  const sample = buffer.subarray(0, Math.min(1024, buffer.length));
  let isText = true;
  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];
    if (byte < 0x09 || (byte > 0x0D && byte < 0x20) || byte > 0x7E) {
      // Allow UTF-8 multi-byte sequences
      if (byte < 0x80) {
        isText = false;
        break;
      }
    }
  }
  if (isText) return 'text/plain';

  return null;
}

/**
 * Compute SHA-256 hash of a buffer.
 */
export function computeSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

// ---------------------------------------------------------------------------
// Duplicate Detection (in-memory hash set + DB check)
// ---------------------------------------------------------------------------

const knownHashes = new Set<string>();

/**
 * Register a hash as known (for in-memory duplicate detection).
 */
export function registerKnownHash(hash: string): void {
  knownHashes.add(hash);
}

/**
 * Check if a hash is already known.
 */
export function isHashKnown(hash: string): boolean {
  return knownHashes.has(hash);
}

/**
 * Bulk register known hashes (e.g., from database query at startup).
 */
export function bulkRegisterHashes(hashes: string[]): void {
  for (const h of hashes) {
    knownHashes.add(h);
  }
}

/**
 * Get count of known hashes.
 */
export function getKnownHashCount(): number {
  return knownHashes.size;
}

// ---------------------------------------------------------------------------
// Validation Functions
// ---------------------------------------------------------------------------

/**
 * Validate a document buffer against all checks.
 */
export function validateDocument(
  buffer: Buffer,
  declaredMimeType?: string,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fileSizeBytes = buffer.length;
  let detectedMimeType: string | null = null;
  let sha256Hash: string | null = null;
  let isDuplicate = false;

  // 1. File size check
  if (fileSizeBytes > config.maxFileSizeBytes) {
    errors.push(
      `File size (${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB) exceeds maximum (${(config.maxFileSizeBytes / 1024 / 1024).toFixed(0)}MB)`
    );
  }

  if (fileSizeBytes === 0) {
    errors.push('File is empty (0 bytes)');
  }

  // 2. MIME type validation
  detectedMimeType = detectMimeType(buffer);

  if (declaredMimeType && detectedMimeType && declaredMimeType !== detectedMimeType) {
    warnings.push(
      `Declared MIME type "${declaredMimeType}" does not match detected type "${detectedMimeType}"`
    );
  }

  const effectiveMime = detectedMimeType ?? declaredMimeType ?? null;
  if (effectiveMime && !config.allowedMimeTypes.includes(effectiveMime)) {
    errors.push(
      `MIME type "${effectiveMime}" is not in the allowed list: ${config.allowedMimeTypes.join(', ')}`
    );
  }

  if (!effectiveMime) {
    warnings.push('Could not determine MIME type for this file');
  }

  // 3. SHA-256 hash
  if (config.enableHashCheck) {
    sha256Hash = computeSha256(buffer);
  }

  // 4. Duplicate detection
  if (config.enableDuplicateDetection && sha256Hash) {
    isDuplicate = isHashKnown(sha256Hash);
    if (isDuplicate) {
      warnings.push(`Duplicate document detected (SHA-256: ${sha256Hash.slice(0, 16)}...)`);
    } else {
      // Register this hash for future duplicate checks
      registerKnownHash(sha256Hash);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: {
      fileSizeBytes,
      mimeType: effectiveMime,
      sha256Hash,
      isDuplicate,
      validatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Quick validation (size + MIME only, no hash).
 */
export function quickValidate(
  fileSizeBytes: number,
  mimeType: string | null,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG,
): { valid: boolean; reason?: string } {
  if (fileSizeBytes > config.maxFileSizeBytes) {
    return {
      valid: false,
      reason: `File too large: ${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB (max ${(config.maxFileSizeBytes / 1024 / 1024).toFixed(0)}MB)`,
    };
  }

  if (fileSizeBytes === 0) {
    return { valid: false, reason: 'File is empty' };
  }

  if (mimeType && !config.allowedMimeTypes.includes(mimeType)) {
    return { valid: false, reason: `MIME type "${mimeType}" not allowed` };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

export function getValidationServiceStatus(): {
  knownHashCount: number;
  config: ValidationConfig;
} {
  return {
    knownHashCount: knownHashes.size,
    config: DEFAULT_VALIDATION_CONFIG,
  };
}
