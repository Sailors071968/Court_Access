// ============================================================================
// Phase 2 — Doctrine Analysis Worker (ACU-Enforced)
// BullMQ worker that processes POST Learning Domain doctrine mapping jobs.
// Extends CourtAccessWorker for automatic ACU credit validation/deduction.
// Flow: pending → running → completed/failed
// ============================================================================

import type { Job } from 'bullmq';
import { CourtAccessWorker, JobTimeoutError } from '../lib/baseWorker.js';
import { QUEUE_NAMES, type DoctrineAnalysisJobData } from '../lib/queues.js';
import prisma from '../lib/prisma.js';
import { DoctrineComplianceEngine } from '../doctrine/doctrineComplianceEngine.js';

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

      const evidenceIds = (await prisma.evidence.findMany({
        where: { caseId, tenantId },
        select: { evidenceId: true },
      })).map((e) => e.evidenceId);

      const chunks = evidenceIds.length > 0
        ? await prisma.evidenceChunk.findMany({
            where: { tenantId, evidenceId: { in: evidenceIds } },
            orderBy: { chunkIndex: 'asc' },
            take: 200,
          })
        : [];

      const combinedText = chunks.map((c) => c.text).join('\n').slice(0, 50000);
      if (combinedText.trim()) {
        const result = await DoctrineComplianceEngine.analyzeCompliance(combinedText);
        console.log(`[DoctrineAnalysisWorker] Doctrine scan: ${result.violations.length} violations, ${result.concerns.length} concerns`);
      } else {
        console.warn(`[DoctrineAnalysisWorker] No evidence text available for doctrine analysis on case ${caseId}`);
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

      console.log(`[DoctrineAnalysisWorker] Doctrine analysis completed for case ${caseId}`);
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
