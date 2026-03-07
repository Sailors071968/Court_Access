// ============================================
// Court Access — Transcript Parsing Worker
// Phase 115: BullMQ worker for async transcript processing
//
// Queue: transcript-parsing
// Processes court reporter PDFs, multi-column transcripts,
// and line-numbered transcripts into structured JSON.
// ============================================

import { Worker, Queue } from 'bullmq';
import { getRedisConnection } from '../services/redisClient.js';
import { parseTranscript } from '../services/transcriptParser.js';
import { captureException } from '../services/errorMonitoring.js';
import prisma from '../services/prismaClient.js';

const QUEUE_NAME = 'transcript-parsing';
let transcriptQueue = null;
let transcriptWorker = null;

/**
 * Get or create the transcript parsing queue.
 */
export function getTranscriptQueue() {
  if (transcriptQueue) return transcriptQueue;

  const connection = getRedisConnection();
  if (!connection) {
    console.warn('[TranscriptWorker] Redis not available — transcript queue disabled');
    return null;
  }

  transcriptQueue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
    },
  });

  console.log('[TranscriptWorker] Transcript parsing queue created');
  return transcriptQueue;
}

/**
 * Enqueue a transcript parsing job.
 *
 * @param {object} params
 * @param {string} params.evidenceId - Evidence record ID
 * @param {string} params.caseId - Case ID
 * @param {string} params.rawText - Raw transcript text to parse
 * @param {string} params.format - 'auto' | 'court_reporter' | 'multi_column' | 'line_numbered'
 */
export async function enqueueTranscriptJob(params) {
  const queue = getTranscriptQueue();
  if (!queue) {
    console.warn('[TranscriptWorker] Cannot enqueue — queue not available');
    return null;
  }

  const job = await queue.add('parse-transcript', {
    evidenceId: params.evidenceId,
    caseId: params.caseId,
    rawText: params.rawText,
    format: params.format || 'auto',
    createdAt: new Date().toISOString(),
  });

  console.log(`[TranscriptWorker] Job enqueued: ${job.id} for evidence ${params.evidenceId}`);
  return job;
}

/**
 * Process a transcript parsing job.
 */
async function processTranscriptJob(job) {
  const { evidenceId, caseId, rawText, format } = job.data;

  console.log(`[TranscriptWorker] Processing transcript for evidence ${evidenceId}`);
  await job.updateProgress({ step: 'parsing', percent: 10 });

  // Parse the transcript
  const result = parseTranscript(rawText, { format });

  await job.updateProgress({ step: 'storing', percent: 60 });

  // Store parsed segments in database
  for (const segment of result.segments) {
    await prisma.mediaTranscript.create({
      data: {
        evidenceId,
        caseId,
        speakerLabel: segment.speaker || '',
        startTime: 0,
        endTime: 0,
        transcriptText: segment.dialogue,
        confidenceScore: 1.0,
        language: 'en',
        modelVersion: 'transcript-parser-v1',
        fullTranscript: false,
        status: 'complete',
        metadata: {
          lineNumber: segment.lineNumber,
          timestamp: segment.timestamp,
          format: result.metadata.format,
        },
      },
    });
  }

  await job.updateProgress({ step: 'complete', percent: 100 });

  console.log(`[TranscriptWorker] Transcript parsed: ${result.segments.length} segments from evidence ${evidenceId}`);

  return {
    evidenceId,
    caseId,
    segmentCount: result.segments.length,
    metadata: result.metadata,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Start the transcript parsing worker.
 */
export function startTranscriptWorker() {
  const connection = getRedisConnection();
  if (!connection) {
    console.warn('[TranscriptWorker] Redis not available — worker not started');
    return null;
  }

  transcriptWorker = new Worker(QUEUE_NAME, processTranscriptJob, {
    connection,
    concurrency: 2,
    limiter: { max: 5, duration: 60000 },
  });

  transcriptWorker.on('completed', (job, result) => {
    console.log(`[TranscriptWorker] Job completed: ${job.id} — ${result.segmentCount} segments`);
  });

  transcriptWorker.on('failed', (job, err) => {
    console.error(`[TranscriptWorker] Job failed: ${job?.id} — ${err.message}`);
    captureException(err, { context: 'transcript-worker', jobId: job?.id });
  });

  transcriptWorker.on('error', (err) => {
    if (!err.message?.includes('ECONNREFUSED') && !err.message?.includes('Connection is closed')) {
      console.error(`[TranscriptWorker] Worker error: ${err.message}`);
    }
  });

  console.log('[TranscriptWorker] Transcript parsing worker started (concurrency: 2)');
  return transcriptWorker;
}

/**
 * Stop the transcript worker.
 */
export async function stopTranscriptWorker() {
  if (transcriptWorker) {
    await transcriptWorker.close();
    transcriptWorker = null;
  }
  if (transcriptQueue) {
    await transcriptQueue.close();
    transcriptQueue = null;
  }
  console.log('[TranscriptWorker] Stopped');
}

/**
 * Get transcript queue stats.
 */
export async function getTranscriptQueueStats() {
  const queue = getTranscriptQueue();
  if (!queue) return null;

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}
