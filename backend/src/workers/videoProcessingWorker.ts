// ============================================================================
// Phase 2 — Video Processing Worker (ACU-Enforced)
// BullMQ worker that processes video intelligence pipeline jobs.
// Extends CourtAccessWorker for automatic ACU credit validation/deduction.
// Flow: pending → running → completed/failed
// ============================================================================

import type { Job } from 'bullmq';
import { CourtAccessWorker, JobTimeoutError } from '../lib/baseWorker.js';
import { QUEUE_NAMES, type VideoProcessingJobData } from '../lib/queues.js';
import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Video Processing Worker
// ---------------------------------------------------------------------------

class VideoProcessingWorker extends CourtAccessWorker<VideoProcessingJobData> {
  constructor() {
    super({
      queueName: QUEUE_NAMES.VIDEO_PROCESSING,
      workerName: 'VideoProcessingWorker',
      concurrency: 1, // Video processing is resource-intensive
      lockDuration: 300_000, // 5 minutes for video analysis
    });
  }

  protected async processJob(job: Job<VideoProcessingJobData>, signal: AbortSignal): Promise<void> {
    const { caseId, evidenceId, processingJobId } = job.data;

    // Mark ProcessingJob as active (direct ID lookup — safe across retries)
    if (processingJobId) {
      await prisma.processingJob.update({
        where: { id: processingJobId },
        data: { status: 'active', startedAt: new Date(), completedAt: null, failureCode: null, error: null },
      });
    }

    try {
      console.log('VIDEO JOB STARTED');
      // Execute video intelligence pipeline
      console.log(`[VideoProcessingWorker] Processing video evidence ${evidenceId} for case ${caseId}`);

      // Verify evidence exists
      const evidence = await prisma.evidence.findUnique({
        where: { evidenceId },
      });

      if (!evidence) {
        throw new Error(`Evidence ${evidenceId} not found`);
      }

      console.log(`[VideoProcessingWorker] Processing ${evidence.fileName} (${evidence.evidenceType})`);

      // In production: runs 4-stage video intelligence pipeline:
      // 1. Frame extraction (ffmpeg)
      // 2. Overlay OCR (timestamp, GPS, camera ID extraction)
      // 3. Action detection (weapon drawn, handcuffing, force used, etc.)
      // 4. Event generation (structured timeline events from video)
      // Actual AI pipeline integration in Phase 3.

      // Check abort signal before writing completion status
      if (signal.aborted) throw new JobTimeoutError('Job aborted by timeout');

      // Write timeline event for video processing
      const safeCaseId = caseId || 'test-case';
      await prisma.timelineEvent.create({
        data: {
          caseId: safeCaseId,
          tenantId: 'dev-tenant',
          timestamp: new Date(),
          description: 'Video processed',
          sourceType: 'video',
          sourceDoc: evidence.fileName,
          actor: 'system',
          confidence: 0.99,
        },
      });
      console.log('🔥 EVENT WRITTEN TO DB');

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

      console.log(`[VideoProcessingWorker] Video processing completed for evidence ${evidenceId}`);
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
          console.error(`[VideoProcessingWorker] Failed to update ProcessingJob status: ${dbMsg}`);
        }
      }
      throw error; // Rethrow to trigger BullMQ retry + ACU refund in base class
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const videoProcessingWorker = new VideoProcessingWorker();
