// ============================================================================
// CourtAccess — BullMQ Queue Definitions
// Shared queue instances for all worker pipelines.
// Each worker type gets a dedicated BullMQ Queue backed by Redis.
// ============================================================================

import { Queue, type ConnectionOptions } from 'bullmq';
import { redisConnection } from './redis.js';

// ============================================================================
// Queue Names (FIXED — no ":" allowed)
// ============================================================================

export const QUEUE_NAMES = {
  EVIDENCE_INGEST: 'court-access-evidence-ingest',
  FACT_EXTRACTION: 'court-access-fact-extraction',
  AI_ANALYSIS: 'court-access-ai-analysis',
  TRANSCRIPTION: 'court-access-transcription',
  TIMELINE_BUILD: 'court-access-timeline-build',
  DOCUMENT_INTEGRITY: 'court-access-document-integrity',
  GRAPH_SYNC: 'court-access-graph-sync',
  ANCHOR_CHAIN: 'court-access-anchor-chain',
  EXPORT_GENERATION: 'court-access-export-generation',
  NIGHTLY_INTEGRITY: 'court-access-nightly-integrity',
  NARRATIVE_PROCESSING: 'court-access-narrative-processing',
  CONTRADICTION_ANALYSIS: 'court-access-contradiction-analysis',
  VIDEO_PROCESSING: 'video',
  DOCTRINE_ANALYSIS: 'court-access-doctrine-analysis',
  DEAD_LETTER: 'court-access-dead-letter',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ---------------------------------------------------------------------------
// Job Data Interfaces
// ---------------------------------------------------------------------------

export interface BaseJobData {
  userId: string;
  tenantId: string;
  caseId?: string;
  /** ProcessingJob record ID for direct lookup (set by pipelineJobService) */
  processingJobId?: string;
  /** ACU credits required for this job (0 = no credit check) */
  acuCreditsRequired: number;
  /** Timestamp when the job was enqueued */
  enqueuedAt: string;
}

export interface EvidenceIngestJobData extends BaseJobData {
  evidenceId: string;
  fileKey: string;
  mimeType: string;
}

export interface TimelineBuildJobData extends BaseJobData {
  caseId: string;
  rebuild?: boolean;
}

export interface NarrativeProcessingJobData extends BaseJobData {
  caseId: string;
  narrativeId?: string;
}

export interface AiAnalysisJobData extends BaseJobData {
  caseId: string;
  analysisType: string;
}

export interface ContradictionAnalysisJobData extends BaseJobData {
  caseId: string;
}

export interface VideoProcessingJobData extends BaseJobData {
  caseId: string;
  evidenceId: string;
  fileKey: string;
  mimeType: string;
}

export interface DoctrineAnalysisJobData extends BaseJobData {
  caseId: string;
}

// ---------------------------------------------------------------------------
// Queue Instances (lazy-initialized, shared across the backend)
// ---------------------------------------------------------------------------

const queueCache = new Map<string, Queue>();

export function getQueue<T = BaseJobData>(name: string): Queue<T> {
  let queue = queueCache.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection: redisConnection as unknown as ConnectionOptions,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    });
    queueCache.set(name, queue);
  }
  return queue as Queue<T>;
}

// ---------------------------------------------------------------------------
// Convenience Queue Getters
// ---------------------------------------------------------------------------

export const evidenceIngestQueue = () => getQueue<EvidenceIngestJobData>(QUEUE_NAMES.EVIDENCE_INGEST);
export const timelineBuildQueue = () => getQueue<TimelineBuildJobData>(QUEUE_NAMES.TIMELINE_BUILD);
export const narrativeProcessingQueue = () => getQueue<NarrativeProcessingJobData>(QUEUE_NAMES.NARRATIVE_PROCESSING);
export const aiAnalysisQueue = () => getQueue<AiAnalysisJobData>(QUEUE_NAMES.AI_ANALYSIS);
export const deadLetterQueue = () => getQueue(QUEUE_NAMES.DEAD_LETTER);

// ---------------------------------------------------------------------------
// Queue Health Check
// ---------------------------------------------------------------------------

export async function getQueueHealth(): Promise<Record<string, { waiting: number; active: number; completed: number; failed: number }>> {
  const health: Record<string, { waiting: number; active: number; completed: number; failed: number }> = {};

  for (const [key, name] of Object.entries(QUEUE_NAMES)) {
    try {
      const queue = getQueue(name);
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
      ]);
      health[key] = { waiting, active, completed, failed };
    } catch {
      health[key] = { waiting: -1, active: -1, completed: -1, failed: -1 };
    }
  }

  return health;
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

export async function closeAllQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];
  for (const [, queue] of queueCache) {
    closePromises.push(queue.close());
  }
  await Promise.all(closePromises);
  queueCache.clear();
}
