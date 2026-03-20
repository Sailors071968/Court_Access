// ============================================================================
// CourtAccess — BullMQ Worker Base Class
// All pipeline workers extend this class.
// Provides: Redis-backed job processing, ACU credit validation/deduction,
// graceful shutdown, structured logging, retry policy.
// ============================================================================

import { Worker, UnrecoverableError, type Job, type ConnectionOptions } from 'bullmq';
import { redisConnection } from './redis.js';
import prisma from './prisma.js';
import type { BaseJobData } from './queues.js';
import { moveToDeadLetter, getMemorySnapshot } from '../workers/backpressureGuard.js';
import { metrics } from '../observability/metricsCollector.js';

// ---------------------------------------------------------------------------
// Custom error class for job timeouts — allows precise instanceof detection
// in the base worker catch block, avoiding TOCTOU races where signal.aborted
// could be true but the actual error was a transient DB/network failure.
// ---------------------------------------------------------------------------

export class JobTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JobTimeoutError';
  }
}

// ---------------------------------------------------------------------------
// Abstract Base Worker
// ---------------------------------------------------------------------------

export interface WorkerOptions {
  /** BullMQ queue name this worker processes */
  queueName: string;
  /** Human-readable worker name for logs */
  workerName: string;
  /** Maximum concurrent jobs */
  concurrency: number;
  /** Lock duration in ms (default: 60s) */
  lockDuration?: number;
  /** Maximum attempts before moving to DLQ (default: 3) */
  maxAttempts?: number;
  /** Stalled job check interval in ms (default: 30s) */
  stalledInterval?: number;
  /** Max stalled count before job is considered failed (default: 2) */
  maxStalledCount?: number;
  /** Job-level timeout in ms (default: 300000 = 5 min). 0 = no timeout. */
  jobTimeoutMs?: number;
}

export abstract class CourtAccessWorker<TData extends BaseJobData = BaseJobData> {
  protected worker: Worker<TData> | null = null;
  protected readonly queueName: string;
  protected readonly workerName: string;
  protected readonly concurrency: number;
  protected readonly lockDuration: number;
  protected readonly maxAttempts: number;
  protected readonly stalledInterval: number;
  protected readonly maxStalledCount: number;
  protected readonly jobTimeoutMs: number;
  private jobsProcessed = 0;
  private jobsFailed = 0;
  private jobsStalled = 0;
  private lastHealthLog = 0;

  constructor(options: WorkerOptions) {
    this.queueName = options.queueName;
    this.workerName = options.workerName;
    this.concurrency = options.concurrency;
    this.lockDuration = options.lockDuration ?? 60_000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.stalledInterval = options.stalledInterval ?? 30_000;
    this.maxStalledCount = options.maxStalledCount ?? 2;
    this.jobTimeoutMs = options.jobTimeoutMs ?? 300_000; // 5 min default
  }

  // -----------------------------------------------------------------------
  // Abstract — subclasses implement the actual job logic
  // -----------------------------------------------------------------------

  /**
   * Process a single job. Subclasses implement this.
   * Throw an error to trigger retry; return normally to mark complete.
   * @param job - The BullMQ job to process
   * @param signal - AbortSignal that fires when the job timeout expires.
   *   Workers performing long-running loops SHOULD check `signal.aborted`
   *   periodically and bail out early when true.
   */
  protected abstract processJob(job: Job<TData>, signal: AbortSignal): Promise<void>;

  // -----------------------------------------------------------------------
  // ACU Credit Enforcement (Task 3)
  // -----------------------------------------------------------------------

  /**
   * Reserve ACU credits BEFORE processing (atomic check-and-deduct).
   * Returns the usage record ID if credits were reserved, null if no reservation needed.
   * Throws if insufficient credits — prevents the job from running.
   */
  private async reserveACU(job: Job<TData>): Promise<string | null> {
    const { userId, acuCreditsRequired, caseId } = job.data;
    if (!acuCreditsRequired || acuCreditsRequired <= 0) {
      return null; // No credit reservation needed
    }

    // Atomic check-and-deduct to prevent overdraft from concurrent jobs.
    // Returns the created usage record ID for precise refund targeting.
    let usageRecordId: string | null = null;
    await prisma.$transaction(async (tx) => {
      const balance = await tx.aiCreditBalance.findUnique({ where: { userId } });
      if (!balance) {
        throw new Error(`[ACU] No credit balance found for user ${userId}. Job ${job.id} rejected.`);
      }
      const available = (balance.monthlyCredits + balance.purchasedCredits) - balance.creditsUsed;
      if (available < acuCreditsRequired) {
        throw new Error(
          `[ACU] Insufficient credits for user ${userId}. ` +
          `Required: ${acuCreditsRequired}, Available: ${available}. Job ${job.id} rejected.`
        );
      }
      await tx.aiCreditBalance.update({
        where: { userId },
        data: { creditsUsed: { increment: acuCreditsRequired } },
      });
      const usage = await tx.aiCreditUsage.create({
        data: {
          userId,
          caseId: caseId ?? null,
          analysisType: this.workerName,
          creditsUsed: acuCreditsRequired,
        },
      });
      usageRecordId = usage.id;
    }, { isolationLevel: 'Serializable' });

    console.log(
      `[${this.workerName}] Reserved ${acuCreditsRequired} ACU credits from user ${userId} for job ${job.id}`
    );
    return usageRecordId;
  }

  /**
   * Refund previously reserved ACU credits when processJob fails.
   * Uses the exact usage record ID from reserveACU for precise deletion.
   * Best-effort — logs error if refund fails but does not rethrow.
   */
  private async refundACU(job: Job<TData>, usageRecordId: string): Promise<void> {
    const { userId, acuCreditsRequired } = job.data;
    if (!acuCreditsRequired || acuCreditsRequired <= 0) {
      return;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Read current balance first to prevent creditsUsed going negative.
        // If resetMonthlyCredits ran between reserveACU and this refund,
        // creditsUsed was already reset to 0 — blind decrement would go negative
        // and inflate available credits (granting free credits).
        const balance = await tx.aiCreditBalance.findUnique({ where: { userId } });
        const safeDecrement = balance
          ? Math.min(acuCreditsRequired, balance.creditsUsed)
          : 0;
        if (safeDecrement > 0) {
          await tx.aiCreditBalance.update({
            where: { userId },
            data: { creditsUsed: { decrement: safeDecrement } },
          });
        }
        // Delete the exact usage record created during reservation
        await tx.aiCreditUsage.delete({ where: { id: usageRecordId } });
      }, { isolationLevel: 'Serializable' });
      console.log(
        `[${this.workerName}] Refunded ${acuCreditsRequired} ACU credits to user ${userId} for failed job ${job.id}`
      );
    } catch (refundError) {
      const msg = refundError instanceof Error ? refundError.message : String(refundError);
      console.error(
        `[${this.workerName}] ACU credit refund failed for job ${job.id}: ${msg}. ` +
        `Manual intervention required: refund ${acuCreditsRequired} credits to user ${userId}.`
      );
    }
  }

  // -----------------------------------------------------------------------
  // ProcessingJob Status Management
  // -----------------------------------------------------------------------

  /**
   * Mark the corresponding ProcessingJob as failed with a specific failure code.
   * Uses processingJobId from job data for direct lookup (no ambiguous findFirst).
   * Used when ACU credits are exhausted or other non-retryable failures occur.
   */
  private async markJobFailed(job: Job<TData>, failureCode: string, errorMessage: string): Promise<void> {
    const { processingJobId } = job.data;
    if (!processingJobId) {
      console.warn(`[${this.workerName}] No processingJobId in job ${job.id} — cannot mark failed`);
      return;
    }
    try {
      await prisma.processingJob.update({
        where: { id: processingJobId },
        data: {
          status: 'failed',
          failureCode,
          error: errorMessage,
          completedAt: new Date(),
        },
      });
      console.log(
        `[${this.workerName}] ProcessingJob ${processingJobId} marked failed: ${failureCode}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${this.workerName}] Failed to mark ProcessingJob as failed: ${msg}`);
    }
  }

  // -----------------------------------------------------------------------
  // BullMQ Worker Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Start the BullMQ worker. Call this once during application startup.
   */
  start(): void {
    if (this.worker) {
      console.warn(`[${this.workerName}] Worker already started.`);
      return;
    }

    this.worker = new Worker<TData>(
      this.queueName,
      async (job: Job<TData>) => {
        const startTime = Date.now();
        console.log(`[${this.workerName}] Processing job ${job.id} (attempt ${job.attemptsMade + 1}/${this.maxAttempts})`);

        // Step 1: Reserve ACU credits BEFORE processing (atomic).
        // Throws if insufficient — prevents job from running.
        // Returns the usage record ID for precise refund targeting.
        let usageRecordId: string | null = null;
        try {
          usageRecordId = await this.reserveACU(job);
        } catch (acuError) {
          // ACU reservation failed — mark ProcessingJob as failed with ACU_EXHAUSTED
          const message = acuError instanceof Error ? acuError.message : String(acuError);
          const isInsufficientCredits = message.includes('[ACU] Insufficient credits') || message.includes('[ACU] No credit balance');
          if (isInsufficientCredits) {
            await this.markJobFailed(job, 'ACU_EXHAUSTED', message);
            console.error(`[${this.workerName}] Job ${job.id} rejected: ACU credits exhausted`);
            // Do NOT rethrow — job should not retry when credits are exhausted
            return;
          }
          throw acuError; // Rethrow non-ACU errors for retry
        }

        // Step 2: Execute the actual job logic (with AbortController timeout guard)
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;

        if (this.jobTimeoutMs > 0) {
          timer = setTimeout(() => controller.abort(), this.jobTimeoutMs);
        }

        try {
          await this.processJob(job, controller.signal);

          this.jobsProcessed++;
          const durationMs = Date.now() - startTime;
          console.log(`[${this.workerName}] Job ${job.id} completed in ${durationMs}ms`);
          metrics.observeHistogram('courtaccess_worker_job_duration_ms', durationMs, { worker: this.workerName });
          this.logHealthIfDue();
        } catch (error) {
          // Check if this is a timeout abort (use instanceof, not signal.aborted,
          // to avoid misclassifying concurrent transient errors as timeouts)
          if (error instanceof JobTimeoutError) {
            const durationMs = Date.now() - startTime;
            console.error(
              `[${this.workerName}] Job ${job.id} TIMED OUT after ${durationMs}ms (limit: ${this.jobTimeoutMs}ms) — no retry`
            );
            metrics.incrementCounter('courtaccess_worker_timeouts_total', { worker: this.workerName });

            // Mark ProcessingJob as failed with TIMEOUT code
            await this.markJobFailed(job, 'JOB_TIMEOUT', `Job timed out after ${this.jobTimeoutMs}ms`);

            // Refund ACU credits since work did not complete
            if (usageRecordId) {
              await this.refundACU(job, usageRecordId);
            }

            // UnrecoverableError prevents BullMQ retries — timeout is deterministic,
            // retrying the same job will hit the same timeout.
            throw new UnrecoverableError(
              `[Timeout] Job ${job.id} exceeded ${this.jobTimeoutMs}ms limit — no retry`
            );
          }

          // Non-timeout failure — refund credits and allow BullMQ retry
          if (usageRecordId) {
            await this.refundACU(job, usageRecordId);
          }
          const durationMs = Date.now() - startTime;
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[${this.workerName}] Job ${job.id} failed after ${durationMs}ms: ${message}`);
          throw error; // Rethrow to trigger BullMQ retry
        } finally {
          if (timer) clearTimeout(timer);
        }
      },
      {
        connection: redisConnection as unknown as ConnectionOptions,
        concurrency: this.concurrency,
        lockDuration: this.lockDuration,
        stalledInterval: this.stalledInterval,
        maxStalledCount: this.maxStalledCount,
      },
    );

    this.worker.on('error', (err) => {
      console.error(`[${this.workerName}] Worker error:`, err.message);
    });

    this.worker.on('failed', async (job, err) => {
      if (job) {
        this.jobsFailed++;
        // Move to DLQ if retries exhausted OR permanently failed (UnrecoverableError).
        // UnrecoverableError (e.g. from JOB_TIMEOUT) sets attemptsMade=1 but skips retries,
        // so the attemptsMade >= maxAttempts check alone would miss these jobs.
        const isPermanentlyFailed = err.name === 'UnrecoverableError' || job.attemptsMade >= this.maxAttempts;
        if (isPermanentlyFailed) {
          console.error(
            `[${this.workerName}] Job ${job.id} permanently failed after ${job.attemptsMade} attempts: ${err.message}`,
          );
          await moveToDeadLetter(
            this.queueName,
            job.id ?? 'unknown',
            job.data as unknown as Record<string, unknown>,
            err.message,
            job.attemptsMade,
          );
        } else {
          console.warn(
            `[${this.workerName}] Job ${job.id} failed (attempt ${job.attemptsMade}/${this.maxAttempts}): ${err.message}`,
          );
        }
      }
    });

    // Stalled job detection — track rate for alerting
    this.worker.on('stalled', (jobId: string) => {
      this.jobsStalled++;
      metrics.incrementCounter('courtaccess_worker_stalled_total', { worker: this.workerName });
      console.warn(`[${this.workerName}] Job ${jobId} stalled — BullMQ will retry or fail it (total stalls: ${this.jobsStalled})`);

      // Alert if stall rate exceeds 5% of processed jobs
      const totalProcessed = this.jobsProcessed + this.jobsFailed;
      if (totalProcessed > 20 && this.jobsStalled / totalProcessed > 0.05) {
        console.error(
          `[${this.workerName}] STALL RATE ALERT: ${this.jobsStalled}/${totalProcessed} jobs stalled (>5%)`
        );
      }
    });

    console.log(
      `[${this.workerName}] Started (queue: ${this.queueName}, concurrency: ${this.concurrency}, stalledInterval: ${this.stalledInterval}ms)`,
    );
  }

  // -----------------------------------------------------------------------
  // Health Reporting
  // -----------------------------------------------------------------------

  /** Log periodic health status (called internally, no-op if called too frequently) */
  protected logHealthIfDue(): void {
    const now = Date.now();
    if (now - this.lastHealthLog < 60_000) return; // max once per minute
    this.lastHealthLog = now;

    const mem = getMemorySnapshot();
    console.log(
      `[${this.workerName}] Health: processed=${this.jobsProcessed} failed=${this.jobsFailed} ` +
      `heap=${mem.heapUsedMB}MB/${mem.heapTotalMB}MB rss=${mem.rssMB}MB`,
    );
  }

  /** Get worker statistics */
  getStats(): { processed: number; failed: number; stalled: number; running: boolean } {
    return {
      processed: this.jobsProcessed,
      failed: this.jobsFailed,
      stalled: this.jobsStalled,
      running: this.isRunning(),
    };
  }

  /**
   * Gracefully shut down the worker.
   * Waits for active jobs to complete before closing.
   */
  async stop(): Promise<void> {
    if (!this.worker) return;
    console.log(`[${this.workerName}] Shutting down...`);
    await this.worker.close();
    this.worker = null;
    console.log(`[${this.workerName}] Stopped.`);
  }

  /** Check if the worker is running */
  isRunning(): boolean {
    return this.worker !== null && !this.worker.closing;
  }
}
