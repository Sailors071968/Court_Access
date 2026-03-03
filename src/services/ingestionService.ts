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
 * Validate that a contentHash has not been mutated.
 * Once set, contentHash is immutable — this function enforces that contract.
 *
 * Returns true if hash is valid (unchanged or newly set).
 * Returns false if an existing hash would be overwritten with a different value.
 */
export function validateHashImmutability(
  existingHash: string | null,
  newHash: string
): boolean {
  if (existingHash === null) {
    return true; // First time setting — allowed
  }
  return existingHash === newHash; // Must match if already set
}

// ---------------------------------------------------------------------------
// Integrity verification
// ---------------------------------------------------------------------------

/**
 * Verify document integrity by re-hashing the file and comparing to stored hash.
 * Returns true if the computed hash matches the stored contentHash.
 *
 * This is the verification side of the immutability contract:
 *   1. On upload: computeSHA256 → store as contentHash
 *   2. On verify: computeSHA256 again → compare to stored contentHash
 */
export async function verifyDocumentIntegrity(
  file: File,
  storedHash: string
): Promise<boolean> {
  const computedHash = await computeSHA256(file);
  return computedHash === storedHash;
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
 *   - integrityVerified = true (hash just computed)
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
    const document: DocumentEntity = {
      id: documentId,
      tenantId: input.tenantId,
      caseId: input.caseId,
      name: input.documentName,
      type: input.documentType,
      filedDate: input.filedDate,
      pages: input.pages,
      analysisStatus: 'pending',
      fileSize: formatFileSize(input.file.size),
      fileType,
      contentHash,
      uploadedBy: input.uploadedBy,
      uploadedAt: new Date().toISOString(), // Will be server-generated in Phase 6+
      storagePath,
      extractedText: null,
      extractionStatus: 'pending' as ExtractionStatus,
      integrityVerified: true, // Just computed — verified by definition
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
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
