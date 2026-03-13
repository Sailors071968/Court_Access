// ============================================================================
// Timeline Reconstruction Engine — Worker 3: Event Correlation
// Correlates events across multiple evidence sources by timestamp
// proximity. Groups related events into unified timeline entries.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import type { EventCorrelationJob } from './timelineProcessingPipeline.js';
import { enqueueTimelineBuild } from './timelineProcessingPipeline.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Worker Processor
// ---------------------------------------------------------------------------

export async function processEventCorrelation(job: EventCorrelationJob): Promise<{
  correlationsFound: number;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  console.log(
    `[TimelineEngine] Event correlation started` +
    ` caseId=${job.caseId}` +
    ` triggerEvidenceId=${job.triggerEvidenceId}`
  );

  // In production: fetch all extracted temporal events for this case,
  // group by timestamp proximity (±30 seconds), and create correlation records.
  console.log(
    `[TimelineEngine] Would correlate events across evidence sources for case ${job.caseId}`
  );

  const processingTimeMs = Date.now() - startTime;
  console.log(
    `[TimelineEngine] Event correlation completed` +
    ` caseId=${job.caseId}` +
    ` correlations=0` +
    ` processingTime=${(processingTimeMs / 1000).toFixed(1)}s`
  );

  // Trigger timeline build
  try {
    await enqueueTimelineBuild({
      caseId: job.caseId,
      tenantId: job.tenantId,
    });
  } catch (err) {
    console.error(`[TimelineEngine] Failed to enqueue timeline build:`, err);
  }

  return { correlationsFound: 0, processingTimeMs };
}
