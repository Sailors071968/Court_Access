// ============================================
// Court Access — Phase 52: Media Transcription Service
// Whisper-based audio/video transcription pipeline.
//
// Pipeline:
// 1. Accept audio/video evidence
// 2. Transcribe via OpenAI Whisper API
// 3. Segment transcript by timestamps
// 4. Store segments in MediaTranscript table
// 5. Index in evidence search
// ============================================

import { config } from '../config/index.js';
import prisma from './prismaClient.js';
import { captureException } from './errorMonitoring.js';

let openaiClient = null;

/**
 * Lazy-initialize OpenAI client for Whisper API.
 */
async function getClient() {
  if (openaiClient) return openaiClient;
  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured — transcription unavailable');
  }
  const { default: OpenAI } = await import('openai');
  openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
  return openaiClient;
}

/**
 * Transcribe an audio/video file using OpenAI Whisper.
 *
 * @param {Buffer} fileBuffer - The audio/video file buffer
 * @param {string} filename - Original filename
 * @param {string} evidenceId - Evidence record ID
 * @param {string} caseId - Case ID
 * @returns {Promise<{transcriptId: string, segments: Array}>}
 */
export async function transcribeMedia(fileBuffer, filename, evidenceId, caseId) {
  const client = await getClient();

  console.log(`[Transcription] Starting transcription: evidence=${evidenceId}, file=${filename}`);

  // Update status to processing
  await prisma.mediaTranscript.updateMany({
    where: { evidenceId, fullTranscript: true },
    data: { status: 'processing' },
  }).catch(() => {});

  try {
    // Create a File object from the buffer for the Whisper API
    const file = new File([fileBuffer], filename, {
      type: getMimeType(filename),
    });

    // Call Whisper API with verbose_json for timestamps
    const response = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    const fullText = response.text || '';
    const segments = response.segments || [];
    const language = response.language || 'en';

    console.log(`[Transcription] Complete: ${segments.length} segments, language=${language}`);

    // Store full transcript
    const fullTranscript = await prisma.mediaTranscript.create({
      data: {
        evidenceId,
        caseId,
        transcriptText: fullText,
        confidenceScore: calculateAvgConfidence(segments),
        language,
        modelVersion: 'whisper-1',
        fullTranscript: true,
        status: 'complete',
        startTime: 0,
        endTime: segments.length > 0 ? segments[segments.length - 1].end : 0,
        metadata: {
          segmentCount: segments.length,
          filename,
          duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
        },
      },
    });

    // Store individual segments
    const segmentRecords = [];
    for (const seg of segments) {
      const record = await prisma.mediaTranscript.create({
        data: {
          evidenceId,
          caseId,
          speakerLabel: '', // Whisper doesn't provide speaker labels by default
          startTime: seg.start || 0,
          endTime: seg.end || 0,
          transcriptText: seg.text || '',
          confidenceScore: seg.avg_logprob ? Math.exp(seg.avg_logprob) : 0.5,
          language,
          modelVersion: 'whisper-1',
          fullTranscript: false,
          status: 'complete',
        },
      });
      segmentRecords.push(record);
    }

    console.log(`[Transcription] Stored ${segmentRecords.length} segments for evidence=${evidenceId}`);

    return {
      transcriptId: fullTranscript.id,
      fullText,
      segments: segmentRecords,
      language,
    };
  } catch (err) {
    console.error(`[Transcription] Failed for evidence=${evidenceId}:`, err.message);
    captureException(err, { evidenceId, caseId, filename });

    // Mark as error
    await prisma.mediaTranscript.updateMany({
      where: { evidenceId },
      data: { status: 'error' },
    }).catch(() => {});

    throw err;
  }
}

/**
 * Get transcripts for an evidence item.
 */
export async function getTranscripts(evidenceId) {
  return prisma.mediaTranscript.findMany({
    where: { evidenceId },
    orderBy: { startTime: 'asc' },
  });
}

/**
 * Get all transcripts for a case.
 */
export async function getCaseTranscripts(caseId) {
  return prisma.mediaTranscript.findMany({
    where: { caseId, fullTranscript: true },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Search transcripts by keyword.
 */
export async function searchTranscripts(caseId, query) {
  return prisma.mediaTranscript.findMany({
    where: {
      caseId,
      transcriptText: { contains: query, mode: 'insensitive' },
    },
    orderBy: { startTime: 'asc' },
  });
}

/**
 * Get transcript status for an evidence item.
 */
export async function getTranscriptStatus(evidenceId) {
  const transcript = await prisma.mediaTranscript.findFirst({
    where: { evidenceId, fullTranscript: true },
  });
  return transcript ? transcript.status : 'none';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMimeType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeMap = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
  };
  return mimeMap[ext] || 'audio/mpeg';
}

function calculateAvgConfidence(segments) {
  if (!segments || segments.length === 0) return 0;
  const total = segments.reduce((sum, seg) => {
    const prob = seg.avg_logprob ? Math.exp(seg.avg_logprob) : 0.5;
    return sum + prob;
  }, 0);
  return Math.round((total / segments.length) * 100) / 100;
}
