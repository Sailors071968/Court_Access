// ============================================================================
// Phase 2 — Video Processing Worker (Real Intelligence Pipeline)
// BullMQ worker that processes video through a 4-stage intelligence pipeline:
//   Stage 1 (10%)  — FFmpeg audio extraction
//   Stage 2 (40%)  — Whisper transcription
//   Stage 3 (70%)  — Event extraction from transcript
//   Stage 4 (100%) — Timeline insertion + evidence update
//
// Extends CourtAccessWorker for automatic ACU credit validation/deduction.
// ============================================================================

import type { Job } from 'bullmq';
import { CourtAccessWorker, JobTimeoutError } from '../lib/baseWorker.js';
import { QUEUE_NAMES, type VideoProcessingJobData } from '../lib/queues.js';
import prisma from '../lib/prisma.js';
import { runVideoIntelligencePipeline } from '../services/videoIntelligencePipeline.js';

// ---------------------------------------------------------------------------
// Video Processing Worker
// ---------------------------------------------------------------------------

class VideoProcessingWorker extends CourtAccessWorker<VideoProcessingJobData> {
  constructor() {
    super({
      queueName: QUEUE_NAMES.VIDEO_PROCESSING,
      workerName: 'VideoProcessingWorker',
      concurrency: 1, // Video processing is resource-intensive
      lockDuration: 900_000, // 15 minutes — must exceed jobTimeoutMs
      jobTimeoutMs: 900_000, // 15 minutes — FFmpeg (3m) + Whisper (5m/chunk × N chunks) + extraction + insertion
    });
  }

  protected async processJob(job: Job<VideoProcessingJobData>, signal: AbortSignal): Promise<void> {
    const { caseId, evidenceId, processingJobId, fileKey, mimeType } = job.data;

    // Mark ProcessingJob as active (direct ID lookup — safe across retries)
    if (processingJobId) {
      await prisma.processingJob.update({
        where: { id: processingJobId },
        data: { status: 'active', startedAt: new Date(), completedAt: null, failureCode: null, error: null },
      });
    }

    try {
      console.log(`[VideoProcessingWorker] Starting real video pipeline for evidence ${evidenceId} (case ${caseId})`);

      // Verify evidence exists
      const evidence = await prisma.evidence.findUnique({
        where: { evidenceId },
      });

      if (!evidence) {
        throw new Error(`Evidence ${evidenceId} not found`);
      }

      console.log(`[VideoProcessingWorker] Processing ${evidence.fileName} (${evidence.evidenceType}, mime: ${mimeType})`);

      // Use the actual S3/R2 key from evidence record if fileKey not provided
      const resolvedFileKey = fileKey || evidence.s3Key;
      if (!resolvedFileKey) {
        throw new Error(`No file key available for evidence ${evidenceId} — file may not have been uploaded`);
      }

      // Check abort signal before starting pipeline
      if (signal.aborted) throw new JobTimeoutError('Job aborted by timeout');

      // Run the real 4-stage video intelligence pipeline
      // Progress callback reports to BullMQ job for real-time UI updates
      const pipelineResult = await runVideoIntelligencePipeline(
        caseId,
        evidenceId,
        resolvedFileKey,
        evidence.evidenceType,
        signal,
        async (progress: number, stage: string) => {
          await job.updateProgress(progress);
          console.log(`[VideoProcessingWorker] ${evidenceId}: ${progress}% — ${stage}`);
        },
      );

      // Log pipeline result summary
      console.log(`[VideoProcessingWorker] Pipeline complete for ${evidenceId}:`, {
        audioExtracted: pipelineResult.audioExtracted,
        transcriptLength: pipelineResult.transcriptLength,
        eventsExtracted: pipelineResult.eventsExtracted,
        eventsStored: pipelineResult.eventsStored,
        speechEventsStored: pipelineResult.speechEventsStored,
        durationMs: pipelineResult.durationMs,
        warnings: pipelineResult.warnings,
      });

      // Check abort signal before writing completion status
      if (signal.aborted) throw new JobTimeoutError('Job aborted by timeout');

      // Mark ProcessingJob as completed with pipeline result metadata
      if (processingJobId) {
        await prisma.processingJob.updateMany({
          where: { id: processingJobId, status: 'active' },
          data: {
            status: 'completed',
            completedAt: new Date(),
            acuCredits: job.data.acuCreditsRequired,
            result: {
              audioExtracted: pipelineResult.audioExtracted,
              transcriptLength: pipelineResult.transcriptLength,
              eventsExtracted: pipelineResult.eventsExtracted,
              eventsStored: pipelineResult.eventsStored,
              speechEventsStored: pipelineResult.speechEventsStored,
              durationMs: pipelineResult.durationMs,
              warnings: pipelineResult.warnings,
            },
            failureCode: null,
            error: null,
          },
        });
      }

      console.log(`[VideoProcessingWorker] Video processing completed for evidence ${evidenceId}`);
    } catch (error) {
      // Convert abort-induced errors from the pipeline into JobTimeoutError
      // so the base worker correctly marks them as timeouts (non-retryable)
      // instead of PROCESSING_ERROR (retryable).
      if (
        signal.aborted &&
        error instanceof Error &&
        !(error instanceof JobTimeoutError)
      ) {
        throw new JobTimeoutError(`Job timed out during pipeline: ${error.message}`);
      }

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

      // Also mark evidence as failed
      try {
        const message = error instanceof Error ? error.message : String(error);
        await prisma.evidence.update({
          where: { evidenceId },
          data: {
            processingStatus: 'failed',
            processingError: message.slice(0, 500),
          },
        });
      } catch {
        // Best-effort — don't mask the original error
      }

      throw error; // Rethrow to trigger BullMQ retry + ACU refund in base class
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const videoProcessingWorker = new VideoProcessingWorker();
