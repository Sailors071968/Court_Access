// ============================================================================
// Timeline Reconstruction Engine — Worker 2: Video Event Extraction
// Extracts timestamped events from bodycam, dashcam, and witness video.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import type { VideoEventExtractionJob } from './timelineProcessingPipeline.js';
import { enqueueEventCorrelation } from './timelineProcessingPipeline.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Worker Processor
// ---------------------------------------------------------------------------

export async function processVideoEventExtraction(job: VideoEventExtractionJob): Promise<{
  eventsExtracted: number;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  console.log(
    `[TimelineEngine] Video event extraction started` +
    ` caseId=${job.caseId}` +
    ` evidenceId=${job.evidenceId}` +
    ` fileName=${job.fileName}`
  );

  // Verify evidence exists
  const evidence = await prisma.evidence.findUnique({
    where: { evidenceId: job.evidenceId },
  });

  if (!evidence) {
    console.error(`[TimelineEngine] Evidence ${job.evidenceId} not found`);
    return { eventsExtracted: 0, processingTimeMs: Date.now() - startTime };
  }

  // In production: download video from R2, run frame analysis, extract events.
  console.log(
    `[TimelineEngine] Would extract video events from ${job.fileName}` +
    ` s3Key=${job.s3Key}` +
    ` duration=${job.duration ?? 'unknown'}s`
  );

  const processingTimeMs = Date.now() - startTime;
  console.log(
    `[TimelineEngine] Video event extraction completed` +
    ` caseId=${job.caseId}` +
    ` evidenceId=${job.evidenceId}` +
    ` events=0` +
    ` processingTime=${(processingTimeMs / 1000).toFixed(1)}s`
  );

  // Trigger event correlation
  try {
    await enqueueEventCorrelation({
      caseId: job.caseId,
      tenantId: job.tenantId,
      triggerEvidenceId: job.evidenceId,
    });
  } catch (err) {
    console.error(`[TimelineEngine] Failed to enqueue event correlation:`, err);
  }

  return { eventsExtracted: 0, processingTimeMs };
}
