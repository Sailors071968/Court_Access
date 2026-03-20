// ============================================================================
// Phase 2 — Doctrine Analysis Worker (ACU-Enforced)
// BullMQ worker that processes POST Learning Domain doctrine mapping jobs.
// Extends CourtAccessWorker for automatic ACU credit validation/deduction.
// Flow: pending → running → completed/failed
// ============================================================================

import type { Job } from 'bullmq';
import { CourtAccessWorker } from '../lib/baseWorker.js';
import { QUEUE_NAMES, type DoctrineAnalysisJobData } from '../lib/queues.js';
import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Doctrine Analysis Worker
// ---------------------------------------------------------------------------

class DoctrineAnalysisWorker extends CourtAccessWorker<DoctrineAnalysisJobData> {
  constructor() {
    super({
      queueName: QUEUE_NAMES.DOCTRINE_ANALYSIS,
      workerName: 'DoctrineAnalysisWorker',
      concurrency: 2,
      lockDuration: 60_000, // 1 minute for doctrine mapping
    });
  }

  protected async processJob(job: Job<DoctrineAnalysisJobData>, signal: AbortSignal): Promise<void> {
    const { tenantId, caseId, processingJobId } = job.data;

    // Mark ProcessingJob as active (direct ID lookup — safe across retries)
    if (processingJobId) {
      await prisma.processingJob.update({
        where: { id: processingJobId },
        data: { status: 'active', startedAt: new Date(), completedAt: null, failureCode: null, error: null },
      });
    }

    try {
      // Execute doctrine analysis pipeline
      console.log(`[DoctrineAnalysisWorker] Mapping contradictions to POST doctrine for case ${caseId}`);

      // Fetch timeline events flagged as conflicts for doctrine mapping
      const conflictEvents = await prisma.timelineEvent.findMany({
        where: { caseId, tenantId, conflictFlag: true },
        orderBy: { timestamp: 'asc' },
      });

      console.log(`[DoctrineAnalysisWorker] Found ${conflictEvents.length} conflict events for case ${caseId}`);

      // In production: maps contradictions to POST Learning Domain rules (LD-15 through LD-30).
      // Each contradiction is matched to specific training doctrine violations.
      // Actual AI pipeline integration in Phase 3.

      // Check abort signal before writing completion status
      if (signal.aborted) throw new Error('Job aborted by timeout');

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

      console.log(`[DoctrineAnalysisWorker] Doctrine analysis completed for case ${caseId}`);
    } catch (error) {
      // Mark ProcessingJob as failed
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
          console.error(`[DoctrineAnalysisWorker] Failed to update ProcessingJob status: ${dbMsg}`);
        }
      }
      throw error; // Rethrow to trigger BullMQ retry + ACU refund in base class
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const doctrineAnalysisWorker = new DoctrineAnalysisWorker();
