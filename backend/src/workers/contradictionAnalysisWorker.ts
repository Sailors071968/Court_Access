// ============================================================================
// Phase 2 — Contradiction Analysis Worker (ACU-Enforced)
// BullMQ worker that processes contradiction detection jobs.
// Extends CourtAccessWorker for automatic ACU credit validation/deduction.
// Flow: pending → running → completed/failed
// ============================================================================

import type { Job } from 'bullmq';
import { CourtAccessWorker } from '../lib/baseWorker.js';
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
      concurrency: 2,
      lockDuration: 180_000, // 3 minutes for contradiction analysis
    });
  }

  protected async processJob(job: Job<ContradictionAnalysisJobData>): Promise<void> {
    const { userId, tenantId, caseId } = job.data;

    // Mark ProcessingJob as active
    const processingJob = await prisma.processingJob.findFirst({
      where: {
        userId,
        caseId,
        pipeline: 'CONTRADICTION',
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (processingJob) {
      await prisma.processingJob.update({
        where: { id: processingJob.id },
        data: { status: 'active', startedAt: new Date() },
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

      // Mark ProcessingJob as completed
      if (processingJob) {
        await prisma.processingJob.update({
          where: { id: processingJob.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            acuCredits: job.data.acuCreditsRequired,
            result: {
              timelineEventsAnalyzed: timelineEvents.length,
              caseId,
              completedAt: new Date().toISOString(),
            },
          },
        });
      }

      console.log(`[ContradictionAnalysisWorker] Contradiction analysis completed for case ${caseId}`);
    } catch (error) {
      // Mark ProcessingJob as failed
      if (processingJob) {
        const message = error instanceof Error ? error.message : String(error);
        await prisma.processingJob.update({
          where: { id: processingJob.id },
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

export const contradictionAnalysisWorker = new ContradictionAnalysisWorker();
