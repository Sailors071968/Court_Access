// ============================================================================
// Phase 3 — Timeline Processing Worker (ACU-Enforced)
// BullMQ worker that runs the full timeline reconstruction pipeline:
//   Event extraction → Officer timeline → Unified merge → Conflict detection
// Extends CourtAccessWorker for automatic ACU credit validation/deduction.
// Flow: pending → active → completed/failed
// ============================================================================

import type { Job } from 'bullmq';
import { CourtAccessWorker, JobTimeoutError, resolveConcurrency } from '../lib/baseWorker.js';
import { QUEUE_NAMES, type TimelineBuildJobData } from '../lib/queues.js';
import prisma from '../lib/prisma.js';
import { reconstructTimeline } from '../timeline/timelineReconstructionService.js';

// ---------------------------------------------------------------------------
// Timeline Processing Worker
// ---------------------------------------------------------------------------

class TimelineProcessingWorker extends CourtAccessWorker<TimelineBuildJobData> {
  constructor() {
    super({
      queueName: QUEUE_NAMES.TIMELINE_BUILD,
      workerName: 'TimelineProcessingWorker',
      concurrency: resolveConcurrency(QUEUE_NAMES.TIMELINE_BUILD, 2),
      lockDuration: 120_000, // 2 minutes for timeline builds
    });
  }

  protected async processJob(job: Job<TimelineBuildJobData>, signal: AbortSignal): Promise<void> {
    const { tenantId, caseId, processingJobId } = job.data;

    // Mark ProcessingJob as active (direct ID lookup — safe across retries)
    if (processingJobId) {
      await prisma.processingJob.update({
        where: { id: processingJobId },
        data: { status: 'active', startedAt: new Date(), completedAt: null, failureCode: null, error: null },
      });
    }

    try {
      console.log(`[TimelineProcessingWorker] Building timeline for case ${caseId}`);

      // Execute the full timeline reconstruction pipeline:
      //   1. Fetch evidence for the case
      //   2. Extract structured events from evidence
      //   3. Build officer action timeline
      //   4. Merge into unified timeline (clock drift correction)
      //   5. Detect timeline conflicts
      //   6. Persist TimelineEvent records to PostgreSQL
      const result = await reconstructTimeline(caseId, tenantId);

      console.log(
        `[TimelineProcessingWorker] Timeline reconstruction completed for case ${caseId}: ` +
        `${result.evidenceProcessed} evidence, ${result.eventsExtracted} events extracted, ` +
        `${result.timelineEventsCreated} timeline events, ${result.conflictsDetected} conflicts`
      );

      if (result.warnings.length > 0) {
        console.warn(`[TimelineProcessingWorker] Warnings for case ${caseId}:`, result.warnings);
      }

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

      console.log(`[TimelineProcessingWorker] Timeline build completed for case ${caseId}`);
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
          console.error(`[TimelineProcessingWorker] Failed to update ProcessingJob status: ${dbMsg}`);
        }
      }
      throw error; // Rethrow to trigger BullMQ retry + ACU refund in base class
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const timelineProcessingWorker = new TimelineProcessingWorker();
