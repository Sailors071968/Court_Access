// ============================================================================
// Phase 2 — Timeline Processing Worker (ACU-Enforced)
// BullMQ worker that processes timeline reconstruction jobs.
// Extends CourtAccessWorker for automatic ACU credit validation/deduction.
// Flow: pending → running → completed/failed
// ============================================================================

import type { Job } from 'bullmq';
import { CourtAccessWorker } from '../lib/baseWorker.js';
import { QUEUE_NAMES, type TimelineBuildJobData } from '../lib/queues.js';
import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Timeline Processing Worker
// ---------------------------------------------------------------------------

class TimelineProcessingWorker extends CourtAccessWorker<TimelineBuildJobData> {
  constructor() {
    super({
      queueName: QUEUE_NAMES.TIMELINE_BUILD,
      workerName: 'TimelineProcessingWorker',
      concurrency: 2,
      lockDuration: 120_000, // 2 minutes for timeline builds
    });
  }

  protected async processJob(job: Job<TimelineBuildJobData>): Promise<void> {
    const { tenantId, caseId, processingJobId } = job.data;

    // Mark ProcessingJob as active (direct ID lookup — safe across retries)
    if (processingJobId) {
      await prisma.processingJob.update({
        where: { id: processingJobId },
        data: { status: 'active', startedAt: new Date(), completedAt: null, failureCode: null, error: null },
      });
    }

    try {
      // Execute timeline reconstruction pipeline
      console.log(`[TimelineProcessingWorker] Building timeline for case ${caseId}`);

      // Fetch evidence for timeline extraction
      const evidence = await prisma.evidence.findMany({
        where: { caseId, tenantId },
        select: { evidenceId: true, evidenceType: true, fileName: true },
      });

      console.log(`[TimelineProcessingWorker] Found ${evidence.length} evidence items for case ${caseId}`);

      // In production: calls eventExtractionService, officerActionTimelineService,
      // clock drift correction, and timeline merge pipeline.
      // For now, log processing intent — actual AI pipeline integration in Phase 3.

      // Mark ProcessingJob as completed
      if (processingJobId) {
        await prisma.processingJob.update({
          where: { id: processingJobId },
          data: {
            status: 'completed',
            completedAt: new Date(),
            acuCredits: job.data.acuCreditsRequired,
            failureCode: null,
            error: null,
            result: {
              evidenceProcessed: evidence.length,
              caseId,
              completedAt: new Date().toISOString(),
            },
          },
        });
      }

      console.log(`[TimelineProcessingWorker] Timeline build completed for case ${caseId}`);
    } catch (error) {
      // Mark ProcessingJob as failed
      if (processingJobId) {
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
      }
      throw error; // Rethrow to trigger BullMQ retry + ACU refund in base class
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const timelineProcessingWorker = new TimelineProcessingWorker();
