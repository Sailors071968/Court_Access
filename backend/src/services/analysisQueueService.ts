// ============================================
// Court Access — Analysis Queue Service (BullMQ)
// ============================================

import { Queue, type ConnectionOptions } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import { logger } from '../config/logger.js';

const QUEUE_NAME = 'analysis-pipeline';

let analysisQueue: Queue | null = null;

export function getAnalysisQueue(): Queue {
  if (!analysisQueue) {
    analysisQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection() as unknown as ConnectionOptions,
    });
  }
  return analysisQueue;
}

export interface AnalysisJobData {
  documentId: string;
  caseId: string;
  tenantId: string;
  storagePath: string;
  fileName: string;
}

/**
 * Enqueue a document for analysis processing.
 */
export async function enqueueAnalysisJob(data: AnalysisJobData): Promise<string> {
  const queue = getAnalysisQueue();
  const job = await queue.add('analyze-document', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });

  logger.info('Analysis job enqueued', {
    jobId: job.id,
    documentId: data.documentId,
  });

  return job.id || data.documentId;
}
