// ============================================================================
// Core Evidence System — Evidence Processing Pipeline (Part 5)
// Enqueues evidence for ingestion via canonical BullMQ queue (lib/queues).
// ============================================================================

import { evidenceIngestQueue, type EvidenceIngestJobData } from '../lib/queues.js';

export interface EvidenceIngestionJob {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  fileName: string;
  evidenceType: string;
  s3Key: string;
  size: number;
  isVideo: boolean;
  mimeType?: string;
  userId: string;
}

export async function enqueueEvidenceIngestion(job: EvidenceIngestionJob): Promise<void> {
  const jobData: EvidenceIngestJobData = {
    userId: job.userId,
    tenantId: job.tenantId,
    caseId: job.caseId,
    evidenceId: job.evidenceId,
    fileKey: job.s3Key,
    mimeType: job.mimeType ?? 'application/octet-stream',
    acuCreditsRequired: 0,
    enqueuedAt: new Date().toISOString(),
  };

  const queue = evidenceIngestQueue();
  await queue.add('evidence-ingest', jobData, {
    jobId: `evidence-ingest-${job.evidenceId}`,
    priority: job.isVideo ? 2 : 1,
  });

  console.log(`[EvidencePipeline] Enqueued ingestion for evidence ${job.evidenceId} (${job.evidenceType})`);
}
