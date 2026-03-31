// ============================================================================
// Core Evidence System — Evidence Upload Validation (Parts 2-3, 9)
// Validates file size, count limits, and evidence type constraints.
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Evidence Limits (from Part 9 / evidenceIngestionLimits)
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

const VIDEO_TYPES = ['bodycam', 'dashcam', 'witness_video'];

// ---------------------------------------------------------------------------
// Validation Result
// ---------------------------------------------------------------------------

export interface ValidationResult {
  allowed: boolean;
  statusCode: number;
  error?: string;
  limit?: string;
  current?: string;
}

// ---------------------------------------------------------------------------
// Validate Evidence Upload
// ---------------------------------------------------------------------------

export async function validateEvidenceUpload(
  tenantId: string,
  caseId: string,
  fileSize: number,
  evidenceType: string,
): Promise<ValidationResult> {
  const isVideo = VIDEO_TYPES.includes(evidenceType);

  // Check single file size
  if (isVideo && fileSize > EVIDENCE_LIMITS.maxVideoSizeBytes) {
    return {
      allowed: false,
      statusCode: 413,
      error: 'Video file exceeds maximum size limit',
      limit: `${(EVIDENCE_LIMITS.maxVideoSizeBytes / (1024 * 1024 * 1024)).toFixed(0)} GB`,
      current: `${(fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB`,
    };
  }

  if (!isVideo && fileSize > EVIDENCE_LIMITS.maxSingleFileSizeBytes) {
    return {
      allowed: false,
      statusCode: 413,
      error: 'File exceeds maximum size limit',
      limit: `${(EVIDENCE_LIMITS.maxSingleFileSizeBytes / (1024 * 1024)).toFixed(0)} MB`,
      current: `${(fileSize / (1024 * 1024)).toFixed(2)} MB`,
    };
  }

  try {
    // Count existing evidence for this case
    const existingCount = await prisma.evidence.count({
      where: { caseId, tenantId },
    });

    if (existingCount >= EVIDENCE_LIMITS.maxFilesPerCase) {
      return {
        allowed: false,
        statusCode: 400,
        error: 'Upload limit exceeded: maximum files per case reached',
        limit: String(EVIDENCE_LIMITS.maxFilesPerCase),
        current: String(existingCount),
      };
    }

    // Check total upload size for this case
    const totalSize = await prisma.evidence.aggregate({
      where: { caseId, tenantId },
      _sum: { size: true },
    });

    const currentTotal = Number(totalSize._sum.size ?? 0);
    if (currentTotal + fileSize > EVIDENCE_LIMITS.maxTotalUploadSizeBytes) {
      return {
        allowed: false,
        statusCode: 400,
        error: 'Upload limit exceeded: total case storage limit reached',
        limit: `${(EVIDENCE_LIMITS.maxTotalUploadSizeBytes / (1024 * 1024 * 1024)).toFixed(0)} GB`,
        current: `${((currentTotal + fileSize) / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      };
    }
  } catch (err) {
    console.error('[EvidenceValidation] Failed to check limits:', err);
    // Fail open for limit checks (still enforce single-file limits above)
  }

  return { allowed: true, statusCode: 200 };
}
