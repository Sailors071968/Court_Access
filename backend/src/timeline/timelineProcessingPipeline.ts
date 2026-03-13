// ============================================================================
// Timeline Reconstruction Engine — Processing Pipeline
// 4 BullMQ queues: temporal extraction, video events, correlation, builder
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
  sourceType: string; // police_report | witness_statement | transcript | cad_log | investigator_report
}

export interface VideoEventDetectionJob {
  evidenceId: string;
  caseId: string;
  tenantId: string;
  fileName: string;
  s3Key: string;
  sourceType: string; // bodycam | dashcam | surveillance | witness_video
  duration?: number;
}

export interface EventCorrelationJob {
  caseId: string;
  tenantId: string;
  triggerEvidenceId?: string; // optional: which evidence triggered this correlation run
}

export interface TimelineBuilderJob {
  caseId: string;
  tenantId: string;
  rebuild?: boolean; // if true, clear existing timeline and rebuild from scratch
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
    timeoutMs: 300_000, // 5 minutes per document
    enabled: true,
    description: 'Extracts temporal references (timestamps, time ranges, relative time) from text evidence',
  };
}

if (!QUEUE_CONFIGS.timelineVideoEvents) {
  QUEUE_CONFIGS.timelineVideoEvents = {
    name: 'timeline-video-events',
    concurrency: 2,
    maxRetries: 2,
    retryBackoffMs: 30_000,
    timeoutMs: 600_000, // 10 minutes per video
    enabled: true,
    description: 'Detects events in video evidence (gunshots, stops, pursuits, arrivals, use of force)',
  };
}

if (!QUEUE_CONFIGS.timelineEventCorrelation) {
  QUEUE_CONFIGS.timelineEventCorrelation = {
    name: 'timeline-event-correlation',
    concurrency: 2,
    maxRetries: 2,
    retryBackoffMs: 15_000,
    timeoutMs: 300_000,
    enabled: true,
    description: 'Correlates events across multiple evidence sources into unified event groups',
  };
}

if (!QUEUE_CONFIGS.timelineBuilder) {
  QUEUE_CONFIGS.timelineBuilder = {
    name: 'timeline-builder',
    concurrency: 1,
    maxRetries: 2,
    retryBackoffMs: 15_000,
    timeoutMs: 600_000, // 10 minutes for large cases
    enabled: true,
    description: 'Constructs master case timeline: sorts events, detects conflicts, estimates clock offsets',
  };
}

// ---------------------------------------------------------------------------
// Enqueue Functions
// ---------------------------------------------------------------------------

export async function enqueueTemporalExtraction(job: TemporalExtractionJob): Promise<void> {
  const queue = getQueue<TemporalExtractionJob>('timelineTemporalExtraction');
  await queue.add('temporal-extract', job, {
    jobId: `temporal-${job.evidenceId}`,
  });
  console.log(`[TimelinePipeline] Enqueued temporal extraction for evidence ${job.evidenceId} (${job.sourceType})`);
}

export async function enqueueVideoEventDetection(job: VideoEventDetectionJob): Promise<void> {
  const queue = getQueue<VideoEventDetectionJob>('timelineVideoEvents');
  await queue.add('video-event-detect', job, {
    jobId: `video-events-${job.evidenceId}`,
    priority: 2, // Video processing is lower priority than text
  });
  console.log(`[TimelinePipeline] Enqueued video event detection for evidence ${job.evidenceId} (${job.sourceType})`);
}

export async function enqueueEventCorrelation(job: EventCorrelationJob): Promise<void> {
  const queue = getQueue<EventCorrelationJob>('timelineEventCorrelation');
  await queue.add('event-correlate', job, {
    jobId: `correlate-${job.caseId}`,
  });
  console.log(`[TimelinePipeline] Enqueued event correlation for case ${job.caseId}`);
}

export async function enqueueTimelineBuild(job: TimelineBuilderJob): Promise<void> {
  const queue = getQueue<TimelineBuilderJob>('timelineBuilder');
  await queue.add('timeline-build', job, {
    jobId: `build-${job.caseId}`,
  });
  console.log(`[TimelinePipeline] Enqueued timeline build for case ${job.caseId}${job.rebuild ? ' (rebuild)' : ''}`);
}
