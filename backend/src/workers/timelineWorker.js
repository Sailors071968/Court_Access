// ============================================
// Court Access — Timeline Generation Worker
// Phase 115: BullMQ worker for async timeline generation
//
// Queue: timeline-generation
// Generates chronological case timelines from evidence + transcripts.
// ============================================

import { Worker, Queue } from 'bullmq';
import { getRedisConnection } from '../services/redisClient.js';
import { generateTimeline } from '../services/timelineEngine.js';
import { captureException } from '../services/errorMonitoring.js';

const QUEUE_NAME = 'timeline-generation';
let timelineQueue = null;
let timelineWorker = null;

/**
 * Get or create the timeline generation queue.
 */
export function getTimelineQueue() {
  if (timelineQueue) return timelineQueue;

  const connection = getRedisConnection();
  if (!connection) {
    console.warn('[TimelineWorker] Redis not available — timeline queue disabled');
    return null;
  }

  timelineQueue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 100 },
    },
  });

  console.log('[TimelineWorker] Timeline generation queue created');
  return timelineQueue;
}

/**
 * Enqueue a timeline generation job.
 *
 * @param {string} caseId - The case to generate a timeline for
 */
export async function enqueueTimelineJob(caseId) {
  const queue = getTimelineQueue();
  if (!queue) {
    console.warn('[TimelineWorker] Cannot enqueue — queue not available');
    return null;
  }

  const job = await queue.add('generate-timeline', {
    caseId,
    createdAt: new Date().toISOString(),
  });

  console.log(`[TimelineWorker] Job enqueued: ${job.id} for case ${caseId}`);
  return job;
}

/**
 * Process a timeline generation job.
 */
async function processTimelineJob(job) {
  const { caseId } = job.data;

  console.log(`[TimelineWorker] Generating timeline for case ${caseId}`);
  await job.updateProgress({ step: 'generating', percent: 10 });

  const result = await generateTimeline(caseId);

  await job.updateProgress({ step: 'complete', percent: 100 });

  console.log(`[TimelineWorker] Timeline generated: ${result.timeline.length} events, ${result.conflicts.length} conflicts`);

  return {
    caseId,
    eventCount: result.timeline.length,
    conflictCount: result.conflicts.length,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Start the timeline generation worker.
 */
export function startTimelineWorker() {
  const connection = getRedisConnection();
  if (!connection) {
    console.warn('[TimelineWorker] Redis not available — worker not started');
    return null;
  }

  timelineWorker = new Worker(QUEUE_NAME, processTimelineJob, {
    connection,
    concurrency: 1,
    limiter: { max: 3, duration: 60000 },
  });

  timelineWorker.on('completed', (job, result) => {
    console.log(`[TimelineWorker] Job completed: ${job.id} — ${result.eventCount} events`);
  });

  timelineWorker.on('failed', (job, err) => {
    console.error(`[TimelineWorker] Job failed: ${job?.id} — ${err.message}`);
    captureException(err, { context: 'timeline-worker', jobId: job?.id });
  });

  timelineWorker.on('error', (err) => {
    if (!err.message?.includes('ECONNREFUSED') && !err.message?.includes('Connection is closed')) {
      console.error(`[TimelineWorker] Worker error: ${err.message}`);
    }
  });

  console.log('[TimelineWorker] Timeline generation worker started (concurrency: 1)');
  return timelineWorker;
}

/**
 * Stop the timeline worker.
 */
export async function stopTimelineWorker() {
  if (timelineWorker) {
    await timelineWorker.close();
    timelineWorker = null;
  }
  if (timelineQueue) {
    await timelineQueue.close();
    timelineQueue = null;
  }
  console.log('[TimelineWorker] Stopped');
}
