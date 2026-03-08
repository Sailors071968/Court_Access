// ============================================
// Court Access — Ingestion Worker (BullMQ Consumer)
// Processes batch insertion jobs from the Redis queue.
// Each job inserts a chunk of documents into PostgreSQL.
// ============================================

import { Worker, type Job, type ConnectionOptions } from 'bullmq';
import type { BatchJobPayload, BatchResult } from './types.ts';
import { QUEUE_NAME } from './ingestionQueue.ts';
import type { BulkInserter } from './corpusLoader.ts';
import type { IngestionLogger } from './ingestionLogger.ts';
import type { IngestionStateRepository } from './ingestionStateRepository.ts';

// ---------------------------------------------------------------------------
// Worker Configuration
// ---------------------------------------------------------------------------

export interface WorkerConfig {
  concurrency: number;
  connection: ConnectionOptions;
  inserter: BulkInserter;
  logger: IngestionLogger;
  stateRepo: IngestionStateRepository;
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export class IngestionWorkerManager {
  private worker: Worker<BatchJobPayload, BatchResult> | null = null;
  private readonly config: WorkerConfig;

  constructor(config: WorkerConfig) {
    this.config = config;
  }

  /**
   * Start the worker to process batch insertion jobs.
   */
  start(): void {
    const { connection, concurrency, inserter, logger, stateRepo } = this.config;

    this.worker = new Worker<BatchJobPayload, BatchResult>(
      QUEUE_NAME,
      async (job: Job<BatchJobPayload>) => {
        return this.processJob(job, inserter, logger, stateRepo);
      },
      {
        connection,
        concurrency,
        limiter: {
          max: concurrency,
          duration: 1000,
        },
      },
    );

    this.worker.on('completed', (job: Job<BatchJobPayload>, result: BatchResult) => {
      logger.logProgress(
        job.data.corpusName,
        job.data.batchNumber,
        result.recordsInserted,
        null,
        result.durationMs,
        result.status,
      );
    });

    this.worker.on('failed', (job: Job<BatchJobPayload> | undefined, err: Error) => {
      if (job) {
        process.stderr.write(
          `[FAIL] ${job.data.corpusName} batch #${job.data.batchNumber}: ${err.message}\n`,
        );
      }
    });

    this.worker.on('error', (err: Error) => {
      process.stderr.write(`[ERROR] Ingestion worker error: ${err.message}\n`);
    });
  }

  /**
   * Process a single batch insertion job.
   */
  private async processJob(
    job: Job<BatchJobPayload>,
    inserter: BulkInserter,
    logger: IngestionLogger,
    stateRepo: IngestionStateRepository,
  ): Promise<BatchResult> {
    const { corpusName, batchNumber, documents, dryRun } = job.data;
    const startTime = Date.now();

    try {
      let recordsInserted = 0;

      if (dryRun) {
        // Dry run: validate but don't insert
        recordsInserted = documents.length;
      } else {
        recordsInserted = await inserter.insertBatch(documents);
      }

      const durationMs = Date.now() - startTime;
      const result: BatchResult = {
        batchNumber,
        recordsInserted,
        recordsSkipped: documents.length - recordsInserted,
        durationMs,
        status: 'success',
      };

      // Log the batch result
      await logger.logBatch(corpusName, result);

      // Checkpoint progress
      const fileName = documents[0]?.sourceFile ?? 'unknown';
      await stateRepo.checkpoint(
        corpusName,
        fileName,
        batchNumber * documents.length,
        batchNumber * documents.length,
      );

      await job.updateProgress(batchNumber);

      return result;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      const result: BatchResult = {
        batchNumber,
        recordsInserted: 0,
        recordsSkipped: 0,
        durationMs,
        status: 'failed',
        errorMessage,
      };

      await logger.logBatch(corpusName, result);

      throw err;
    }
  }

  /**
   * Gracefully stop the worker.
   */
  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  /**
   * Check if the worker is running.
   */
  isRunning(): boolean {
    return this.worker !== null;
  }
}
