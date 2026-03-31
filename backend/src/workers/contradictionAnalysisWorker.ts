// ============================================================================
// Phase 2 — Contradiction Analysis Worker (ACU-Enforced)
// BullMQ worker that processes contradiction detection jobs.
// Extends CourtAccessWorker for automatic ACU credit validation/deduction.
// Flow: pending → running → completed/failed
// ============================================================================

import type { Job } from 'bullmq';
import { CourtAccessWorker, JobTimeoutError, resolveConcurrency } from '../lib/baseWorker.js';
import { QUEUE_NAMES, type ContradictionAnalysisJobData } from '../lib/queues.js';
import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Contradiction Analysis Worker
// ---------------------------------------------------------------------------

class ContradictionAnalysisWorker extends CourtAccessWorker<ContradictionAnalysisJobData> {
  constructor() {
    super({
      queueName: QUEUE_NAMES.CONTRADICTION_ANALYSIS,
      workerName: 'ContradictionAnalysisWorker',
      concurrency: resolveConcurrency(QUEUE_NAMES.CONTRADICTION_ANALYSIS, 2),
      lockDuration: 180_000, // 3 minutes for contradiction analysis
    });
  }

  protected async processJob(job: Job<ContradictionAnalysisJobData>, signal: AbortSignal): Promise<void> {
    const { tenantId, caseId, processingJobId } = job.data;

    // Mark ProcessingJob as active (direct ID lookup — safe across retries)
    if (processingJobId) {
      await prisma.processingJob.update({
        where: { id: processingJobId },
        data: { status: 'active', startedAt: new Date(), completedAt: null, failureCode: null, error: null },
      });
    }

    try {
      // Execute contradiction detection pipeline
      console.log(`[ContradictionAnalysisWorker] Analyzing contradictions for case ${caseId}`);

      // Fetch timeline events for contradiction detection
      const timelineEvents = await prisma.timelineEvent.findMany({
        where: { caseId, tenantId },
        orderBy: { timestamp: 'asc' },
      });

      console.log(`[ContradictionAnalysisWorker] Found ${timelineEvents.length} timeline events for case ${caseId}`);

      // In production: runs 4-stage CDE pipeline:
      // 1. Event extraction from evidence
      // 2. Timeline alignment with clock drift correction
      // 3. 7-rule contradiction detection
      // 4. Doctrine mapping (POST Learning Domains)
      // Actual AI pipeline integration in Phase 3.

      // Check abort signal before writing completion status
      if (signal.aborted) throw new JobTimeoutError('Job aborted by timeout');

      // Mark ProcessingJob as completed (idempotent — only if still 'active')
      if (processingJobId) {
        await prisma.processingJob.updateMany({
          where: { id: processingJobId, status: 'active' },
          data: {
            status: 'completed',
            completedAt: new Date(),
            acuCredits: job.data.acuCreditsRequired,
            failureCode: null,
            error: null,
          },
        });
      }

      console.log(`[ContradictionAnalysisWorker] Contradiction analysis completed for case ${caseId}`);
    } catch (error) {
      // Skip DB write for timeout — base worker handles JOB_TIMEOUT status
      if (error instanceof JobTimeoutError) throw error;

      // Mark ProcessingJob as failed (non-timeout errors only)
      if (processingJobId) {
        try {
          const message = error instanceof Error ? error.message : String(error);
          await prisma.processingJob.update({
            where: { id: processingJobId },
            data: {
              status: 'failed',
              completedAt: new Date(),
              failureCode: 'PROCESSING_ERROR',
              error: message,
            },
          });
        } catch (dbError) {
          const dbMsg = dbError instanceof Error ? dbError.message : String(dbError);
          console.error(`[ContradictionAnalysisWorker] Failed to update ProcessingJob status: ${dbMsg}`);
        }
      }
      throw error; // Rethrow to trigger BullMQ retry + ACU refund in base class
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const contradictionAnalysisWorker = new ContradictionAnalysisWorker();
