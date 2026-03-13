// ============================================================================
// Timeline Reconstruction Engine — Processing Pipeline
// Defines job interfaces, queue configs, and enqueue functions for
// the 4-worker timeline analysis pipeline.
// ============================================================================

import { QUEUE_CONFIGS, getQueue } from '../workers/queueManager.js';

// ---------------------------------------------------------------------------
// Pipeline Job Types
// ---------------------------------------------------------------------------

export interface TemporalExtractionJob {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  fileName: string;
  evidenceType: string;
  s3Key: string;
}

export interface VideoEventExtractionJob {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  s3Key: string;
  fileName: string;
  duration?: number;
}

export interface EventCorrelationJob {
  caseId: string;
  tenantId: string;
  triggerEvidenceId: string;
}

export interface TimelineBuilderJob {
  caseId: string;
  tenantId: string;
  rebuild?: boolean;
}

// ---------------------------------------------------------------------------
// Register Queue Configs
// ---------------------------------------------------------------------------

if (!QUEUE_CONFIGS.timelineTemporalExtraction) {
  QUEUE_CONFIGS.timelineTemporalExtraction = {
    name: 'timeline-temporal-extraction',
    concurrency: 3,
    maxRetries: 3,
    retryBackoffMs: 10_000,
    timeoutMs: 300_000,
    enabled: true,
    description: 'Extract temporal references and timestamps from evidence documents',
  };
}

if (!QUEUE_CONFIGS.timelineVideoEvents) {
  QUEUE_CONFIGS.timelineVideoEvents = {
    name: 'timeline-video-events',
    concurrency: 2,
    maxRetries: 2,
    retryBackoffMs: 15_000,
    timeoutMs: 600_000,
    enabled: true,
    description: 'Extract timestamped events from bodycam and dashcam video evidence',
  };
}

if (!QUEUE_CONFIGS.timelineEventCorrelation) {
  QUEUE_CONFIGS.timelineEventCorrelation = {
    name: 'timeline-event-correlation',
    concurrency: 2,
    maxRetries: 2,
    retryBackoffMs: 10_000,
    timeoutMs: 300_000,
    enabled: true,
    description: 'Correlate events across multiple evidence sources by timestamp proximity',
  };
}

if (!QUEUE_CONFIGS.timelineBuilder) {
  QUEUE_CONFIGS.timelineBuilder = {
    name: 'timeline-builder',
    concurrency: 2,
    maxRetries: 2,
    retryBackoffMs: 10_000,
    timeoutMs: 300_000,
    enabled: true,
    description: 'Build unified case timeline from correlated events',
  };
}

// ---------------------------------------------------------------------------
// Enqueue Functions
// ---------------------------------------------------------------------------

export async function enqueueTemporalExtraction(job: TemporalExtractionJob): Promise<void> {
  const queue = getQueue<TemporalExtractionJob>('timelineTemporalExtraction');
  await queue.add('temporal-extract', job, {
    jobId: `temporal-extract-${job.evidenceId}`,
    priority: 1,
  });
  console.log(`[TimelinePipeline] Enqueued temporal extraction for evidence ${job.evidenceId}`);
}

export async function enqueueVideoEventExtraction(job: VideoEventExtractionJob): Promise<void> {
  const queue = getQueue<VideoEventExtractionJob>('timelineVideoEvents');
  await queue.add('video-events', job, {
    jobId: `video-events-${job.evidenceId}`,
    priority: 2,
  });
  console.log(`[TimelinePipeline] Enqueued video event extraction for evidence ${job.evidenceId}`);
}

export async function enqueueEventCorrelation(job: EventCorrelationJob): Promise<void> {
  const queue = getQueue<EventCorrelationJob>('timelineEventCorrelation');
  await queue.add('event-correlate', job, {
    jobId: `event-correlate-${job.caseId}`,
  });
  console.log(`[TimelinePipeline] Enqueued event correlation for case ${job.caseId}`);
}

export async function enqueueTimelineBuild(job: TimelineBuilderJob): Promise<void> {
  const queue = getQueue<TimelineBuilderJob>('timelineBuilder');
  await queue.add('timeline-build', job, {
    jobId: `timeline-build-${job.caseId}`,
  });
  console.log(`[TimelinePipeline] Enqueued timeline build for case ${job.caseId}`);
}
