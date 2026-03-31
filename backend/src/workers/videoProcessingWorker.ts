// ============================================================================
// Phase B — Video Processing Worker (ACU-Enforced)
// BullMQ worker that runs the multi-stage video intelligence pipeline.
// Extends CourtAccessWorker for automatic ACU credit validation/deduction.
// Stages: Probe → Segment → Frame Extract → OCR → Transcribe → Action Detect → Event Generate
// ============================================================================

import type { Job } from 'bullmq';
import { CourtAccessWorker, JobTimeoutError } from '../lib/baseWorker.js';
import { QUEUE_NAMES, type VideoProcessingJobData } from '../lib/queues.js';
import prisma from '../lib/prisma.js';
import { runVideoPipeline } from '../services/videoPipelineOrchestrator.js';

// ---------------------------------------------------------------------------
// Video Processing Worker
// ---------------------------------------------------------------------------

class VideoProcessingWorker extends CourtAccessWorker<VideoProcessingJobData> {
  constructor() {
    super({
      queueName: QUEUE_NAMES.VIDEO_PROCESSING,
      workerName: 'VideoProcessingWorker',
      concurrency: 1, // Video processing is resource-intensive (FFmpeg + disk I/O)
      lockDuration: 600_000, // 10 minutes — videos can be large
      jobTimeoutMs: 1_800_000, // 30 minutes max per video
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
      // Verify evidence exists and get S3 key
      const evidence = await prisma.evidence.findUnique({
        where: { evidenceId },
      });

      if (!evidence) {
        throw new Error(`Evidence ${evidenceId} not found`);
      }

      if (!evidence.s3Key) {
        throw new Error(`Evidence ${evidenceId} has no S3 key — file not uploaded`);
      }

      console.log(`[VideoProcessingWorker] Starting pipeline for ${evidence.fileName} (${evidence.evidenceType})`);

      // Run the full multi-stage video intelligence pipeline
      await runVideoPipeline({
        evidenceId,
        caseId,
        tenantId: job.data.tenantId,
        s3Key: evidence.s3Key,
        processingJobId,
        signal,
        onProgress: (stage, stageProgress) => {
          // Report progress back to BullMQ for monitoring
          void job.updateProgress({
            stage,
            stageProgress,
            evidenceId,
          });
        },
      });

      // Check abort signal before writing completion status
      if (signal.aborted) throw new JobTimeoutError('Job aborted by timeout');

      // Update evidence processing status
      await prisma.evidence.update({
        where: { evidenceId },
        data: {
          processingStatus: 'analyzed',
          analysisStatus: 'completed',
        },
      });

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

      console.log(`[VideoProcessingWorker] Pipeline completed for evidence ${evidenceId}`);
    } catch (error) {
      // Skip DB write for timeout — base worker handles JOB_TIMEOUT status
      if (error instanceof JobTimeoutError) throw error;

      // Update evidence processing status to failed
      await prisma.evidence.update({
        where: { evidenceId },
        data: {
          processingStatus: 'failed',
          analysisStatus: 'failed',
          processingError: error instanceof Error ? error.message : String(error),
        },
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[VideoProcessingWorker] Failed to update evidence status: ${msg}`);
      });

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
