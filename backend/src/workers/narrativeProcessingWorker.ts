// ============================================================================
// Phase 2 — Narrative Processing Worker (ACU-Enforced)
// BullMQ worker that processes narrative deconstruction jobs.
// Extends CourtAccessWorker for automatic ACU credit validation/deduction.
// Flow: pending → running → completed/failed
// ============================================================================

import type { Job } from 'bullmq';
import { CourtAccessWorker } from '../lib/baseWorker.js';
import { QUEUE_NAMES, type NarrativeProcessingJobData } from '../lib/queues.js';
import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Narrative Processing Worker
// ---------------------------------------------------------------------------

class NarrativeProcessingWorker extends CourtAccessWorker<NarrativeProcessingJobData> {
  constructor() {
    super({
      queueName: QUEUE_NAMES.NARRATIVE_PROCESSING,
      workerName: 'NarrativeProcessingWorker',
      concurrency: 2,
      lockDuration: 120_000, // 2 minutes for narrative analysis
    });
  }

  protected async processJob(job: Job<NarrativeProcessingJobData>): Promise<void> {
    const { tenantId, caseId, processingJobId } = job.data;

    // Mark ProcessingJob as active (direct ID lookup — safe across retries)
    if (processingJobId) {
      await prisma.processingJob.update({
        where: { id: processingJobId },
        data: { status: 'active', startedAt: new Date(), completedAt: null, failureCode: null, error: null },
      });
    }

    try {
      // Execute narrative deconstruction pipeline
      console.log(`[NarrativeProcessingWorker] Deconstructing narratives for case ${caseId}`);

      // Fetch evidence documents for claim extraction
      const evidence = await prisma.evidence.findMany({
        where: { caseId, tenantId },
        select: { evidenceId: true, evidenceType: true, fileName: true },
      });

      // Filter to narrative-relevant evidence types
      const narrativeEvidence = evidence.filter((e) =>
        ['police_report', 'probable_cause', 'arrest_affidavit', 'supplemental_report', 'incident_report'].includes(e.evidenceType),
      );

      console.log(`[NarrativeProcessingWorker] Found ${narrativeEvidence.length} narrative documents for case ${caseId}`);

      // In production: runs 4-stage pipeline:
      // 1. Claim extraction (claimExtractionWorker)
      // 2. Claim normalization (claimNormalizationWorker)
      // 3. Evidence validation (evidenceValidationWorker)
      // 4. Impeachment detection (impeachmentDetectionWorker)
      // Actual AI pipeline integration in Phase 3.

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
              narrativeDocuments: narrativeEvidence.length,
              totalEvidence: evidence.length,
              caseId,
              completedAt: new Date().toISOString(),
            },
          },
        });
      }

      console.log(`[NarrativeProcessingWorker] Narrative deconstruction completed for case ${caseId}`);
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
