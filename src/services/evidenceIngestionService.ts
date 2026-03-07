// ============================================
// Court Access — Evidence Ingestion Service (AI Evidence Intelligence Phase 1)
// Unified evidence upload pipeline for all media types.
//
// Pipeline:
//   1. Validate file type (MIME + extension)
//   2. Validate file size
//   3. Compute dual hashes (SHA-256 + SHA3-256)
//   4. Classify evidence type
//   5. Generate storage path
//   6. Create EvidenceRecord
//
// Deterministic — same input always produces same output.
// No side effects beyond storage.
// ============================================

import type {
  EvidenceRecord,
  EvidenceUploadInput,
  EvidenceUploadResult,
  EvidenceType,
} from '../models/EvidenceModel';
import {
  classifyMimeType,
  classifyExtension,
  MAX_FILE_SIZE,
  SUPPORTED_MIME_TYPES,
} from '../models/EvidenceModel';
import { computeSHA256, computeSHA3_256 } from './ingestionService';

// ---------------------------------------------------------------------------
// Evidence Storage Path Generation
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic storage path for evidence in R2.
 * Path structure: /evidence/{tenantId}/case-{caseId}/{evidenceId}-{slugified-name}.{ext}
 */
export function generateEvidenceStoragePath(
  tenantId: string,
  caseId: string,
  evidenceId: string,
  fileName: string
): string {
  const ext = fileName.split('.').pop() || 'bin';
  const slug = fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `/evidence/${tenantId}/case-${caseId}/${evidenceId}-${slug}.${ext}`;
}

// ---------------------------------------------------------------------------
// File Validation
// ---------------------------------------------------------------------------

export interface FileValidationResult {
  valid: boolean;
  evidenceType: EvidenceType | null;
  error: string | null;
}

/**
 * Validate a file for evidence upload.
 * Checks MIME type, extension, and file size.
 * Returns the classified evidence type if valid.
 */
export function validateEvidenceFile(file: File): FileValidationResult {
  // Step 1: Classify by MIME type
  let evidenceType = classifyMimeType(file.type);

  // Step 2: Fallback to extension classification
  if (evidenceType === null) {
    evidenceType = classifyExtension(file.name);
  }

  // Step 3: Reject unsupported types
  if (evidenceType === null) {
    return {
      valid: false,
      evidenceType: null,
      error: `Unsupported file type: ${file.type || 'unknown'}. Supported types: ${Object.keys(SUPPORTED_MIME_TYPES).join(', ')}`,
    };
  }

  // Step 4: Validate file size
  const maxSize = MAX_FILE_SIZE[evidenceType];
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      evidenceType,
      error: `File too large: ${fileMB}MB exceeds maximum ${maxMB}MB for ${evidenceType} files.`,
    };
  }

  // Step 5: Reject empty files
  if (file.size === 0) {
    return {
      valid: false,
      evidenceType,
      error: 'File is empty (0 bytes).',
    };
  }

  return {
    valid: true,
    evidenceType,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Evidence Ingestion Pipeline
// ---------------------------------------------------------------------------

/**
 * Ingest evidence into the system.
 *
 * Pipeline:
 *   1. Validate file
 *   2. Compute dual hashes (SHA-256 + SHA3-256)
 *   3. Generate evidence ID
 *   4. Generate storage path
 *   5. Create EvidenceRecord
 *
 * Phase 1: File is NOT physically uploaded to R2 yet.
 * Phase 26+ backend will handle actual storage.
 */
export async function ingestEvidence(
  input: EvidenceUploadInput
): Promise<EvidenceUploadResult> {
  try {
    // Step 1: Validate file
    const validation = validateEvidenceFile(input.file);
    if (!validation.valid || validation.evidenceType === null) {
      return {
        success: false,
        record: null,
        error: validation.error ?? 'Unknown validation error',
      };
    }

    // Step 2: Compute dual hashes
    const sha256Hash = await computeSHA256(input.file);
    const sha3Hash = await computeSHA3_256(input.file);

    // Step 3: Generate evidence ID (deterministic from primary hash)
    const evidenceId = `ev-${sha256Hash.slice(0, 16)}`;

    // Step 4: Generate storage path
    const storageLocation = generateEvidenceStoragePath(
      input.tenantId,
      input.caseId,
      evidenceId,
      input.file.name
    );

    // Step 5: Build EvidenceRecord
    const record: EvidenceRecord = {
      evidenceId,
      caseId: input.caseId,
      tenantId: input.tenantId,
      fileName: input.file.name,
      fileType: validation.evidenceType,
      mimeType: input.file.type || 'application/octet-stream',
      fileSize: input.file.size,
      uploadTimestamp: input.uploadTimestamp,
      storageLocation,
      sha256Hash,
      sha3Hash,
      processingStatus: 'pending',
      uploadedBy: input.uploadedBy,
      integrityVerified: false,
    };

    return {
      success: true,
      record,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      record: null,
      error: err instanceof Error ? err.message : 'Unknown ingestion error',
    };
  }
}

// ---------------------------------------------------------------------------
// Format Utilities
// ---------------------------------------------------------------------------

/**
 * Format file size to human-readable string.
 */
export function formatEvidenceFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format duration in seconds to human-readable string.
 */
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
