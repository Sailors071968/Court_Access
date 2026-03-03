// ============================================
// Court Access — Document Ingestion Service (Phase 2)
// Isolated module for file upload, hashing, and storage.
// No UI dependencies. No React imports.
// ============================================

import type { DocumentEntity, DocumentType, ExtractionStatus } from '../models/DocumentModel';

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
// SHA-256 hashing — deterministic content hash
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 hash of file contents.
 * Uses the Web Crypto API (available in browsers and Node 18+).
 * Returns hex-encoded hash prefixed with "sha256:".
 *
 * This is a pure function — same input always produces same output.
 */
export async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hashHex}`;
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
 * Enforce contentHash immutability.
 * Once set, contentHash MUST NOT be mutated.
 *
 * Throws if an existing hash would be overwritten with a different value.
 * This is a runtime guard — not comment-only enforcement.
 */
export function validateHashImmutability(
  existingHash: string | null,
  newHash: string
): void {
  if (existingHash === null) {
    return; // First time setting — allowed
  }
  if (existingHash !== newHash) {
    throw new Error(
      `ContentHash immutability violation: existing hash "${existingHash}" cannot be overwritten with "${newHash}". ` +
      'Once set, contentHash is immutable. This may indicate tampering or a pipeline bug.'
    );
  }
}

// ---------------------------------------------------------------------------
// Integrity verification
// ---------------------------------------------------------------------------

/**
 * Integrity verification result.
 * Separates the boolean match from the computed hash for audit logging.
 */
export interface IntegrityVerificationResult {
  verified: boolean;
  computedHash: string;
  storedHash: string;
}

/**
 * Verify document integrity by re-hashing the file and comparing to stored hash.
 *
 * This is the verification side of the immutability contract:
 *   1. On upload: computeSHA256 → store as contentHash
 *   2. On verify: computeSHA256 again → compare to stored contentHash
 *
 * Returns structured result:
 *   - verified: true ONLY if computed hash === stored hash
 *   - Does NOT auto-correct the hash
 *   - Does NOT overwrite contentHash
 *   - Caller must set integrityVerified = true only if verified === true
 */
export async function verifyDocumentIntegrity(
  file: File,
  storedHash: string
): Promise<IntegrityVerificationResult> {
  const computedHash = await computeSHA256(file);
  return {
    verified: computedHash === storedHash,
    computedHash,
    storedHash,
  };
}

// ---------------------------------------------------------------------------
// Document ingestion pipeline
// ---------------------------------------------------------------------------

/**
 * Ingest a document into the system.
 *
 * Pipeline:
 *   1. Compute SHA-256 content hash
 *   2. Generate deterministic storage path
 *   3. Create DocumentEntity with extractionStatus = 'pending'
 *   4. Return IngestionResult
 *
 * Phase 2: File is NOT physically stored (no backend yet).
 * Phase 6+ will replace this with actual S3/storage upload.
 *
 * The returned DocumentEntity has:
 *   - contentHash set (immutable from this point)
 *   - integrityVerified = false (must be verified separately via verifyDocumentIntegrity)
 *   - extractionStatus = 'pending' (extraction deferred to extractionEngine)
 *   - analysisStatus = 'pending' (analysis deferred to intelligence pipeline)
 */
export async function ingestDocument(input: IngestionInput): Promise<IngestionResult> {
  try {
    // Step 1: Compute content hash
    const contentHash = await computeSHA256(input.file);

    // Step 2: Generate document ID (deterministic from hash for deduplication)
    // In Phase 6+ this will be a UUID from the backend
    const documentId = contentHash.slice(7, 23); // 16 hex chars from hash

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
