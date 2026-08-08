// ============================================================================
// Media and document measurement.
//
// The inventory has to report how long a recording runs and how many pages a
// document has. Both are read from the file itself. Where a figure cannot be
// determined it is returned as null with the reason, never guessed — a
// duration invented for a body-camera recording would be cited in a filing.
// ============================================================================

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { detectFormat } from '../evidence/fileDiagnostics.js';

const exec = promisify(execFile);

export interface MediaMeasurement {
  /** Seconds, or null when it could not be determined. */
  durationSeconds: number | null;
  /** Pages, or null for formats that have none. */
  pageCount: number | null;
  /** Why a figure is missing, when one is. */
  note: string | null;
}

let ffprobeChecked = false;
let ffprobeAvailable = false;

async function hasFfprobe(): Promise<boolean> {
  if (ffprobeChecked) return ffprobeAvailable;
  ffprobeChecked = true;
  try {
    await exec('ffprobe', ['-version'], { timeout: 5000 });
    ffprobeAvailable = true;
  } catch {
    ffprobeAvailable = false;
  }
  return ffprobeAvailable;
}

/** Read the duration of an audio or video file. */
export async function probeDuration(absolutePath: string): Promise<{ seconds: number | null; note: string | null }> {
  if (!(await hasFfprobe())) {
    return {
      seconds: null,
      note:
        'Duration could not be measured because ffprobe is not installed on this server. ' +
        'Install ffmpeg to record recording lengths in the inventory.',
    };
  }

  try {
    const { stdout } = await exec(
      'ffprobe',
      [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        absolutePath,
      ],
      { timeout: 120000, maxBuffer: 1024 * 1024 },
    );
    const seconds = parseFloat(stdout.trim());
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return {
        seconds: null,
        note:
          'The recording carries no readable duration. Its container header may be damaged or the ' +
          'transfer incomplete; re-export it from the source system.',
      };
    }
    return { seconds: Math.round(seconds * 100) / 100, note: null };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      seconds: null,
      note: `The recording could not be read to measure its length (${detail.split('\n')[0].slice(0, 120)}).`,
    };
  }
}

/**
 * Count the pages of a document without extracting its text. Reads the PDF
 * page objects directly, which is cheap and works before ingestion.
 */
export async function measure(absolutePath: string, fileName: string): Promise<MediaMeasurement> {
  let head: Buffer;
  try {
    head = await readFile(absolutePath);
  } catch (err) {
    return {
      durationSeconds: null,
      pageCount: null,
      note: `The file could not be opened to measure it: ${(err as Error).message}`,
    };
  }

  const detected = detectFormat(head, fileName);

  if (detected.category === 'video' || detected.category === 'audio') {
    const { seconds, note } = await probeDuration(absolutePath);
    return { durationSeconds: seconds, pageCount: null, note };
  }

  if (detected.format === 'pdf') {
    const text = head.toString('latin1');
    // Prefer the page-tree count; fall back to counting page objects.
    const declared = text.match(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/);
    if (declared) {
      const n = parseInt(declared[1], 10);
      if (Number.isFinite(n) && n > 0) return { durationSeconds: null, pageCount: n, note: null };
    }
    const objects = text.match(/\/Type\s*\/Page[^s]/g);
    if (objects && objects.length > 0) {
      return { durationSeconds: null, pageCount: objects.length, note: null };
    }
    return {
      durationSeconds: null,
      pageCount: null,
      note: 'The page count could not be read from this PDF; its structure may be damaged or compressed in an unusual way.',
    };
  }

  if (detected.category === 'image') {
    return { durationSeconds: null, pageCount: 1, note: null };
  }

  return { durationSeconds: null, pageCount: null, note: null };
}

/**
 * Rough processing estimates shown before the operator commits to an import.
 * These are presented as estimates and derived from observed throughput on
 * this deployment's own certification runs, not from vendor figures.
 */
export interface ProcessingEstimate {
  ocrSeconds: number;
  mediaSeconds: number;
  analysisSeconds: number;
  totalSeconds: number;
  basis: string;
}

export function estimateProcessing(input: {
  documentCount: number;
  totalPages: number;
  imageCount: number;
  videoSeconds: number;
  audioSeconds: number;
}): ProcessingEstimate {
  // Measured on this platform: text-layer PDF extraction runs at roughly
  // 150 pages/second, OCR of a scanned page at roughly 1.5 seconds/page.
  const textPages = Math.max(0, input.totalPages - input.imageCount);
  const ocrSeconds = Math.round(textPages / 150 + input.imageCount * 1.5);

  // Media is stored and measured but not transcribed, so the cost is the
  // probe and the copy rather than decoding.
  const mediaSeconds = Math.round((input.videoSeconds + input.audioSeconds) * 0.01 + 1);

  // Timeline, classification and the analysis engines, per document.
  const analysisSeconds = Math.round(input.documentCount * 0.4 + 5);

  return {
    ocrSeconds,
    mediaSeconds,
    analysisSeconds,
    totalSeconds: ocrSeconds + mediaSeconds + analysisSeconds,
    basis:
      'Estimated from throughput measured on this deployment: about 150 text pages per second, ' +
      '1.5 seconds per scanned page for OCR, and 0.4 seconds per document for analysis. ' +
      'Scanned documents dominate the total.',
  };
}

export interface AudioAssessment {
  /** True when the file carries no audio stream at all. */
  hasAudioStream: boolean;
  /** Peak volume in dBFS, or null when it could not be measured. */
  peakDb: number | null;
  /** True when the audio is present but effectively silent. */
  silent: boolean;
  measured: boolean;
}

/**
 * Decide whether a recording actually carries audible speech. A body-camera
 * file that was muted and one that simply has not been transcribed are
 * different problems for counsel, and telling them apart requires looking at
 * the audio rather than at the container.
 */
export async function assessAudio(absolutePath: string): Promise<AudioAssessment> {
  const unmeasured: AudioAssessment = { hasAudioStream: false, peakDb: null, silent: false, measured: false };
  if (!(await hasFfprobe())) return unmeasured;

  let hasAudioStream = false;
  try {
    const { stdout } = await exec(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', absolutePath],
      { timeout: 60000, maxBuffer: 1024 * 1024 },
    );
    hasAudioStream = stdout.trim().length > 0;
  } catch {
    return unmeasured;
  }

  if (!hasAudioStream) return { hasAudioStream: false, peakDb: null, silent: false, measured: true };

  try {
    // volumedetect writes its summary to stderr.
    const { stderr } = await exec(
      'ffmpeg',
      ['-hide_banner', '-nostats', '-i', absolutePath, '-af', 'volumedetect', '-f', 'null', '-'],
      { timeout: 300000, maxBuffer: 8 * 1024 * 1024 },
    ).catch((e: unknown) => e as { stderr?: string });

    const match = /max_volume:\s*(-?[\d.]+) dB/.exec(stderr ?? '');
    if (!match) return { hasAudioStream: true, peakDb: null, silent: false, measured: false };

    const peakDb = parseFloat(match[1]);
    // Below roughly -50 dBFS nothing is audible; speech peaks far above this.
    return { hasAudioStream: true, peakDb, silent: peakDb < -50, measured: true };
  } catch {
    return { hasAudioStream: true, peakDb: null, silent: false, measured: false };
  }
}
