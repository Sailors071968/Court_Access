// ============================================
// Court Access — Queue Monitoring Dashboard
// Phase 119: Production Hardening
//
// BullMQ queue monitoring using Bull Board.
// Monitors queues:
// - document-processing
// - entity-indexing
// - timeline-generation
// - conflict-detection
// - graph-builder
// ============================================

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { getRedisConnection, isRedisAvailable } from './redisClient.js';

// ---------------------------------------------------------------------------
// Queue Definitions
// ---------------------------------------------------------------------------

const QUEUE_NAMES = [
  'document-processing',
  'entity-indexing',
  'timeline-generation',
  'conflict-detection',
  'graph-builder',
];

let queues = [];
let serverAdapter = null;
let boardInitialized = false;

// ---------------------------------------------------------------------------
// Initialize Bull Board
// ---------------------------------------------------------------------------

/**
 * Initialize Bull Board monitoring dashboard.
 * Returns an Express adapter to mount at /admin/queues.
 *
 * @returns {ExpressAdapter|null}
 */
export function initQueueMonitor() {
  if (boardInitialized) return serverAdapter;

  if (!isRedisAvailable()) {
    console.log('[QueueMonitor] Redis not available — queue monitoring disabled');
    return null;
  }

  try {
    const connection = getRedisConnection();
    if (!connection) return null;

    // Create queue instances for monitoring (read-only)
    queues = QUEUE_NAMES.map(name => new Queue(name, {
      connection: {
        host: connection.options?.host || 'localhost',
        port: connection.options?.port || 6379,
      },
    }));

    // Create Bull Board adapter
    serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: queues.map(q => new BullMQAdapter(q)),
      serverAdapter,
    });

    boardInitialized = true;
    console.log(`[QueueMonitor] Bull Board initialized for ${QUEUE_NAMES.length} queues`);

    return serverAdapter;
  } catch (err) {
    console.error('[QueueMonitor] Failed to initialize:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Queue Statistics
// ---------------------------------------------------------------------------

/**
 * Get statistics for all monitored queues.
 *
 * @returns {Promise<Array<{ name: string, waiting: number, active: number, completed: number, failed: number, delayed: number }>>}
 */
export async function getQueueStatistics() {
  const stats = [];

  for (const queue of queues) {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      stats.push({
        name: queue.name,
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      });
    } catch (err) {
      stats.push({
        name: queue.name,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0,
        error: err.message,
      });
    }
  }

  return stats;
}

/**
 * Get failed jobs for a specific queue.
 *
 * @param {string} queueName
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function getFailedJobs(queueName, limit = 20) {
  const queue = queues.find(q => q.name === queueName);
  if (!queue) return [];

  try {
    const failed = await queue.getFailed(0, limit - 1);
    return failed.map(job => ({
      id: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn,
    }));
  } catch {
    return [];
  }
}

/**
 * Retry all failed jobs in a queue.
 *
 * @param {string} queueName
 * @returns {Promise<number>} Number of jobs retried
 */
export async function retryFailedJobs(queueName) {
  const queue = queues.find(q => q.name === queueName);
  if (!queue) return 0;

  try {
    const failed = await queue.getFailed();
    for (const job of failed) {
      await job.retry();
    }
    return failed.length;
  } catch {
    return 0;
  }
}

/**
 * Clean up old completed/failed jobs.
 *
 * @param {number} olderThanMs - Remove jobs older than this (default: 7 days)
 */
export async function cleanOldJobs(olderThanMs = 7 * 24 * 60 * 60 * 1000) {
  for (const queue of queues) {
    try {
      await queue.clean(olderThanMs, 1000, 'completed');
      await queue.clean(olderThanMs, 1000, 'failed');
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Shutdown all queue connections.
 */
export async function shutdownQueueMonitor() {
  for (const queue of queues) {
    try {
      await queue.close();
    } catch {
      // Ignore close errors
    }
  }
  queues = [];
  boardInitialized = false;
}
