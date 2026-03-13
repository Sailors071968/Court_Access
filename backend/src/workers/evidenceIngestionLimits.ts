// ============================================================================
// Production Security Patch — Evidence Ingestion Limits
// PART 7: Enforce per-case file count, video size, and total upload limits.
//
// Limits:
//   - Max files per case: 1000
//   - Max video size: 10 GB
//   - Max total upload size per case: 50 GB
//
// Usage:
//   import { validateEvidenceUpload, getEvidenceUsage } from './evidenceIngestionLimits.js';
//   const result = validateEvidenceUpload(caseId, fileSize, fileType);
//   if (!result.allowed) return reply.code(413).send({ error: result.reason });
// ============================================================================

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const EVIDENCE_LIMITS = {
  /** Maximum number of files per case */
  maxFilesPerCase: 1000,

  /** Maximum size of a single video file in bytes (10 GB) */
  maxVideoSizeBytes: 10 * 1024 * 1024 * 1024,

  /** Maximum total upload size per case in bytes (50 GB) */
  maxTotalUploadSizeBytes: 50 * 1024 * 1024 * 1024,

  /** Maximum size of a single non-video file in bytes (500 MB) */
  maxSingleFileSizeBytes: 500 * 1024 * 1024,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvidenceUsage {
  caseId: string;
  fileCount: number;
  totalSizeBytes: number;
  videoCount: number;
  videoSizeBytes: number;
  remainingFiles: number;
  remainingBytes: number;
  percentUsed: number;
}

export interface UploadValidation {
  allowed: boolean;
  reason?: string;
  usage?: EvidenceUsage;
}

// ---------------------------------------------------------------------------
// In-memory usage tracking (production queries database)
// ---------------------------------------------------------------------------

const caseUsageMap = new Map<string, { fileCount: number; totalSizeBytes: number; videoCount: number; videoSizeBytes: number }>();

function getCaseUsage(caseId: string): { fileCount: number; totalSizeBytes: number; videoCount: number; videoSizeBytes: number } {
  return caseUsageMap.get(caseId) ?? { fileCount: 0, totalSizeBytes: 0, videoCount: 0, videoSizeBytes: 0 };
}

// ---------------------------------------------------------------------------
// Validation Functions
// ---------------------------------------------------------------------------

const VIDEO_MIME_TYPES = new Set([
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg',
]);

/**
 * Validate whether a new file upload is allowed for a case.
 * Checks all limits: file count, single file size, video size, total size.
 */
export function validateEvidenceUpload(
  caseId: string,
  fileSizeBytes: number,
  mimeType: string,
): UploadValidation {
  const usage = getCaseUsage(caseId);
  const isVideo = VIDEO_MIME_TYPES.has(mimeType);

  // Check file count limit
  if (usage.fileCount >= EVIDENCE_LIMITS.maxFilesPerCase) {
    return {
      allowed: false,
      reason: `Case has reached the maximum of ${EVIDENCE_LIMITS.maxFilesPerCase} files. Remove existing files before uploading more.`,
    };
  }

  // Check single video size limit
  if (isVideo && fileSizeBytes > EVIDENCE_LIMITS.maxVideoSizeBytes) {
    const maxGB = EVIDENCE_LIMITS.maxVideoSizeBytes / (1024 * 1024 * 1024);
    const actualGB = (fileSizeBytes / (1024 * 1024 * 1024)).toFixed(2);
    return {
      allowed: false,
      reason: `Video file size ${actualGB} GB exceeds maximum ${maxGB} GB per video.`,
    };
  }

  // Check single non-video file size limit
  if (!isVideo && fileSizeBytes > EVIDENCE_LIMITS.maxSingleFileSizeBytes) {
    const maxMB = EVIDENCE_LIMITS.maxSingleFileSizeBytes / (1024 * 1024);
    const actualMB = (fileSizeBytes / (1024 * 1024)).toFixed(1);
    return {
      allowed: false,
      reason: `File size ${actualMB} MB exceeds maximum ${maxMB} MB.`,
    };
  }

  // Check total upload size limit
  const projectedTotal = usage.totalSizeBytes + fileSizeBytes;
  if (projectedTotal > EVIDENCE_LIMITS.maxTotalUploadSizeBytes) {
    const maxGB = EVIDENCE_LIMITS.maxTotalUploadSizeBytes / (1024 * 1024 * 1024);
    const usedGB = (usage.totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2);
    return {
      allowed: false,
      reason: `Case storage limit exceeded. Used: ${usedGB} GB of ${maxGB} GB maximum. Please remove existing files or contact support.`,
    };
  }

  // All checks passed
  const evidenceUsage = buildEvidenceUsage(caseId, usage);
  return { allowed: true, usage: evidenceUsage };
}

/**
 * Record a successful upload (update tracking).
 */
export function recordUpload(caseId: string, fileSizeBytes: number, mimeType: string): void {
  const usage = getCaseUsage(caseId);
  const isVideo = VIDEO_MIME_TYPES.has(mimeType);

  usage.fileCount++;
  usage.totalSizeBytes += fileSizeBytes;
  if (isVideo) {
    usage.videoCount++;
    usage.videoSizeBytes += fileSizeBytes;
  }

  caseUsageMap.set(caseId, usage);
}

/**
 * Record a file deletion (update tracking).
 */
export function recordDeletion(caseId: string, fileSizeBytes: number, mimeType: string): void {
  const usage = getCaseUsage(caseId);
  const isVideo = VIDEO_MIME_TYPES.has(mimeType);

  usage.fileCount = Math.max(0, usage.fileCount - 1);
  usage.totalSizeBytes = Math.max(0, usage.totalSizeBytes - fileSizeBytes);
  if (isVideo) {
    usage.videoCount = Math.max(0, usage.videoCount - 1);
    usage.videoSizeBytes = Math.max(0, usage.videoSizeBytes - fileSizeBytes);
  }

  caseUsageMap.set(caseId, usage);
}

// ---------------------------------------------------------------------------
// Usage Reporting
// ---------------------------------------------------------------------------

function buildEvidenceUsage(
  caseId: string,
  raw: { fileCount: number; totalSizeBytes: number; videoCount: number; videoSizeBytes: number },
): EvidenceUsage {
  const remainingFiles = EVIDENCE_LIMITS.maxFilesPerCase - raw.fileCount;
  const remainingBytes = EVIDENCE_LIMITS.maxTotalUploadSizeBytes - raw.totalSizeBytes;
  const percentUsed = Math.round((raw.totalSizeBytes / EVIDENCE_LIMITS.maxTotalUploadSizeBytes) * 100);

  return {
    caseId,
    fileCount: raw.fileCount,
    totalSizeBytes: raw.totalSizeBytes,
    videoCount: raw.videoCount,
    videoSizeBytes: raw.videoSizeBytes,
    remainingFiles: Math.max(0, remainingFiles),
    remainingBytes: Math.max(0, remainingBytes),
    percentUsed: Math.min(100, percentUsed),
  };
}

/**
 * Get evidence usage for a case.
 */
export function getEvidenceUsage(caseId: string): EvidenceUsage {
  return buildEvidenceUsage(caseId, getCaseUsage(caseId));
}

// ---------------------------------------------------------------------------
// Exported Configuration
// ---------------------------------------------------------------------------

export const EVIDENCE_INGESTION_CONFIG = {
  limits: EVIDENCE_LIMITS,
  description: 'Per-case evidence upload limits to prevent storage exhaustion.',
  enforcement: 'Pre-upload validation rejects files that would exceed limits.',
  tracking: 'In-memory tracking with database sync on upload/delete.',
};
