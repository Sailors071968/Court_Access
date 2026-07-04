// ============================================================================
// Narrative Sub-Queue Workers
// Registers BullMQ consumers for the 4-stage narrative deconstruction pipeline.
// ============================================================================

import { createManagedWorker } from '../workers/queueManager.js';
import type { Job } from 'bullmq';
import { processClaimExtraction } from '../narrative/claimExtractionWorker.js';
import { processClaimNormalization } from '../narrative/claimNormalizationWorker.js';
import { processEvidenceValidation } from '../narrative/evidenceValidationWorker.js';
import { processImpeachmentAnalysis } from '../narrative/impeachmentDetectionWorker.js';
import type {
  ClaimExtractionJob,
  ClaimNormalizationJob,
  EvidenceValidationJob,
  ImpeachmentAnalysisJob,
} from '../narrative/narrativeProcessingPipeline.js';

const narrativeSubWorkers: Array<{ key: string; stop: () => Promise<void> }> = [];

export function startNarrativeSubWorkers(): void {
  if (process.env.DISABLE_WORKERS === 'true') return;

  const configs: Array<{
    key: string;
    processor: (job: Job<never>) => Promise<unknown>;
  }> = [
    {
      key: 'narrativeClaimExtraction',
      processor: (job) => processClaimExtraction(job.data as ClaimExtractionJob),
    },
    {
      key: 'narrativeClaimNormalization',
      processor: (job) => processClaimNormalization(job.data as ClaimNormalizationJob),
    },
    {
      key: 'narrativeEvidenceValidation',
      processor: (job) => processEvidenceValidation(job.data as EvidenceValidationJob),
    },
    {
      key: 'narrativeImpeachmentAnalysis',
      processor: (job) => processImpeachmentAnalysis(job.data as ImpeachmentAnalysisJob),
    },
  ];

  for (const { key, processor } of configs) {
    createManagedWorker(key, processor as (job: Job<never>) => Promise<unknown>);
    narrativeSubWorkers.push({
      key,
      stop: async () => {
        const { stopWorker } = await import('../workers/queueManager.js');
        await stopWorker(key);
      },
    });
  }

  console.log('[NarrativeSubWorkers] Started 4 narrative sub-queue workers');
}

export async function stopNarrativeSubWorkers(): Promise<void> {
  await Promise.all(narrativeSubWorkers.map((w) => w.stop()));
  narrativeSubWorkers.length = 0;
}
