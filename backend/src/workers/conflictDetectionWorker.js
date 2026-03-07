// ============================================
// Court Access — Conflict Detection Worker
// Phase 116: BullMQ worker for cross-document conflict detection
//
// Queue: conflict-detection
// Runs the Conflict Detection Engine against all evidence in a case
// to identify contradictions, timeline mismatches, and entity discrepancies.
// ============================================

import { Worker, Queue } from 'bullmq';
import { getRedisConnection } from '../services/redisClient.js';
import { detectConflicts } from '../engines/conflictDetectionEngine.js';
import { captureException } from '../services/errorMonitoring.js';

const QUEUE_NAME = 'conflict-detection';
let conflictQueue = null;
let conflictWorker = null;

/**
 * Get or create the conflict detection queue.
 */
export function getConflictQueue() {
  if (conflictQueue) return conflictQueue;

  const connection = getRedisConnection();
  if (!connection) {
    console.warn('[ConflictWorker] Redis not available — conflict queue disabled');
    return null;
  }

  conflictQueue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 100 },
      timeout: 120000, // 120 second timeout
    },
  });

  console.log('[ConflictWorker] Conflict detection queue created');
  return conflictQueue;
}

/**
 * Enqueue a conflict detection job for a case.
 *
 * @param {string} caseId - Case to analyze
 */
export async function enqueueConflictJob(caseId) {
  const queue = getConflictQueue();
  if (!queue) {
    console.warn('[ConflictWorker] Cannot enqueue — queue not available');
    return null;
  }

  const job = await queue.add('detect-conflicts', {
    caseId,
    createdAt: new Date().toISOString(),
  });

  console.log(`[ConflictWorker] Job enqueued: ${job.id} for case ${caseId}`);
  return job;
}

/**
 * Process a conflict detection job.
 */
async function processConflictJob(job) {
  const { caseId } = job.data;

  console.log(`[ConflictWorker] Detecting conflicts for case ${caseId}`);
  await job.updateProgress({ step: 'detecting', percent: 10 });

  const result = await detectConflicts(caseId);

  await job.updateProgress({ step: 'complete', percent: 100 });

  console.log(`[ConflictWorker] Complete: ${result.conflicts.length} conflicts found`);

  return {
    caseId,
    conflictsFound: result.conflicts.length,
    summary: result.summary,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Start the conflict detection worker.
 */
export function startConflictWorker() {
  const connection = getRedisConnection();
  if (!connection) {
    console.warn('[ConflictWorker] Redis not available — worker not started');
    return null;
  }

  conflictWorker = new Worker(QUEUE_NAME, processConflictJob, {
    connection,
    concurrency: 1,
    limiter: { max: 3, duration: 60000 },
  });

  conflictWorker.on('completed', (job, result) => {
    console.log(`[ConflictWorker] Job completed: ${job.id} — ${result.conflictsFound} conflicts`);
  });

  conflictWorker.on('failed', (job, err) => {
    console.error(`[ConflictWorker] Job failed: ${job?.id} — ${err.message}`);
    captureException(err, { context: 'conflict-detection-worker', jobId: job?.id });
  });

  conflictWorker.on('error', (err) => {
    if (!err.message?.includes('ECONNREFUSED') && !err.message?.includes('Connection is closed')) {
      console.error(`[ConflictWorker] Worker error: ${err.message}`);
    }
  });

  console.log('[ConflictWorker] Conflict detection worker started (concurrency: 1)');
  return conflictWorker;
}

/**
 * Stop the conflict worker.
 */
export async function stopConflictWorker() {
  if (conflictWorker) {
    await conflictWorker.close();
    conflictWorker = null;
  }
  if (conflictQueue) {
    await conflictQueue.close();
    conflictQueue = null;
  }
  console.log('[ConflictWorker] Stopped');
}
