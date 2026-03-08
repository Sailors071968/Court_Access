// ============================================
// Court Access — Ingestion Queue (BullMQ Producer)
// Pushes batch insertion jobs onto a Redis-backed BullMQ queue.
// Each chunk becomes a queue job processed by ingestionWorker.
// ============================================

import { Queue, type JobsOptions, type ConnectionOptions } from 'bullmq';
import type { BatchJobPayload } from './types.ts';

// ---------------------------------------------------------------------------
// Queue Configuration
// ---------------------------------------------------------------------------

const QUEUE_NAME = 'corpus-ingestion';

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: {
    age: 86400, // 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 604800, // 7 days
  },
};

// ---------------------------------------------------------------------------
// Queue Producer
// ---------------------------------------------------------------------------

export class IngestionQueueProducer {
  private readonly queue: Queue<BatchJobPayload>;

  constructor(connection: ConnectionOptions) {
    this.queue = new Queue<BatchJobPayload>(QUEUE_NAME, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }

  /**
   * Add a batch insertion job to the queue.
   * Job name includes corpus name and batch number for easy identification.
   */
  async addBatchJob(payload: BatchJobPayload): Promise<string> {
    const jobName = `${payload.corpusName}:batch-${payload.batchNumber}`;
    const job = await this.queue.add(jobName, payload, {
      priority: 1,
    });
    return job.id ?? jobName;
  }

  /**
   * Add multiple batch jobs at once (for pre-queuing).
   */
  async addBatchJobs(payloads: BatchJobPayload[]): Promise<string[]> {
    const ids: string[] = [];
    for (const payload of payloads) {
      const id = await this.addBatchJob(payload);
      ids.push(id);
    }
    return ids;
  }

  /**
   * Get queue status metrics.
   */
  async getStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Drain the queue (remove all waiting jobs).
   */
  async drain(): Promise<void> {
    await this.queue.drain();
  }

  /**
   * Close the queue connection.
   */
  async close(): Promise<void> {
    await this.queue.close();
  }
}

export { QUEUE_NAME };
