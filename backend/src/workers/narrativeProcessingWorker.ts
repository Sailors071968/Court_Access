// ============================================================================
// Phase 4 — Narrative Processing Worker (ACU-Enforced)
// BullMQ worker that processes narrative deconstruction jobs.
// Extends CourtAccessWorker for automatic ACU credit validation/deduction.
// Flow: pending → running → completed/failed
//
// Replaces Phase 2 stub with real 4-stage pipeline:
//   1. Claim extraction (R2 → text → atomic claims)
//   2. Claim normalization (structured ontology events)
//   3. Evidence validation (cross-reference claims vs evidence)
//   4. Impeachment detection (contradicted claims → candidates)
// ============================================================================

import type { Job } from 'bullmq';
import { CourtAccessWorker, JobTimeoutError } from '../lib/baseWorker.js';
import { QUEUE_NAMES, type NarrativeProcessingJobData } from '../lib/queues.js';
import prisma from '../lib/prisma.js';
import { deconstructNarrative } from '../narrative/narrativeReconstructionService.js';

// ---------------------------------------------------------------------------
// Narrative Processing Worker
// ---------------------------------------------------------------------------

class NarrativeProcessingWorker extends CourtAccessWorker<NarrativeProcessingJobData> {
  constructor() {
    super({
      queueName: QUEUE_NAMES.NARRATIVE_PROCESSING,
      workerName: 'NarrativeProcessingWorker',
      // Concurrency is intentionally 1 to prevent overlapping runs for the same
      // case from interleaving delete+create stages and corrupting results.
      concurrency: 1,
      lockDuration: 300_000, // 5 minutes for narrative analysis pipeline
    });
  }

  protected async processJob(job: Job<NarrativeProcessingJobData>, signal: AbortSignal): Promise<void> {
    const { tenantId, caseId, processingJobId } = job.data;

    // Mark ProcessingJob as active (direct ID lookup — safe across retries)
    if (processingJobId) {
      await prisma.processingJob.update({
        where: { id: processingJobId },
        data: { status: 'active', startedAt: new Date(), completedAt: null, failureCode: null, error: null },
      });
    }

    try {
      // Execute real narrative deconstruction pipeline
      console.log(`[NarrativeProcessingWorker] Starting narrative deconstruction for case ${caseId}`);

      const result = await deconstructNarrative(caseId, tenantId);

      // Check abort signal before writing completion status
      if (signal.aborted) throw new JobTimeoutError('Job aborted by timeout');

      // Mark ProcessingJob as completed with full pipeline results (idempotent — only if still 'active')
      if (processingJobId) {
        await prisma.processingJob.updateMany({
          where: { id: processingJobId, status: 'active' },
          data: {
            status: 'completed',
            completedAt: new Date(),
            acuCredits: job.data.acuCreditsRequired,
            failureCode: null,
            error: null,
            result: {
              ...result,
              completedAt: new Date().toISOString(),
            },
          },
        });
      }

      console.log(`[NarrativeProcessingWorker] Narrative deconstruction completed for case ${caseId}`, {
        evidenceProcessed: result.evidenceProcessed,
        claimsExtracted: result.claimsExtracted,
        contradictions: result.contradictions,
        impeachmentCandidates: result.impeachmentCandidates,
        durationMs: result.durationMs,
      });
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
          console.error(`[NarrativeProcessingWorker] Failed to update ProcessingJob status: ${dbMsg}`);
        }
      }
      throw error; // Rethrow to trigger BullMQ retry + ACU refund in base class
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const narrativeProcessingWorker = new NarrativeProcessingWorker();
