// ============================================================================
// CourtAccess — BullMQ Worker Base Class
// All pipeline workers extend this class.
// Provides: Redis-backed job processing, ACU credit validation/deduction,
// graceful shutdown, structured logging, retry policy.
// ============================================================================

import { Worker, type Job, type ConnectionOptions } from 'bullmq';
import { redisConnection } from './redis.js';
import prisma from './prisma.js';
import type { BaseJobData } from './queues.js';

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
}

export abstract class CourtAccessWorker<TData extends BaseJobData = BaseJobData> {
  protected worker: Worker<TData> | null = null;
  protected readonly queueName: string;
  protected readonly workerName: string;
  protected readonly concurrency: number;
  protected readonly lockDuration: number;

  constructor(options: WorkerOptions) {
    this.queueName = options.queueName;
    this.workerName = options.workerName;
    this.concurrency = options.concurrency;
    this.lockDuration = options.lockDuration ?? 60_000;
  }

  // -----------------------------------------------------------------------
  // Abstract — subclasses implement the actual job logic
  // -----------------------------------------------------------------------

  /**
   * Process a single job. Subclasses implement this.
   * Throw an error to trigger retry; return normally to mark complete.
   */
  protected abstract processJob(job: Job<TData>): Promise<void>;

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
        await tx.aiCreditBalance.update({
          where: { userId },
          data: { creditsUsed: { decrement: acuCreditsRequired } },
        });
        // Delete the exact usage record created during reservation
        await tx.aiCreditUsage.delete({ where: { id: usageRecordId } });
      });
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
        console.log(`[${this.workerName}] Processing job ${job.id} (attempt ${job.attemptsMade + 1})`);

        // Step 1: Reserve ACU credits BEFORE processing (atomic).
        // Throws if insufficient — prevents job from running.
        // Returns the usage record ID for precise refund targeting.
        const usageRecordId = await this.reserveACU(job);

        try {
          // Step 2: Execute the actual job logic
          await this.processJob(job);

          const durationMs = Date.now() - startTime;
          console.log(`[${this.workerName}] Job ${job.id} completed in ${durationMs}ms`);
        } catch (error) {
          // processJob failed — refund the reserved credits (best-effort)
          if (usageRecordId) {
            await this.refundACU(job, usageRecordId);
          }
          const durationMs = Date.now() - startTime;
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[${this.workerName}] Job ${job.id} failed after ${durationMs}ms: ${message}`);
          throw error; // Rethrow to trigger BullMQ retry
        }
      },
      {
        connection: redisConnection as unknown as ConnectionOptions,
        concurrency: this.concurrency,
        lockDuration: this.lockDuration,
      },
    );

    this.worker.on('error', (err) => {
      console.error(`[${this.workerName}] Worker error:`, err.message);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[${this.workerName}] Job ${job?.id} permanently failed:`, err.message);
    });

    console.log(
      `[${this.workerName}] Started (queue: ${this.queueName}, concurrency: ${this.concurrency})`
    );
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
