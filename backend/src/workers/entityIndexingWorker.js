// ============================================
// Court Access — Entity Indexing Worker
// Phase 116: BullMQ worker for entity extraction + indexing
//
// Queue: entity-indexing
// Processes documents through the Document Intelligence Engine
// to extract and index entities (persons, dates, locations, etc.)
// ============================================

import { Worker, Queue } from 'bullmq';
import { getRedisConnection } from '../services/redisClient.js';
import { processDocument } from '../engines/documentIntelligenceEngine.js';
import { enrichTimelineFromDocument } from '../engines/timelineEnrichmentEngine.js';
import { captureException } from '../services/errorMonitoring.js';

const QUEUE_NAME = 'entity-indexing';
let entityQueue = null;
let entityWorker = null;

/**
 * Get or create the entity indexing queue.
 */
export function getEntityQueue() {
  if (entityQueue) return entityQueue;

  const connection = getRedisConnection();
  if (!connection) {
    console.warn('[EntityWorker] Redis not available — entity queue disabled');
    return null;
  }

  entityQueue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
      timeout: 120000, // 120 second timeout per job
    },
  });

  console.log('[EntityWorker] Entity indexing queue created');
  return entityQueue;
}

/**
 * Enqueue an entity extraction job.
 *
 * @param {object} params
 * @param {string} params.documentId - Document/evidence ID
 * @param {string} params.caseId - Case ID
 * @param {string} params.text - Full document text
 */
export async function enqueueEntityJob(params) {
  const queue = getEntityQueue();
  if (!queue) {
    console.warn('[EntityWorker] Cannot enqueue — queue not available');
    return null;
  }

  const job = await queue.add('extract-entities', {
    documentId: params.documentId,
    caseId: params.caseId,
    text: params.text,
    createdAt: new Date().toISOString(),
  });

  console.log(`[EntityWorker] Job enqueued: ${job.id} for document ${params.documentId}`);
  return job;
}

/**
 * Process an entity extraction job.
 */
async function processEntityJob(job) {
  const { documentId, caseId, text } = job.data;

  console.log(`[EntityWorker] Processing entities for document ${documentId}`);
  await job.updateProgress({ step: 'extracting', percent: 10 });

  // Step 1: Extract and store entities
  const entityResult = await processDocument(documentId, caseId, text);
  await job.updateProgress({ step: 'indexing', percent: 50 });

  // Step 2: Enrich timeline from document
  const timelineResult = await enrichTimelineFromDocument(caseId, documentId, text);
  await job.updateProgress({ step: 'complete', percent: 100 });

  console.log(`[EntityWorker] Complete: ${entityResult.totalEntities} entities, ${timelineResult.count} events`);

  return {
    documentId,
    caseId,
    entitiesExtracted: entityResult.totalEntities,
    entityBreakdown: entityResult.breakdown,
    timelineEvents: timelineResult.count,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Start the entity indexing worker.
 */
export function startEntityWorker() {
  const connection = getRedisConnection();
  if (!connection) {
    console.warn('[EntityWorker] Redis not available — worker not started');
    return null;
  }

  entityWorker = new Worker(QUEUE_NAME, processEntityJob, {
    connection,
    concurrency: 2,
    limiter: { max: 10, duration: 60000 },
  });

  entityWorker.on('completed', (job, result) => {
    console.log(`[EntityWorker] Job completed: ${job.id} — ${result.entitiesExtracted} entities`);
  });

  entityWorker.on('failed', (job, err) => {
    console.error(`[EntityWorker] Job failed: ${job?.id} — ${err.message}`);
    captureException(err, { context: 'entity-indexing-worker', jobId: job?.id });
  });

  entityWorker.on('error', (err) => {
    if (!err.message?.includes('ECONNREFUSED') && !err.message?.includes('Connection is closed')) {
      console.error(`[EntityWorker] Worker error: ${err.message}`);
    }
  });

  console.log('[EntityWorker] Entity indexing worker started (concurrency: 2)');
  return entityWorker;
}

/**
 * Stop the entity worker.
 */
export async function stopEntityWorker() {
  if (entityWorker) {
    await entityWorker.close();
    entityWorker = null;
  }
  if (entityQueue) {
    await entityQueue.close();
    entityQueue = null;
  }
  console.log('[EntityWorker] Stopped');
}
