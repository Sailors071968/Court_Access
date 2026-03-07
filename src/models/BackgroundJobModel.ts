// ============================================
// Court Access — Background Job Model (Phase 16: Performance Optimization)
// BullMQ-compatible job queue model for async evidence processing.
//
// Job types:
//   - evidence_ingestion: file upload + hash computation
//   - audio_transcription: audio → transcript
//   - video_analysis: video → frames + transcript
//   - image_analysis: image → OCR + metadata
//   - document_analysis: document → text extraction
//   - evidence_indexing: text → search index
//   - integrity_verification: hash verification
//
// All jobs are tenant-isolated and deterministic.
// ============================================

// ---------------------------------------------------------------------------
// Job Types
// ---------------------------------------------------------------------------

export type JobType =
  | 'evidence_ingestion'
  | 'audio_transcription'
  | 'video_analysis'
  | 'image_analysis'
  | 'document_analysis'
  | 'evidence_indexing'
  | 'integrity_verification'
  | 'summary_generation'
  | 'timeline_extraction'
  | 'graph_building';

export type JobStatus = 'queued' | 'active' | 'completed' | 'failed' | 'retrying';

export type JobPriority = 'critical' | 'high' | 'normal' | 'low';

// ---------------------------------------------------------------------------
// Job Model
// ---------------------------------------------------------------------------

export interface BackgroundJob {
  jobId: string;
  jobType: JobType;
  status: JobStatus;
  priority: JobPriority;
  tenantId: string;
  caseId: string;
  evidenceId: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  attemptCount: number;
  maxAttempts: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  processingTimeMs: number | null;
}

// ---------------------------------------------------------------------------
// Job Queue Configuration
// ---------------------------------------------------------------------------

export interface QueueConfig {
  queueName: string;
  concurrency: number;
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
}

export const DEFAULT_QUEUE_CONFIGS: Record<JobType, QueueConfig> = {
  evidence_ingestion: {
    queueName: 'evidence-ingestion',
    concurrency: 5,
    maxRetries: 3,
    retryDelayMs: 5000,
    timeoutMs: 120000,
  },
  audio_transcription: {
    queueName: 'audio-transcription',
    concurrency: 2,
    maxRetries: 2,
    retryDelayMs: 10000,
    timeoutMs: 600000,
  },
  video_analysis: {
    queueName: 'video-analysis',
    concurrency: 1,
    maxRetries: 2,
    retryDelayMs: 15000,
    timeoutMs: 900000,
  },
  image_analysis: {
    queueName: 'image-analysis',
    concurrency: 3,
    maxRetries: 3,
    retryDelayMs: 5000,
    timeoutMs: 120000,
  },
  document_analysis: {
    queueName: 'document-analysis',
    concurrency: 4,
    maxRetries: 3,
    retryDelayMs: 5000,
    timeoutMs: 300000,
  },
  evidence_indexing: {
    queueName: 'evidence-indexing',
    concurrency: 3,
    maxRetries: 2,
    retryDelayMs: 5000,
    timeoutMs: 120000,
  },
  integrity_verification: {
    queueName: 'integrity-verification',
    concurrency: 5,
    maxRetries: 1,
    retryDelayMs: 3000,
    timeoutMs: 60000,
  },
  summary_generation: {
    queueName: 'summary-generation',
    concurrency: 2,
    maxRetries: 2,
    retryDelayMs: 10000,
    timeoutMs: 300000,
  },
  timeline_extraction: {
    queueName: 'timeline-extraction',
    concurrency: 3,
    maxRetries: 2,
    retryDelayMs: 5000,
    timeoutMs: 120000,
  },
  graph_building: {
    queueName: 'graph-building',
    concurrency: 2,
    maxRetries: 2,
    retryDelayMs: 5000,
    timeoutMs: 180000,
  },
};

// ---------------------------------------------------------------------------
// Job Priority Weights
// ---------------------------------------------------------------------------

export const JOB_PRIORITY_WEIGHTS: Record<JobPriority, number> = {
  critical: 1,
  high: 5,
  normal: 10,
  low: 20,
};

// ---------------------------------------------------------------------------
// Queue Statistics
// ---------------------------------------------------------------------------

export interface QueueStats {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  avgProcessingTimeMs: number;
}

// ---------------------------------------------------------------------------
// Job Labels
// ---------------------------------------------------------------------------

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  evidence_ingestion: 'Evidence Ingestion',
  audio_transcription: 'Audio Transcription',
  video_analysis: 'Video Analysis',
  image_analysis: 'Image Analysis',
  document_analysis: 'Document Analysis',
  evidence_indexing: 'Evidence Indexing',
  integrity_verification: 'Integrity Verification',
  summary_generation: 'Summary Generation',
  timeline_extraction: 'Timeline Extraction',
  graph_building: 'Graph Building',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: 'Queued',
  active: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  retrying: 'Retrying',
};
