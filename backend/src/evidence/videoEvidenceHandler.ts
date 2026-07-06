// ============================================================================
// Core Evidence System — Video Evidence Handler (Part 12)
// Handles video evidence types: bodycam, dashcam, witness_video.
// Downloads from S3, segments into 30-second chunks, enqueues segment analysis.
// ============================================================================

import { enqueueVideoSegmentation } from './evidenceProcessingPipeline.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SEGMENT_DURATION_SECONDS = 30;
export const MAX_VIDEO_DURATION_SECONDS = 36_000; // 10 hours
export const MAX_VIDEO_SIZE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

export const VIDEO_EVIDENCE_TYPES = ['bodycam', 'dashcam', 'witness_video'] as const;
export const VIDEO_SEGMENT_QUEUE = 'video-segment-queue';

export const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/mpeg',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoSegmentResult {
  segmentIndex: number;
  startTime: number;
  endTime: number;
  s3Key: string;
  duration: number;
}

export interface VideoProcessingResult {
  evidenceId: string;
  totalDuration: number;
  segmentCount: number;
  segments: VideoSegmentResult[];
}

// ---------------------------------------------------------------------------
// FFmpeg Command Generation (shell injection safe — returns string[])
// ---------------------------------------------------------------------------

/**
 * Generate FFmpeg segment command as an array (safe for spawn()).
 * NEVER join these into a single string for exec().
 */
export function generateFfmpegSegmentCommand(
  inputPath: string,
  outputPattern: string,
): string[] {
  return [
    'ffmpeg',
    '-i', inputPath,
    '-f', 'segment',
    '-segment_time', String(SEGMENT_DURATION_SECONDS),
    '-c', 'copy',
    '-reset_timestamps', '1',
    outputPattern,
  ];
}

// ---------------------------------------------------------------------------
// Video Processing Entry Point
// ---------------------------------------------------------------------------

/**
 * Process a video evidence file:
 * 1. Validate video type and size
 * 2. Enqueue for segmentation
 *
 * Actual segmentation runs in the video-segment-queue worker.
 */
export async function processVideoEvidence(params: {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  s3Key: string;
  fileName: string;
  mimeType?: string;
  fileSize: number;
}): Promise<{ queued: boolean; error?: string }> {
  // Validate video type
  if (params.mimeType && !SUPPORTED_VIDEO_TYPES.includes(params.mimeType)) {
    return {
      queued: false,
      error: `Unsupported video type: ${params.mimeType}. Supported: ${SUPPORTED_VIDEO_TYPES.join(', ')}`,
    };
  }

  // Validate size
  if (params.fileSize > MAX_VIDEO_SIZE_BYTES) {
    return {
      queued: false,
      error: `Video exceeds maximum size of ${MAX_VIDEO_SIZE_BYTES / (1024 * 1024 * 1024)} GB`,
    };
  }

  // Enqueue for segmentation
  await enqueueVideoSegmentation({
    evidenceId: params.evidenceId,
    caseId: params.caseId,
    tenantId: params.tenantId,
    s3Key: params.s3Key,
    fileName: params.fileName,
  });

  return { queued: true };
}

/**
 * Calculate expected segment count for a video duration.
 */
export function calculateSegmentCount(durationSeconds: number): number {
  return Math.ceil(durationSeconds / SEGMENT_DURATION_SECONDS);
}
