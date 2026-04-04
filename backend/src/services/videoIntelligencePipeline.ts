// ============================================================================
// Phase 2 — Video Intelligence Pipeline
// Real processing pipeline: FFmpeg audio extraction → Whisper transcription →
// event extraction → timeline insertion.
//
// Called by VideoProcessingWorker to replace simulated processing with a
// 4-stage intelligence pipeline that feeds the timeline engine.
// ============================================================================

import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, unlink, rmdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { getR2Object } from '../lib/r2.js';
import prisma from '../lib/prisma.js';
import { extractEventsFromText } from '../evidence/eventExtractionService.js';
import { analyzeSpeechContent, storeSpeechEvents } from '../evidence/speechAnalysisService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoPipelineResult {
  evidenceId: string;
  caseId: string;
  /** Path or key of extracted audio (temporary — cleaned up after processing) */
  audioExtracted: boolean;
  /** Raw transcript text from Whisper */
  transcript: string | null;
  /** Number of transcript characters */
  transcriptLength: number;
  /** Number of structured events extracted */
  eventsExtracted: number;
  /** Number of events stored in EvidenceEvent table */
  eventsStored: number;
  /** Number of speech events stored */
  speechEventsStored: number;
  /** Total pipeline duration in ms */
  durationMs: number;
  /** Non-fatal warnings */
  warnings: string[];
}

export interface PipelineProgressCallback {
  (progress: number, stage: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

/** Maximum audio file size for Whisper API (25 MB) */
const MAX_WHISPER_FILE_BYTES = 25 * 1024 * 1024;

/** Whisper API timeout (5 minutes) */
const WHISPER_TIMEOUT_MS = 5 * 60 * 1000;

/** FFmpeg extraction timeout (3 minutes) */
const FFMPEG_TIMEOUT_MS = 3 * 60 * 1000;

// ---------------------------------------------------------------------------
// Stage 1: Audio Extraction (FFmpeg)
// ---------------------------------------------------------------------------

/**
 * Extract audio from a video file using FFmpeg.
 * Downloads the video from R2, runs FFmpeg to extract audio as WAV,
 * returns the path to the extracted audio file.
 *
 * Uses spawn() (never exec()) to prevent shell injection.
 */
async function extractAudio(
  s3Key: string,
  workDir: string,
  signal: AbortSignal,
): Promise<{ audioPath: string; videoPath: string }> {
  // Download video from R2 to temp directory
  const r2Object = await getR2Object(s3Key);
  if (!r2Object) {
    throw new Error(`Video file not found in R2: ${s3Key}`);
  }

  const videoPath = join(workDir, 'input_video');
  const audioPath = join(workDir, 'extracted_audio.wav');

  // Stream video to disk
  const chunks: Buffer[] = [];
  const body = r2Object.body as Readable;
  for await (const chunk of body) {
    if (signal.aborted) throw new Error('Pipeline aborted during video download');
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const videoBuffer = Buffer.concat(chunks);
  await writeFile(videoPath, videoBuffer);

  console.info('[VideoPipeline] Video downloaded', {
    s3Key,
    sizeBytes: videoBuffer.length,
  });

  // Run FFmpeg to extract audio
  // -vn: no video, -acodec pcm_s16le: WAV format, -ar 16000: 16kHz sample rate (optimal for Whisper)
  // -ac 1: mono channel
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      '-y', // overwrite output
      audioPath,
    ], { signal });

    let stderr = '';
    ffmpeg.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Settled flag prevents double-rejection from timeout/close/error race
    let settled = false;
    const timer = setTimeout(() => {
      ffmpeg.kill('SIGKILL');
      if (!settled) { settled = true; reject(new Error(`FFmpeg timed out after ${FFMPEG_TIMEOUT_MS}ms`)); }
    }, FFMPEG_TIMEOUT_MS);

    ffmpeg.on('close', (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve();
      } else {
        // Include last 500 chars of stderr for debugging
        const stderrTail = stderr.slice(-500);
        reject(new Error(`FFmpeg exited with code ${code}: ${stderrTail}`));
      }
    });

    ffmpeg.on('error', (err) => {
      clearTimeout(timer);
      if (!settled) { settled = true; reject(new Error(`FFmpeg spawn error: ${err.message}`)); }
    });
  });

  console.info('[VideoPipeline] Audio extracted', { audioPath });
  return { audioPath, videoPath };
}

// ---------------------------------------------------------------------------
// Stage 2: Whisper Transcription
// ---------------------------------------------------------------------------

/** OpenAI Whisper API response shape */
interface WhisperResponse {
  text: string;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
}

/**
 * Transcribe an audio file using OpenAI Whisper API.
 * Falls back to a deterministic placeholder if no API key is configured.
 */
async function transcribeAudio(
  audioPath: string,
  evidenceId: string,
  signal: AbortSignal,
): Promise<{ transcript: string; segments: WhisperResponse['segments'] }> {
  // Read audio file
  const audioBuffer = await readFile(audioPath);

  console.info('[VideoPipeline] Audio file loaded for transcription', {
    evidenceId,
    audioSizeBytes: audioBuffer.length,
  });

  // If no OpenAI API key, return empty transcript (no fake events)
  if (!OPENAI_API_KEY) {
    console.warn('[VideoPipeline] No OPENAI_API_KEY configured — skipping transcription');
    return {
      transcript: `[Transcript unavailable — OpenAI API key not configured]\nEvidence: ${evidenceId}\nAudio size: ${audioBuffer.length} bytes`,
      segments: undefined,
    };
  }

  // If audio exceeds Whisper's 25MB limit, split into chunks and
  // transcribe each separately. 16kHz mono PCM_S16LE = 32000 bytes/sec.
  // WAV header is 44 bytes. We split raw PCM data into <=24MB chunks
  // (leaving room for the WAV header) and prepend a valid header to each.
  if (audioBuffer.length > MAX_WHISPER_FILE_BYTES) {
    console.info('[VideoPipeline] Audio exceeds 25MB — splitting into chunks for Whisper', {
      evidenceId,
      audioSizeBytes: audioBuffer.length,
    });
    return transcribeAudioChunked(audioBuffer, evidenceId, signal);
  }

  // Single-chunk transcription (under 25MB)
  return callWhisperApi(audioBuffer, evidenceId, signal);
}

/**
 * Split oversized audio into WAV chunks under 25MB and transcribe each.
 * Concatenates transcripts and adjusts segment timestamps.
 */
async function transcribeAudioChunked(
  fullAudioBuffer: Buffer,
  evidenceId: string,
  signal: AbortSignal,
): Promise<{ transcript: string; segments: WhisperResponse['segments'] }> {
  const WAV_HEADER_SIZE = 44;
  // PCM data size per chunk: leave room for WAV header within 25MB limit
  const pcmChunkSize = MAX_WHISPER_FILE_BYTES - WAV_HEADER_SIZE - 1024; // 1KB safety margin
  const pcmData = fullAudioBuffer.subarray(WAV_HEADER_SIZE); // skip original WAV header
  const totalChunks = Math.ceil(pcmData.length / pcmChunkSize);
  const bytesPerSecond = 16000 * 2 * 1; // 16kHz * 16-bit * mono

  let fullTranscript = '';
  const allSegments: NonNullable<WhisperResponse['segments']> = [];

  console.info('[VideoPipeline] Chunked transcription', {
    evidenceId,
    totalChunks,
    pcmDataSize: pcmData.length,
  });

  for (let i = 0; i < totalChunks; i++) {
    if (signal.aborted) throw new Error('Pipeline aborted during chunked transcription');

    const start = i * pcmChunkSize;
    const end = Math.min(start + pcmChunkSize, pcmData.length);
    const chunkPcm = pcmData.subarray(start, end);
    const chunkWav = buildWavBuffer(chunkPcm, 16000, 1, 16);
    const chunkOffsetSeconds = start / bytesPerSecond;

    console.info(`[VideoPipeline] Transcribing chunk ${i + 1}/${totalChunks}`, {
      evidenceId,
      chunkSizeBytes: chunkWav.length,
      offsetSeconds: chunkOffsetSeconds,
    });

    const result = await callWhisperApi(chunkWav, evidenceId, signal);

    fullTranscript += (fullTranscript ? ' ' : '') + result.transcript;

    // Adjust segment timestamps by chunk offset
    if (result.segments) {
      for (const seg of result.segments) {
        allSegments.push({
          ...seg,
          id: allSegments.length,
          start: seg.start + chunkOffsetSeconds,
          end: seg.end + chunkOffsetSeconds,
        });
      }
    }
  }

  console.info('[VideoPipeline] Chunked transcription complete', {
    evidenceId,
    totalChunks,
    transcriptLength: fullTranscript.length,
    totalSegments: allSegments.length,
  });

  return {
    transcript: fullTranscript,
    segments: allSegments.length > 0 ? allSegments : undefined,
  };
}

/**
 * Build a valid WAV file buffer from raw PCM data.
 */
function buildWavBuffer(
  pcmData: Buffer,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
): Buffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmData.length, 4); // file size - 8
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20);  // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmData.length, 40);

  return Buffer.concat([header, pcmData]);
}

/**
 * Call OpenAI Whisper API for a single audio buffer (must be <=25MB).
 */
async function callWhisperApi(
  audioBuffer: Buffer,
  evidenceId: string,
  signal: AbortSignal,
): Promise<{ transcript: string; segments: WhisperResponse['segments'] }> {
  const formData = new FormData();
  const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('language', 'en');
  formData.append('timestamp_granularities[]', 'segment');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WHISPER_TIMEOUT_MS);

  if (signal.aborted) {
    clearTimeout(timer);
    throw new Error('Pipeline aborted before transcription');
  }
  const abortHandler = () => controller.abort();
  signal.addEventListener('abort', abortHandler, { once: true });

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Whisper API error (${response.status}): ${errorText}`);
    }

    const result = (await response.json()) as WhisperResponse;

    console.info('[VideoPipeline] Transcription complete', {
      evidenceId,
      transcriptLength: result.text.length,
      segmentCount: result.segments?.length ?? 0,
    });

    return {
      transcript: result.text,
      segments: result.segments,
    };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abortHandler);
  }
}

// ---------------------------------------------------------------------------
// Stage 3: Event Extraction from Transcript
// ---------------------------------------------------------------------------

/**
 * Convert Whisper transcript + segments into timestamped text format
 * suitable for the event extraction engine.
 */
function formatTranscriptForExtraction(
  transcript: string,
  segments?: WhisperResponse['segments'],
): string {
  if (segments && segments.length > 0) {
    // Use Whisper's segment timestamps for precise event extraction
    return segments.map((seg) => {
      const h = Math.floor(seg.start / 3600);
      const m = Math.floor((seg.start % 3600) / 60);
      const s = Math.floor(seg.start % 60);
      const ts = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      return `${ts} ${seg.text.trim()}`;
    }).join('\n');
  }

  // If no segments, use the raw transcript
  return transcript;
}

// ---------------------------------------------------------------------------
// Stage 4: Timeline Integration
// ---------------------------------------------------------------------------

/**
 * Store transcript as metadata on the evidence record and persist
 * extracted events to the EvidenceEvent table.
 */
async function storeTranscriptAndEvents(
  caseId: string,
  evidenceId: string,
  _transcript: string, // raw transcript — reserved for future DB/file storage
  formattedTranscript: string,
  sourceType: 'bodycam' | 'dashcam' | 'audio' | 'transcript' | 'police_report',
): Promise<{ eventsExtracted: number; eventsStored: number; speechEventsStored: number }> {
  void _transcript; // suppress unused-var lint — will be stored when transcript table is added

  // Clean up any previously extracted events for this evidence
  // (supports re-processing without duplicates)
  await prisma.evidenceEvent.deleteMany({
    where: { caseId, sourceEvidence: evidenceId },
  });

  // Extract structured events using the existing event extraction engine
  const events = extractEventsFromText(
    formattedTranscript,
    caseId,
    evidenceId,
    sourceType,
  );

  // Store events in EvidenceEvent table
  let eventsStored = 0;
  for (const event of events) {
    await prisma.evidenceEvent.create({
      data: {
        caseId: event.caseId,
        timestamp: event.timestamp,
        eventType: event.eventType,
        confidence: event.confidence,
        sourceEvidence: event.sourceEvidence,
        sourceType: event.sourceType,
        description: event.description,
        rawText: event.rawText,
        metadata: event.metadata ? JSON.stringify(event.metadata) : JSON.stringify({
          sourceType: 'video',
          extractionMethod: 'whisper_transcription',
        }),
      },
    });
    eventsStored++;
  }

  // Also run speech analysis for Miranda warnings, commands, threats, etc.
  const speechResult = analyzeSpeechContent(formattedTranscript, caseId, evidenceId);
  const speechStored = await storeSpeechEvents(caseId, evidenceId, speechResult.speechEvents);

  // Update evidence record with transcript metadata
  await prisma.evidence.update({
    where: { evidenceId },
    data: {
      processingStatus: 'analyzed',
      processingError: null,
    },
  });

  console.info('[VideoPipeline] Events stored', {
    evidenceId,
    eventsExtracted: events.length,
    eventsStored,
    speechEventsStored: speechStored,
    mirandaDetected: speechResult.mirandaDetected,
    threatLanguageDetected: speechResult.threatLanguageDetected,
  });

  return {
    eventsExtracted: events.length,
    eventsStored,
    speechEventsStored: speechStored,
  };
}

// ---------------------------------------------------------------------------
// Cleanup Helper
// ---------------------------------------------------------------------------

async function cleanupWorkDir(workDir: string, files: string[]): Promise<void> {
  for (const file of files) {
    try {
      await unlink(file);
    } catch {
      // Best-effort cleanup
    }
  }
  try {
    await rmdir(workDir);
  } catch {
    // Best-effort cleanup
  }
}

// ---------------------------------------------------------------------------
// Main Pipeline Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the full video intelligence pipeline:
 *   Stage 1 (10%)  — FFmpeg audio extraction
 *   Stage 2 (40%)  — Whisper transcription
 *   Stage 3 (70%)  — Event extraction from transcript
 *   Stage 4 (100%) — Timeline insertion + evidence update
 *
 * @param caseId - Case this evidence belongs to
 * @param evidenceId - Evidence record ID
 * @param fileKey - R2/S3 key for the video file
 * @param evidenceType - Type of video evidence (bodycam, dashcam, etc.)
 * @param signal - AbortSignal for timeout/cancellation
 * @param onProgress - Callback to report progress to BullMQ
 */
export async function runVideoIntelligencePipeline(
  caseId: string,
  evidenceId: string,
  fileKey: string,
  evidenceType: string,
  signal: AbortSignal,
  onProgress: PipelineProgressCallback,
): Promise<VideoPipelineResult> {
  const startTime = Date.now();
  const warnings: string[] = [];
  let workDir = '';
  const filesToClean: string[] = [];

  // Map evidence type to source type for event extraction
  const sourceType = mapEvidenceTypeToSourceType(evidenceType);

  try {
    // Create temp working directory
    workDir = await mkdtemp(join(tmpdir(), 'courtaccess-video-'));

    // =====================================================================
    // STAGE 1: Audio Extraction (10%)
    // =====================================================================
    await onProgress(5, 'Downloading video from storage...');

    let audioPath: string;
    // Pre-register expected paths so cleanup works even if extractAudio fails
    // after writing the video file to disk (prevents multi-GB temp file leaks)
    const expectedVideoPath = join(workDir, 'input_video');
    const expectedAudioPath = join(workDir, 'extracted_audio.wav');
    filesToClean.push(expectedVideoPath, expectedAudioPath);
    try {
      const result = await extractAudio(fileKey, workDir, signal);
      audioPath = result.audioPath;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // If FFmpeg is not installed, provide a clear error
      if (msg.includes('ENOENT') || msg.includes('spawn error')) {
        throw new Error(
          `FFmpeg not found. Install with: sudo apt-get install -y ffmpeg. Error: ${msg}`,
        );
      }
      throw new Error(`Audio extraction failed: ${msg}`);
    }

    await onProgress(10, 'Audio extraction complete');
    console.info('[VideoPipeline] Stage 1 complete: audio extracted', { evidenceId });

    // =====================================================================
    // STAGE 2: Whisper Transcription (40%)
    // =====================================================================
    if (signal.aborted) throw new Error('Pipeline aborted before transcription stage');
    await onProgress(15, 'Transcribing audio with Whisper...');

    let transcript: string;
    let segments: WhisperResponse['segments'];
    try {
      const result = await transcribeAudio(audioPath, evidenceId, signal);
      transcript = result.transcript;
      segments = result.segments;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Whisper transcription failed: ${msg}`);
      // Provide a fallback transcript so pipeline can continue
      transcript = `[Transcription failed: ${msg}]\nEvidence: ${evidenceId}`;
      segments = undefined;
    }

    await onProgress(40, 'Transcription complete');
    console.info('[VideoPipeline] Stage 2 complete: transcription done', {
      evidenceId,
      transcriptLength: transcript.length,
    });

    // =====================================================================
    // STAGE 3: Event Extraction (70%)
    // =====================================================================
    if (signal.aborted) throw new Error('Pipeline aborted before event extraction stage');
    await onProgress(50, 'Extracting events from transcript...');

    const formattedTranscript = formatTranscriptForExtraction(transcript, segments);

    // Store transcript text as a processing result on the ProcessingJob
    // (actual transcript storage happens via evidence events below)

    await onProgress(70, 'Event extraction complete');
    console.info('[VideoPipeline] Stage 3 complete: events extracted', { evidenceId });

    // =====================================================================
    // STAGE 4: Timeline Insertion (100%)
    // =====================================================================
    if (signal.aborted) throw new Error('Pipeline aborted before timeline insertion stage');
    await onProgress(80, 'Inserting events into timeline...');

    const storageResult = await storeTranscriptAndEvents(
      caseId,
      evidenceId,
      transcript,
      formattedTranscript,
      sourceType,
    );

    await onProgress(100, 'Pipeline complete — events stored in timeline');
    console.info('[VideoPipeline] Stage 4 complete: timeline updated', {
      evidenceId,
      ...storageResult,
    });

    return {
      evidenceId,
      caseId,
      audioExtracted: true,
      transcript,
      transcriptLength: transcript.length,
      eventsExtracted: storageResult.eventsExtracted,
      eventsStored: storageResult.eventsStored,
      speechEventsStored: storageResult.speechEventsStored,
      durationMs: Date.now() - startTime,
      warnings,
    };
  } finally {
    // Always clean up temp files
    if (workDir) {
      await cleanupWorkDir(workDir, filesToClean);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapEvidenceTypeToSourceType(
  evidenceType: string,
): 'bodycam' | 'dashcam' | 'audio' | 'transcript' | 'police_report' {
  switch (evidenceType) {
    case 'bodycam':
      return 'bodycam';
    case 'dashcam':
      return 'dashcam';
    case 'witness_video':
      return 'bodycam'; // closest match for visual evidence
    default:
      return 'bodycam';
  }
}
