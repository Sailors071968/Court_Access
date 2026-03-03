// ============================================
// Court Access — Document Ingestion Service (Phase 2)
// Isolated module for file upload, hashing, and storage.
// No UI dependencies. No React imports.
// ============================================

import type { DocumentEntity, DocumentType, ExtractionStatus } from '../models/DocumentModel';
import { sha3_256 } from 'js-sha3';

// ---------------------------------------------------------------------------
// Ingestion input — what the caller provides when uploading a file
// ---------------------------------------------------------------------------

export interface IngestionInput {
  file: File;
  tenantId: string;
  caseId: string;
  documentName: string;
  documentType: DocumentType;
  filedDate: string;
  pages: number;
  uploadedBy: string;
}

// ---------------------------------------------------------------------------
// Ingestion result — what the service returns after processing
// ---------------------------------------------------------------------------

export interface IngestionResult {
  success: boolean;
  document: DocumentEntity | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// SHA-256 hashing — primary deterministic content hash
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 hash of file contents.
 * Uses the Web Crypto API (available in browsers and Node 18+).
 * Returns raw lowercase hex string (64 characters). No prefix.
 *
 * This is a pure function — same input always produces same output.
 */
export async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// SHA3-256 hashing — secondary deterministic content hash
// Phase 24: Crypto Survivability Horizon
// Dual-hash protects against future collision vulnerability,
// algorithmic obsolescence, and retroactive cryptographic downgrade.
// ---------------------------------------------------------------------------

/**
 * Compute SHA3-256 hash of file contents.
 * Uses js-sha3 (pure JavaScript Keccak implementation).
 * No external network dependency. No randomness. Fully deterministic.
 * Returns raw lowercase hex string (64 characters). No prefix.
 *
 * Input: raw file bytes via File.arrayBuffer() — identical byte sequence as computeSHA256.
 * This is a pure function — same input always produces same output.
 */
export async function computeSHA3_256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return sha3_256(buffer);
}

// ---------------------------------------------------------------------------
// Storage path generation — deterministic path from metadata
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic storage path for a document.
 * Path structure: /documents/{tenantId}/case-{caseId}/{documentId}-{slugified-name}.{ext}
 *
 * This is a pure function — same input always produces same output.
 */
export function generateStoragePath(
  tenantId: string,
  caseId: string,
  documentId: string,
  documentName: string,
  fileType: string
): string {
  const slug = documentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `/documents/${tenantId}/case-${caseId}/${documentId}-${slug}.${fileType}`;
}

// ---------------------------------------------------------------------------
// Content hash immutability guard
// ---------------------------------------------------------------------------

/**
 * Enforce hash immutability for a single hash field.
 * Once set, the hash MUST NOT be mutated.
 *
 * Throws if an existing hash would be overwritten with a different value.
 * This is a runtime guard — not comment-only enforcement.
 *
 * @param fieldName - Name of the hash field (for error diagnostics)
 * @param existingHash - Current stored hash (null if not yet set)
 * @param newHash - New hash being proposed
 */
export function validateHashImmutability(
  fieldName: string,
  existingHash: string | null,
  newHash: string
): void {
  if (existingHash === null) {
    return; // First time setting — allowed
  }
  if (existingHash !== newHash) {
    throw new Error(
      `${fieldName} immutability violation: existing hash "${existingHash}" cannot be overwritten with "${newHash}". ` +
      `Once set, ${fieldName} is immutable. This may indicate tampering or a pipeline bug.`
    );
  }
}

/**
 * Enforce dual-hash immutability.
 * Validates both contentHash (SHA-256) and sha3Hash (SHA3-256) simultaneously.
 * Throws on the first violation detected.
 */
export function validateDualHashImmutability(
  existingContentHash: string | null,
  newContentHash: string,
  existingSha3Hash: string | null,
  newSha3Hash: string
): void {
  validateHashImmutability('contentHash', existingContentHash, newContentHash);
  validateHashImmutability('sha3Hash', existingSha3Hash, newSha3Hash);
}

// ---------------------------------------------------------------------------
// Integrity verification
// ---------------------------------------------------------------------------

/**
 * Integrity verification result for a single hash.
 * Separates the boolean match from the computed hash for audit logging.
 */
export interface SingleHashVerificationResult {
  verified: boolean;
  computedHash: string;
  storedHash: string;
}

/**
 * Dual-hash integrity verification result.
 * Both hashes must match for overall verification to pass.
 * Includes individual results for each hash algorithm for forensic audit logging.
 */
export interface IntegrityVerificationResult {
  verified: boolean;           // true ONLY if BOTH hashes match
  sha256Result: SingleHashVerificationResult;
  sha3Result: SingleHashVerificationResult;
}

/**
 * Verify document integrity by re-hashing the file and comparing to BOTH stored hashes.
 *
 * Dual-hash verification (Phase 24 — Crypto Survivability Horizon):
 *   1. On upload: computeSHA256 + computeSHA3_256 → store as contentHash + sha3Hash
 *   2. On verify: re-compute both hashes → compare each to stored values
 *
 * Returns structured result:
 *   - verified: true ONLY if BOTH computed hashes match stored hashes
 *   - Individual results for SHA-256 and SHA3-256 included for audit trail
 *   - Does NOT auto-correct either hash
 *   - Does NOT overwrite contentHash or sha3Hash
 *   - Caller must set integrityVerified = true only if verified === true
 */
export async function verifyDocumentIntegrity(
  file: File,
  storedContentHash: string,
  storedSha3Hash: string
): Promise<IntegrityVerificationResult> {
  const computedSha256 = await computeSHA256(file);
  const computedSha3 = await computeSHA3_256(file);

  const sha256Result: SingleHashVerificationResult = {
    verified: computedSha256 === storedContentHash,
    computedHash: computedSha256,
    storedHash: storedContentHash,
  };

  const sha3Result: SingleHashVerificationResult = {
    verified: computedSha3 === storedSha3Hash,
    computedHash: computedSha3,
    storedHash: storedSha3Hash,
  };

  return {
    verified: sha256Result.verified && sha3Result.verified,
    sha256Result,
    sha3Result,
  };
}

// ---------------------------------------------------------------------------
// Document ingestion pipeline
// ---------------------------------------------------------------------------

/**
 * Ingest a document into the system.
 *
 * Pipeline:
 *   1. Compute dual content hashes (SHA-256 + SHA3-256)
 *   2. Generate deterministic document ID (from SHA-256 — primary hash)
 *   3. Generate deterministic storage path
 *   4. Create DocumentEntity with extractionStatus = 'pending'
 *   5. Return IngestionResult
 *
 * Phase 2: File is NOT physically stored (no backend yet).
 * Phase 6+ will replace this with actual S3/storage upload.
 *
 * The returned DocumentEntity has:
 *   - contentHash (SHA-256) set — immutable from this point
 *   - sha3Hash (SHA3-256) set — immutable from this point
 *   - integrityVerified = false (must be verified separately via verifyDocumentIntegrity)
 *   - extractionStatus = 'pending' (extraction deferred to extractionEngine)
 *   - analysisStatus = 'pending' (analysis deferred to intelligence pipeline)
 */
export async function ingestDocument(input: IngestionInput): Promise<IngestionResult> {
  try {
    // Step 1: Compute dual content hashes
    const contentHash = await computeSHA256(input.file);
    const sha3Hash = await computeSHA3_256(input.file);

    // Step 2: Generate document ID (deterministic from hash for deduplication)
    // In Phase 6+ this will be a UUID from the backend
    const documentId = contentHash.slice(0, 16); // 16 hex chars from raw hex hash

    // Step 3: Generate storage path
    const fileType = input.file.name.split('.').pop() || 'bin';
    const storagePath = generateStoragePath(
      input.tenantId,
      input.caseId,
      documentId,
      input.documentName,
      fileType
    );

    // Step 4: Build canonical DocumentEntity
    // integrityVerified = false — hash is computed but NOT yet verified.
    // Verification is a separate step (verifyDocumentIntegrity) that
    // re-hashes the stored file and compares to contentHash.
    // Only after that step succeeds should integrityVerified become true.
    const document: DocumentEntity = {
      id: documentId,
      tenantId: input.tenantId,
      caseId: input.caseId,
      name: input.documentName,
      type: input.documentType,
      filedDate: input.filedDate,
      pages: input.pages,
      analysisStatus: 'pending',
      fileSize: input.file.size,  // Raw bytes — no formatting at domain level
      fileType,
      contentHash,
      sha3Hash,
      uploadedBy: input.uploadedBy,
      uploadedAt: input.filedDate, // Deterministic — server timestamp in Phase 6+
      storagePath,
      extractedText: null,
      extractionStatus: 'pending' as ExtractionStatus,
      integrityVerified: false, // Must be verified via verifyDocumentIntegrity()
    };

    return {
      success: true,
      document,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      document: null,
      error: err instanceof Error ? err.message : 'Unknown ingestion error',
    };
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Format file size in bytes to human-readable string.
 * Deterministic — same input always produces same output.
 * Exported for UI display layers that need human-readable sizes.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
