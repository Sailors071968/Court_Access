import type { Job } from 'bullmq';
import { CourtAccessWorker, JobTimeoutError } from '../lib/baseWorker.js';
import { QUEUE_NAMES, type VideoProcessingJobData } from '../lib/queues.js';
import prisma from '../lib/prisma.js';

class VideoProcessingWorker extends CourtAccessWorker<VideoProcessingJobData> {
  constructor() {
    super({
      queueName: QUEUE_NAMES.VIDEO_PROCESSING,
      workerName: 'VideoProcessingWorker',
      concurrency: 1,
      lockDuration: 300_000,
    });
  }

  protected async processJob(job: Job<VideoProcessingJobData>, signal: AbortSignal): Promise<void> {
    const { caseId, evidenceId, processingJobId } = job.data;

    const safeCaseId = caseId || 'test-case';

    if (processingJobId) {
      await prisma.processingJob.update({
        where: { id: processingJobId },
        data: {
          status: 'active',
          startedAt: new Date(),
          completedAt: null,
          failureCode: null,
          error: null,
        },
      });
    }

    try {
      console.log('VIDEO JOB STARTED');

      const evidence = await prisma.evidence.findUnique({
        where: { evidenceId },
      });

      if (!evidence) {
        throw new Error(`Evidence ${evidenceId} not found`);
      }

      // 🔒 ENFORCE CHARGES
      const charges = await prisma.charge.findMany({
        where: { caseId: safeCaseId },
      });

      if (!charges.length) {
        if (processingJobId) {
          await prisma.processingJob.update({
            where: { id: processingJobId },
            data: {
              status: 'failed',
              completedAt: new Date(),
              failureCode: 'NO_CHARGES_DEFINED',
              error: 'No charges defined for this case',
            },
          });
        }

        throw new Error('Processing blocked: No charges defined');
      }

      if (signal.aborted) throw new JobTimeoutError('Timeout');

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
          metadata: {
            charges: charges.map(c => ({
              code: c.code,
              section: c.section,
              victim: c.victim,
            })),
          },
        },
      });

      if (processingJobId) {
        await prisma.processingJob.updateMany({
          where: { id: processingJobId, status: 'active' },
          data: {
            status: 'completed',
            completedAt: new Date(),
            acuCredits: job.data.acuCreditsRequired,
          },
        });
      }

      console.log('VIDEO JOB COMPLETE');

    } catch (error) {
      if (error instanceof JobTimeoutError) throw error;

      if (processingJobId) {
        await prisma.processingJob.update({
          where: { id: processingJobId },
          data: {
            status: 'failed',
            completedAt: new Date(),
            failureCode: 'PROCESSING_ERROR',
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }

      throw error;
    }
  }
}

export const videoProcessingWorker = new VideoProcessingWorker();
