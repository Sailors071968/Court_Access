// ============================================================================
// Evidence Ingest Worker — Processes presigned-upload evidence via BullMQ
// Uses canonical evidenceProcessingService for OCR + chunking.
// ============================================================================

import type { Job } from 'bullmq';
import { CourtAccessWorker } from '../lib/baseWorker.js';
import { QUEUE_NAMES, type EvidenceIngestJobData } from '../lib/queues.js';
import { processEvidenceRecord } from '../evidence/evidenceProcessingService.js';

class EvidenceIngestWorker extends CourtAccessWorker<EvidenceIngestJobData> {
  constructor() {
    super({
      queueName: QUEUE_NAMES.EVIDENCE_INGEST,
      workerName: 'EvidenceIngestWorker',
      concurrency: 3,
      lockDuration: 180_000,
      jobTimeoutMs: 300_000,
    });
  }

  protected async processJob(job: Job<EvidenceIngestJobData>, _signal: AbortSignal): Promise<void> {
    const { evidenceId, tenantId } = job.data;
    console.log(`[EvidenceIngestWorker] Processing evidence ${evidenceId}`);
    await processEvidenceRecord(evidenceId, tenantId);
    console.log(`[EvidenceIngestWorker] Completed evidence ${evidenceId}`);
  }
}

export const evidenceIngestWorker = new EvidenceIngestWorker();
