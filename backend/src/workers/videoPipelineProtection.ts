// ============================================================================
// Production Security Patch — Video Pipeline Protection
// PART 6: Process videos in 30-second chunks instead of whole files.
//
// Strategy:
//   1. Accept video upload
//   2. Probe duration with ffprobe
//   3. Segment into 30-second chunks using ffmpeg -segment_time 30
//   4. Each segment becomes its own BullMQ job in video-segment-queue
//   5. Results are stitched back together after all segments complete
//
// This prevents memory exhaustion from processing large video files.
// ============================================================================

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Maximum duration of each video segment in seconds */
export const SEGMENT_DURATION_SECONDS = 30;

/** Maximum total video duration in seconds (10 hours) */
export const MAX_VIDEO_DURATION_SECONDS = 36_000;

/** Maximum video file size in bytes (10 GB) */
export const MAX_VIDEO_SIZE_BYTES = 10 * 1024 * 1024 * 1024;

/** Supported video MIME types */
export const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/mpeg',
];

/** Queue name for video segment processing */
export const VIDEO_SEGMENT_QUEUE = 'video-segment-queue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoSegment {
  segmentIndex: number;
  startTime: number;
  endTime: number;
  segmentPath: string;
  originalVideoId: string;
  tenantId: string;
  caseId: string;
}

export interface VideoChunkPlan {
  videoId: string;
  tenantId: string;
  caseId: string;
  originalPath: string;
  totalDuration: number;
  totalSegments: number;
  segments: VideoSegment[];
  segmentDuration: number;
}

export interface VideoProcessingResult {
  videoId: string;
  totalSegments: number;
  completedSegments: number;
  failedSegments: number;
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
}

// ---------------------------------------------------------------------------
// Video Validation
// ---------------------------------------------------------------------------

export interface VideoValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a video file before processing.
 */
export function validateVideoFile(
  fileSizeBytes: number,
  mimeType: string,
  durationSeconds?: number,
): VideoValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check MIME type
  if (!SUPPORTED_VIDEO_TYPES.includes(mimeType)) {
    errors.push(`Unsupported video format: ${mimeType}. Supported: ${SUPPORTED_VIDEO_TYPES.join(', ')}`);
  }

  // Check file size (10 GB limit)
  if (fileSizeBytes > MAX_VIDEO_SIZE_BYTES) {
    const maxGB = MAX_VIDEO_SIZE_BYTES / (1024 * 1024 * 1024);
    const actualGB = (fileSizeBytes / (1024 * 1024 * 1024)).toFixed(2);
    errors.push(`Video file size ${actualGB}GB exceeds maximum ${maxGB}GB`);
  }

  // Check duration if provided
  if (durationSeconds !== undefined) {
    if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
      const maxHours = MAX_VIDEO_DURATION_SECONDS / 3600;
      const actualHours = (durationSeconds / 3600).toFixed(1);
      errors.push(`Video duration ${actualHours}h exceeds maximum ${maxHours}h`);
    }
    if (durationSeconds > 3600) {
      warnings.push('Video exceeds 1 hour — processing will be split into many segments');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Chunking Plan Generator
// ---------------------------------------------------------------------------

/**
 * Generate a chunking plan for a video file.
 * Divides the video into SEGMENT_DURATION_SECONDS chunks.
 * Each segment will be processed as a separate job.
 */
export function generateChunkPlan(
  videoId: string,
  tenantId: string,
  caseId: string,
  originalPath: string,
  totalDurationSeconds: number,
): VideoChunkPlan {
  const totalSegments = Math.ceil(totalDurationSeconds / SEGMENT_DURATION_SECONDS);
  const segments: VideoSegment[] = [];

  for (let i = 0; i < totalSegments; i++) {
    const startTime = i * SEGMENT_DURATION_SECONDS;
    const endTime = Math.min((i + 1) * SEGMENT_DURATION_SECONDS, totalDurationSeconds);

    segments.push({
      segmentIndex: i,
      startTime,
      endTime,
      segmentPath: `${originalPath}.segment_${String(i).padStart(4, '0')}`,
      originalVideoId: videoId,
      tenantId,
      caseId,
    });
  }

  return {
    videoId,
    tenantId,
    caseId,
    originalPath,
    totalDuration: totalDurationSeconds,
    totalSegments,
    segments,
    segmentDuration: SEGMENT_DURATION_SECONDS,
  };
}

/**
 * Generate the ffmpeg command for segmenting a video.
 * Uses -f segment with -segment_time for chunk splitting.
 *
 * Returns an array of arguments for use with child_process.spawn()
 * (NOT a joined string — avoids shell injection via filenames).
 *
 * Example usage:
 *   const args = generateFfmpegSegmentCommand(inputPath, outputPattern);
 *   spawn(args[0], args.slice(1));
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
// Processing Status Tracking
// ---------------------------------------------------------------------------

const processingStatus = new Map<string, VideoProcessingResult>();

export function initVideoProcessing(videoId: string, totalSegments: number): void {
  processingStatus.set(videoId, {
    videoId,
    totalSegments,
    completedSegments: 0,
    failedSegments: 0,
    status: 'processing',
  });
}

export function markSegmentCompleted(videoId: string): void {
  const status = processingStatus.get(videoId);
  if (!status) return;
  status.completedSegments++;
  if (status.completedSegments + status.failedSegments >= status.totalSegments) {
    status.status = status.failedSegments > 0 ? 'partial' : 'completed';
  }
}

export function markSegmentFailed(videoId: string): void {
  const status = processingStatus.get(videoId);
  if (!status) return;
  status.failedSegments++;
  if (status.completedSegments + status.failedSegments >= status.totalSegments) {
    status.status = status.failedSegments === status.totalSegments ? 'failed' : 'partial';
  }
}

export function getVideoProcessingStatus(videoId: string): VideoProcessingResult | null {
  return processingStatus.get(videoId) ?? null;
}

// ---------------------------------------------------------------------------
// Exported Configuration
// ---------------------------------------------------------------------------

export const VIDEO_PIPELINE_CONFIG = {
  segmentDurationSeconds: SEGMENT_DURATION_SECONDS,
  maxVideoSizeBytes: MAX_VIDEO_SIZE_BYTES,
  maxVideoDurationSeconds: MAX_VIDEO_DURATION_SECONDS,
  supportedTypes: SUPPORTED_VIDEO_TYPES,
  queueName: VIDEO_SEGMENT_QUEUE,
  strategy: 'ffmpeg-segment-then-queue',
  description: 'Videos are split into 30-second chunks. Each chunk is processed as a separate BullMQ job.',
};
