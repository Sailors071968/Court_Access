// ============================================
// Court Access — Evidence Processing Limits (Wave 1 Stabilization)
// Defines and enforces hard limits to protect the ingestion pipeline.
//
// Safeguards:
//   - Max document size
//   - Max pages per document
//   - Max concurrent uploads
//   - Max simultaneous transcription jobs
//
// All limits are configurable at runtime via updateLimits().
// ============================================

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface EvidenceLimitsConfig {
  /** Maximum document file size in bytes */
  maxDocumentSizeBytes: number;
  /** Maximum pages per document (PDF, DOCX) */
  maxPagesPerDocument: number;
  /** Maximum concurrent upload operations */
  maxConcurrentUploads: number;
  /** Maximum simultaneous transcription jobs */
  maxSimultaneousTranscriptions: number;
  /** Maximum total pending evidence items across all queues */
  maxTotalPendingEvidence: number;
  /** Maximum file name length in characters */
  maxFileNameLength: number;
  /** Allowed MIME types for evidence uploads */
  allowedMimeTypes: string[];
  /** Whether limit enforcement is enabled */
  enabled: boolean;
}

/**
 * Default evidence processing limits.
 * These are conservative defaults for production safety.
 * Adjust via updateLimits() or admin API.
 */
export const DEFAULT_EVIDENCE_LIMITS: EvidenceLimitsConfig = {
  maxDocumentSizeBytes: 50 * 1024 * 1024, // 50 MB
  maxPagesPerDocument: 500,
  maxConcurrentUploads: 5,
  maxSimultaneousTranscriptions: 3,
  maxTotalPendingEvidence: 100,
  maxFileNameLength: 255,
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'video/mp4',
    'video/quicktime',
    'text/plain',
    'text/csv',
  ],
  enabled: true,
};

// ---------------------------------------------------------------------------
// Validation Result Types
// ---------------------------------------------------------------------------

export type LimitViolation =
  | 'document_too_large'
  | 'too_many_pages'
  | 'upload_capacity_exceeded'
  | 'transcription_capacity_exceeded'
  | 'pending_evidence_exceeded'
  | 'filename_too_long'
  | 'mime_type_not_allowed';

export interface ValidationResult {
  allowed: boolean;
  violations: LimitViolation[];
  messages: string[];
}

// ---------------------------------------------------------------------------
// State (module-scoped singleton)
// ---------------------------------------------------------------------------

let limitsConfig: EvidenceLimitsConfig = { ...DEFAULT_EVIDENCE_LIMITS };

/** Current active upload count */
let activeUploads = 0;

/** Current active transcription count */
let activeTranscriptions = 0;

/** Current total pending evidence count */
let totalPendingEvidence = 0;

/** Tracking counters */
let totalRejections = 0;
let totalValidations = 0;

/** Rejection log */
interface RejectionEntry {
  timestamp: number;
  violations: LimitViolation[];
  fileName: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
}

const rejectionLog: RejectionEntry[] = [];
const MAX_REJECTION_LOG = 200;

// ---------------------------------------------------------------------------
// Validation Functions
// ---------------------------------------------------------------------------

/**
 * Validate a document against all configured limits.
 * Returns a ValidationResult indicating whether the upload should be allowed.
 */
export function validateDocument(doc: {
  fileSizeBytes: number;
  pageCount?: number;
  fileName?: string;
  mimeType?: string;
}): ValidationResult {
  if (!limitsConfig.enabled) {
    return { allowed: true, violations: [], messages: [] };
  }

  totalValidations++;
  const violations: LimitViolation[] = [];
  const messages: string[] = [];

  // Check file size
  if (doc.fileSizeBytes > limitsConfig.maxDocumentSizeBytes) {
    violations.push('document_too_large');
    const maxMB = Math.round(limitsConfig.maxDocumentSizeBytes / 1024 / 1024);
    const actualMB = Math.round(doc.fileSizeBytes / 1024 / 1024 * 100) / 100;
    messages.push(`Document size ${actualMB}MB exceeds maximum ${maxMB}MB`);
  }

  // Check page count
  if (doc.pageCount !== undefined && doc.pageCount > limitsConfig.maxPagesPerDocument) {
    violations.push('too_many_pages');
    messages.push(`Document has ${doc.pageCount} pages, maximum is ${limitsConfig.maxPagesPerDocument}`);
  }

  // Check file name length
  if (doc.fileName && doc.fileName.length > limitsConfig.maxFileNameLength) {
    violations.push('filename_too_long');
    messages.push(`File name length ${doc.fileName.length} exceeds maximum ${limitsConfig.maxFileNameLength}`);
  }

  // Check MIME type
  if (doc.mimeType && !limitsConfig.allowedMimeTypes.includes(doc.mimeType)) {
    violations.push('mime_type_not_allowed');
    messages.push(`MIME type "${doc.mimeType}" is not in the allowed list`);
  }

  // Check upload capacity
  if (activeUploads >= limitsConfig.maxConcurrentUploads) {
    violations.push('upload_capacity_exceeded');
    messages.push(`Concurrent upload limit reached: ${activeUploads}/${limitsConfig.maxConcurrentUploads}`);
  }

  // Check total pending evidence
  if (totalPendingEvidence >= limitsConfig.maxTotalPendingEvidence) {
    violations.push('pending_evidence_exceeded');
    messages.push(`Total pending evidence limit reached: ${totalPendingEvidence}/${limitsConfig.maxTotalPendingEvidence}`);
  }

  const allowed = violations.length === 0;

  if (!allowed) {
    totalRejections++;
    rejectionLog.push({
      timestamp: Date.now(),
      violations,
      fileName: doc.fileName ?? null,
      fileSizeBytes: doc.fileSizeBytes,
      mimeType: doc.mimeType ?? null,
    });
    if (rejectionLog.length > MAX_REJECTION_LOG) {
      rejectionLog.shift();
    }
  }

  return { allowed, violations, messages };
}

/**
 * Check whether a transcription job can be started.
 */
export function canStartTranscription(): ValidationResult {
  if (!limitsConfig.enabled) {
    return { allowed: true, violations: [], messages: [] };
  }

  const violations: LimitViolation[] = [];
  const messages: string[] = [];

  if (activeTranscriptions >= limitsConfig.maxSimultaneousTranscriptions) {
    violations.push('transcription_capacity_exceeded');
    messages.push(`Transcription limit reached: ${activeTranscriptions}/${limitsConfig.maxSimultaneousTranscriptions}`);
  }

  return { allowed: violations.length === 0, violations, messages };
}

// ---------------------------------------------------------------------------
// Capacity Tracking
// ---------------------------------------------------------------------------

/**
 * Register the start of an upload. Returns false if at capacity.
 */
export function acquireUploadSlot(): boolean {
  if (limitsConfig.enabled && activeUploads >= limitsConfig.maxConcurrentUploads) {
    return false;
  }
  activeUploads++;
  return true;
}

/**
 * Register the completion of an upload.
 */
export function releaseUploadSlot(): void {
  activeUploads = Math.max(0, activeUploads - 1);
}

/**
 * Register the start of a transcription job. Returns false if at capacity.
 */
export function acquireTranscriptionSlot(): boolean {
  if (limitsConfig.enabled && activeTranscriptions >= limitsConfig.maxSimultaneousTranscriptions) {
    return false;
  }
  activeTranscriptions++;
  return true;
}

/**
 * Register the completion of a transcription job.
 */
export function releaseTranscriptionSlot(): void {
  activeTranscriptions = Math.max(0, activeTranscriptions - 1);
}

/**
 * Update the total pending evidence count.
 * Call this when evidence items are enqueued or dequeued.
 */
export function updatePendingCount(count: number): void {
  totalPendingEvidence = Math.max(0, count);
}

/**
 * Increment pending evidence count by delta.
 */
export function adjustPendingCount(delta: number): void {
  totalPendingEvidence = Math.max(0, totalPendingEvidence + delta);
}

// ---------------------------------------------------------------------------
// Configuration Management
// ---------------------------------------------------------------------------

/**
 * Update evidence processing limits at runtime.
 * Only provided fields are updated; others retain their current values.
 */
export function updateLimits(updates: Partial<EvidenceLimitsConfig>): void {
  limitsConfig = { ...limitsConfig, ...updates };
  if (updates.allowedMimeTypes) {
    limitsConfig.allowedMimeTypes = updates.allowedMimeTypes;
  }
}

/**
 * Get the current limits configuration.
 */
export function getCurrentLimits(): EvidenceLimitsConfig {
  return { ...limitsConfig };
}

// ---------------------------------------------------------------------------
// Status Reporting
// ---------------------------------------------------------------------------

export interface EvidenceLimitsStatus {
  config: EvidenceLimitsConfig;
  current: {
    activeUploads: number;
    activeTranscriptions: number;
    totalPendingEvidence: number;
    uploadCapacityPercent: number;
    transcriptionCapacityPercent: number;
  };
  stats: {
    totalValidations: number;
    totalRejections: number;
    rejectionRate: number;
  };
  recentRejections: RejectionEntry[];
}

/**
 * Get the full evidence limits status for the admin dashboard.
 */
export function getEvidenceLimitsStatus(): EvidenceLimitsStatus {
  const uploadCap = limitsConfig.maxConcurrentUploads > 0
    ? Math.round((activeUploads / limitsConfig.maxConcurrentUploads) * 100)
    : 0;
  const transcriptionCap = limitsConfig.maxSimultaneousTranscriptions > 0
    ? Math.round((activeTranscriptions / limitsConfig.maxSimultaneousTranscriptions) * 100)
    : 0;

  return {
    config: { ...limitsConfig },
    current: {
      activeUploads,
      activeTranscriptions,
      totalPendingEvidence,
      uploadCapacityPercent: uploadCap,
      transcriptionCapacityPercent: transcriptionCap,
    },
    stats: {
      totalValidations,
      totalRejections,
      rejectionRate: totalValidations > 0
        ? Math.round((totalRejections / totalValidations) * 10000) / 100
        : 0,
    },
    recentRejections: rejectionLog.slice(-20),
  };
}

/**
 * Get a quick summary for inclusion in the system health endpoint.
 */
export function getEvidenceLimitsSummary(): {
  uploadsActive: number;
  uploadsMax: number;
  transcriptionsActive: number;
  transcriptionsMax: number;
  pendingEvidence: number;
  rejectionRate: number;
} {
  return {
    uploadsActive: activeUploads,
    uploadsMax: limitsConfig.maxConcurrentUploads,
    transcriptionsActive: activeTranscriptions,
    transcriptionsMax: limitsConfig.maxSimultaneousTranscriptions,
    pendingEvidence: totalPendingEvidence,
    rejectionRate: totalValidations > 0
      ? Math.round((totalRejections / totalValidations) * 10000) / 100
      : 0,
  };
}

/**
 * Reset all state. Intended for testing only.
 */
export function resetEvidenceLimits(): void {
  limitsConfig = { ...DEFAULT_EVIDENCE_LIMITS };
  activeUploads = 0;
  activeTranscriptions = 0;
  totalPendingEvidence = 0;
  totalRejections = 0;
  totalValidations = 0;
  rejectionLog.length = 0;
}
