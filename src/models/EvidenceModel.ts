// ============================================
// Court Access — Evidence Model (AI Evidence Intelligence)
// Unified evidence record for all media types:
// documents, images, audio, video.
//
// MIME-type based classification.
// Deterministic — no probability, no scoring.
// ============================================

// ---------------------------------------------------------------------------
// Evidence Types
// ---------------------------------------------------------------------------

/** Top-level evidence category derived from MIME type. */
export type EvidenceType = 'document' | 'image' | 'audio' | 'video';

/** Processing pipeline status for evidence. */
export type EvidenceProcessingStatus = 'pending' | 'processing' | 'complete' | 'error';

// ---------------------------------------------------------------------------
// MIME Type Classification — Deterministic Mapping
// ---------------------------------------------------------------------------

/**
 * Supported MIME types grouped by evidence category.
 * Each maps to exactly one EvidenceType.
 * No ambiguity. No fallback heuristics.
 */
export const SUPPORTED_MIME_TYPES: Record<string, EvidenceType> = {
  // Documents
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'text/plain': 'document',
  'application/rtf': 'document',
  'text/csv': 'document',

  // Images
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/heic': 'image',
  'image/heif': 'image',
  'image/tiff': 'image',
  'image/bmp': 'image',
  'image/webp': 'image',

  // Audio
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/x-wav': 'audio',
  'audio/mp4': 'audio',
  'audio/x-m4a': 'audio',
  'audio/aac': 'audio',
  'audio/ogg': 'audio',
  'audio/flac': 'audio',

  // Video
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/x-msvideo': 'video',
  'video/x-matroska': 'video',
  'video/webm': 'video',
} as const;

/**
 * Supported file extensions grouped by evidence category.
 * Used for UI display and file input accept attributes.
 */
export const SUPPORTED_EXTENSIONS: Record<EvidenceType, string[]> = {
  document: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.csv'],
  image: ['.jpg', '.jpeg', '.png', '.heic', '.tiff', '.bmp', '.webp'],
  audio: ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'],
  video: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
} as const;

/**
 * Maximum file sizes per evidence type (in bytes).
 * Free tier limits are enforced separately via subscription tier.
 */
export const MAX_FILE_SIZE: Record<EvidenceType, number> = {
  document: 50 * 1024 * 1024,     // 50 MB
  image: 25 * 1024 * 1024,        // 25 MB
  audio: 500 * 1024 * 1024,       // 500 MB
  video: 1024 * 1024 * 1024,      // 1 GB
} as const;

// ---------------------------------------------------------------------------
// MIME Classification Function
// ---------------------------------------------------------------------------

/**
 * Classify a file's MIME type into an EvidenceType.
 * Returns null if the MIME type is not supported.
 *
 * Deterministic — same input always produces same output.
 */
export function classifyMimeType(mimeType: string): EvidenceType | null {
  return SUPPORTED_MIME_TYPES[mimeType.toLowerCase()] ?? null;
}

/**
 * Classify a file extension into an EvidenceType.
 * Fallback classification when MIME type is unavailable.
 * Returns null if the extension is not recognized.
 */
export function classifyExtension(filename: string): EvidenceType | null {
  const ext = ('.' + (filename.split('.').pop() || '')).toLowerCase();
  for (const [type, extensions] of Object.entries(SUPPORTED_EXTENSIONS)) {
    if (extensions.includes(ext)) {
      return type as EvidenceType;
    }
  }
  return null;
}

/**
 * Get all supported file extensions as a flat array (for file input accept).
 */
export function getAllSupportedExtensions(): string[] {
  return Object.values(SUPPORTED_EXTENSIONS).flat();
}

// ---------------------------------------------------------------------------
// Evidence Record — Canonical Entity
// ---------------------------------------------------------------------------

/**
 * Unified evidence record.
 * Every uploaded file (document, image, audio, video) gets one.
 * Contains metadata, integrity hashes, and processing status.
 *
 * Immutability contract:
 *   - sha256Hash is REQUIRED and IMMUTABLE once set.
 *   - sha3Hash is REQUIRED and IMMUTABLE once set.
 */
export interface EvidenceRecord {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  fileName: string;
  fileType: EvidenceType;
  mimeType: string;
  fileSize: number;                         // Bytes
  uploadTimestamp: string;                  // ISO 8601
  storageLocation: string;                 // R2 path
  sha256Hash: string;                      // SHA-256 — primary integrity hash
  sha3Hash: string;                        // SHA3-256 — secondary integrity hash
  processingStatus: EvidenceProcessingStatus;
  uploadedBy: string;
  integrityVerified: boolean;
}

// ---------------------------------------------------------------------------
// Evidence Upload Input
// ---------------------------------------------------------------------------

/**
 * Input for uploading evidence.
 * The caller provides the file + context; the system handles classification.
 */
export interface EvidenceUploadInput {
  file: File;
  caseId: string;
  tenantId: string;
  uploadedBy: string;
  uploadTimestamp: string;                  // ISO 8601
}

// ---------------------------------------------------------------------------
// Evidence Upload Result
// ---------------------------------------------------------------------------

export interface EvidenceUploadResult {
  success: boolean;
  record: EvidenceRecord | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Evidence Type Labels
// ---------------------------------------------------------------------------

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  document: 'Document',
  image: 'Image',
  audio: 'Audio Recording',
  video: 'Video Recording',
} as const;

export const EVIDENCE_STATUS_LABELS: Record<EvidenceProcessingStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  complete: 'Complete',
  error: 'Error',
} as const;
