// ============================================================================
// Phase B — FFmpeg Service
// Safe FFmpeg integration for video segmentation, frame extraction, and probing.
// All operations use spawn() with string[] args (no shell injection).
// ============================================================================

import { spawn } from 'node:child_process';
import { mkdir, rm, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoProbeResult {
  durationSec: number;
  codec: string;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  fileSizeBytes: number;
  audioCodec: string | null;
  hasAudio: boolean;
}

export interface SegmentResult {
  segmentIndex: number;
  filePath: string;
  fileName: string;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  fileSize: number;
}

export interface FrameExtractionResult {
  frameIndex: number;
  filePath: string;
  fileName: string;
  timestampSec: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SEGMENT_DURATION_SEC = 30;
const DEFAULT_FRAME_INTERVAL_SEC = 2; // Extract 1 frame every 2 seconds
const FFMPEG_TIMEOUT_MS = 600_000; // 10 minutes max per operation
const FFPROBE_TIMEOUT_MS = 30_000; // 30 seconds for probing

// ---------------------------------------------------------------------------
// Temp Directory Management
// ---------------------------------------------------------------------------

/**
 * Create a temporary working directory for video processing.
 * Returns the directory path. Caller MUST clean up via cleanupTempDir().
 */
export async function createTempDir(prefix: string = 'courtaccess-video'): Promise<string> {
  const dirName = `${prefix}-${randomUUID()}`;
  const dirPath = join(tmpdir(), dirName);
  await mkdir(dirPath, { recursive: true });
  return dirPath;
}

/**
 * Remove a temporary directory and all its contents.
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    await rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    console.error(`[FFmpeg] Failed to cleanup temp dir ${dirPath}:`, err);
  }
}

// ---------------------------------------------------------------------------
// FFprobe — Extract Video Metadata
// ---------------------------------------------------------------------------

/**
 * Probe a video file to extract metadata (duration, codec, resolution, etc.).
 * Uses ffprobe (JSON output) for reliable parsing.
 */
export async function probeVideo(filePath: string): Promise<VideoProbeResult> {
  const args = [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ];

  const output = await runProcess('ffprobe', args, FFPROBE_TIMEOUT_MS);
  const parsed = JSON.parse(output) as {
    format?: {
      duration?: string;
      bit_rate?: string;
      size?: string;
    };
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
      avg_frame_rate?: string;
    }>;
  };

  const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');
  const audioStream = parsed.streams?.find((s) => s.codec_type === 'audio');

  // Parse frame rate from fraction string like "30000/1001"
  const fpsRaw = videoStream?.avg_frame_rate ?? videoStream?.r_frame_rate ?? '0/1';
  const fpsParts = fpsRaw.split('/');
  const fps = fpsParts.length === 2 && Number(fpsParts[1]) > 0
    ? Number(fpsParts[0]) / Number(fpsParts[1])
    : Number(fpsParts[0]) || 0;

  let fileSizeBytes = 0;
  try {
    const fileStat = await stat(filePath);
    fileSizeBytes = Number(fileStat.size);
  } catch {
    fileSizeBytes = Number(parsed.format?.size ?? 0);
  }

  return {
    durationSec: parseFloat(parsed.format?.duration ?? '0'),
    codec: videoStream?.codec_name ?? 'unknown',
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
    fps: Math.round(fps * 100) / 100,
    bitrate: parseInt(parsed.format?.bit_rate ?? '0', 10),
    fileSizeBytes,
    audioCodec: audioStream?.codec_name ?? null,
    hasAudio: !!audioStream,
  };
}

// ---------------------------------------------------------------------------
// Video Segmentation
// ---------------------------------------------------------------------------

/**
 * Split a video file into segments of a given duration using stream copy (fast, no re-encode).
 * Returns metadata about each segment file created.
 */
export async function segmentVideo(
  inputPath: string,
  outputDir: string,
  segmentDurationSec: number = DEFAULT_SEGMENT_DURATION_SEC,
  signal?: AbortSignal,
): Promise<SegmentResult[]> {
  await mkdir(outputDir, { recursive: true });

  const outputPattern = join(outputDir, 'segment_%04d.mp4');

  const args = [
    '-i', inputPath,
    '-f', 'segment',
    '-segment_time', String(segmentDurationSec),
    '-c', 'copy',
    '-reset_timestamps', '1',
    '-map', '0',
    '-movflags', '+faststart',
    outputPattern,
  ];

  await runProcess('ffmpeg', args, FFMPEG_TIMEOUT_MS, signal);

  // Read output directory to discover created segments
  const files = await readdir(outputDir);
  const segmentFiles = files
    .filter((f) => f.startsWith('segment_') && f.endsWith('.mp4'))
    .sort();

  const results: SegmentResult[] = [];
  for (let i = 0; i < segmentFiles.length; i++) {
    const filePath = join(outputDir, segmentFiles[i]);
    const fileStat = await stat(filePath);
    const startTimeSec = i * segmentDurationSec;

    // Probe each segment for actual duration
    let actualDuration = segmentDurationSec;
    try {
      const probeResult = await probeVideo(filePath);
      actualDuration = probeResult.durationSec;
    } catch {
      // Use estimated duration if probe fails
    }

    results.push({
      segmentIndex: i,
      filePath,
      fileName: segmentFiles[i],
      startTimeSec,
      endTimeSec: startTimeSec + actualDuration,
      durationSec: actualDuration,
      fileSize: Number(fileStat.size),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Key Frame Extraction
// ---------------------------------------------------------------------------

/**
 * Extract key frames from a video at regular intervals.
 * Outputs JPEG images named frame_000000.jpg, frame_000001.jpg, etc.
 */
export async function extractKeyFrames(
  inputPath: string,
  outputDir: string,
  intervalSec: number = DEFAULT_FRAME_INTERVAL_SEC,
  signal?: AbortSignal,
): Promise<FrameExtractionResult[]> {
  await mkdir(outputDir, { recursive: true });

  const outputPattern = join(outputDir, 'frame_%06d.jpg');

  const args = [
    '-i', inputPath,
    '-vf', `fps=1/${intervalSec}`,
    '-q:v', '2', // High quality JPEG
    '-f', 'image2',
    outputPattern,
  ];

  await runProcess('ffmpeg', args, FFMPEG_TIMEOUT_MS, signal);

  // Read output directory
  const files = await readdir(outputDir);
  const frameFiles = files
    .filter((f) => f.startsWith('frame_') && f.endsWith('.jpg'))
    .sort();

  return frameFiles.map((fileName, index) => ({
    frameIndex: index,
    filePath: join(outputDir, fileName),
    fileName,
    timestampSec: index * intervalSec,
  }));
}

// ---------------------------------------------------------------------------
// Process Runner (safe spawn, no shell)
// ---------------------------------------------------------------------------

function runProcess(
  command: string,
  args: string[],
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Operation cancelled'));
      return;
    }

    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const abortHandler = () => {
      proc.kill('SIGTERM');
      reject(new Error('Operation cancelled by abort signal'));
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    proc.on('close', (code) => {
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }

      if (code === 0) {
        resolve(stdout);
      } else {
        // ffmpeg writes progress to stderr, so only the last few lines matter for errors
        const stderrTail = stderr.split('\n').slice(-5).join('\n');
        reject(new Error(
          `${command} exited with code ${code}: ${stderrTail}`,
        ));
      }
    });

    proc.on('error', (err) => {
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
      reject(new Error(`Failed to spawn ${command}: ${err.message}`));
    });
  });
}
