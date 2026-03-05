// ============================================
// Court Access — Background Job Service (Phase 16: Performance Optimization)
// BullMQ-compatible job queue management for async evidence processing.
//
// Features:
//   - Job creation with priority queuing
//   - Job status tracking
//   - Queue statistics aggregation
//   - Non-blocking upload processing
//   - Retry logic with exponential backoff
//
// In production, this connects to Redis + BullMQ.
// ============================================

import type {
  BackgroundJob,
  JobType,
  JobStatus,
  JobPriority,
  QueueStats,
} from '../models/BackgroundJobModel';
import {
  DEFAULT_QUEUE_CONFIGS,
  JOB_PRIORITY_WEIGHTS,
} from '../models/BackgroundJobModel';

// ---------------------------------------------------------------------------
// Job ID Generation — Deterministic
// ---------------------------------------------------------------------------

let jobCounter = 0;

function generateJobId(jobType: JobType): string {
  jobCounter++;
  const timestamp = Date.now();
  return `job-${jobType}-${timestamp}-${jobCounter}`;
}

// ---------------------------------------------------------------------------
// Job Creation
// ---------------------------------------------------------------------------

export function createBackgroundJob(
  jobType: JobType,
  tenantId: string,
  caseId: string,
  evidenceId: string,
  payload: Record<string, unknown>,
  priority: JobPriority = 'normal'
): BackgroundJob {
  const config = DEFAULT_QUEUE_CONFIGS[jobType];

  return {
    jobId: generateJobId(jobType),
    jobType,
    status: 'queued',
    priority,
    tenantId,
    caseId,
    evidenceId,
    payload,
    result: null,
    error: null,
    attemptCount: 0,
    maxAttempts: config.maxRetries + 1,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    processingTimeMs: null,
  };
}

// ---------------------------------------------------------------------------
// Job Pipeline — Create Processing Chain
// ---------------------------------------------------------------------------

export function createEvidenceProcessingPipeline(
  tenantId: string,
  caseId: string,
  evidenceId: string,
  evidenceType: 'document' | 'audio' | 'video' | 'image'
): BackgroundJob[] {
  const jobs: BackgroundJob[] = [];

  // Step 1: Ingestion (always first)
  jobs.push(
    createBackgroundJob('evidence_ingestion', tenantId, caseId, evidenceId, {
      step: 'ingestion',
      evidenceType,
    }, 'high')
  );

  // Step 2: Type-specific analysis
  switch (evidenceType) {
    case 'document':
      jobs.push(
        createBackgroundJob('document_analysis', tenantId, caseId, evidenceId, {
          step: 'analysis',
        })
      );
      break;
    case 'audio':
      jobs.push(
        createBackgroundJob('audio_transcription', tenantId, caseId, evidenceId, {
          step: 'transcription',
        })
      );
      break;
    case 'video':
      jobs.push(
        createBackgroundJob('video_analysis', tenantId, caseId, evidenceId, {
          step: 'analysis',
        })
      );
      break;
    case 'image':
      jobs.push(
        createBackgroundJob('image_analysis', tenantId, caseId, evidenceId, {
          step: 'analysis',
        })
      );
      break;
  }

  // Step 3: Indexing (always after analysis)
  jobs.push(
    createBackgroundJob('evidence_indexing', tenantId, caseId, evidenceId, {
      step: 'indexing',
    })
  );

  // Step 4: Summary generation
  jobs.push(
    createBackgroundJob('summary_generation', tenantId, caseId, evidenceId, {
      step: 'summary',
    }, 'low')
  );

  // Step 5: Timeline extraction
  jobs.push(
    createBackgroundJob('timeline_extraction', tenantId, caseId, evidenceId, {
      step: 'timeline',
    }, 'low')
  );

  // Step 6: Integrity verification (always last)
  jobs.push(
    createBackgroundJob('integrity_verification', tenantId, caseId, evidenceId, {
      step: 'integrity',
    }, 'critical')
  );

  return jobs;
}

// ---------------------------------------------------------------------------
// Job Status Transitions — Deterministic State Machine
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ['active'],
  active: ['completed', 'failed', 'retrying'],
  retrying: ['active'],
  completed: [],
  failed: [],
};

export function transitionJobStatus(
  job: BackgroundJob,
  newStatus: JobStatus
): BackgroundJob {
  const validNextStates = VALID_TRANSITIONS[job.status];
  if (!validNextStates.includes(newStatus)) {
    return job; // Invalid transition — return unchanged
  }

  const updated = { ...job, status: newStatus };

  if (newStatus === 'active') {
    updated.startedAt = new Date().toISOString();
    updated.attemptCount = job.attemptCount + 1;
  }

  if (newStatus === 'completed') {
    updated.completedAt = new Date().toISOString();
    if (updated.startedAt) {
      updated.processingTimeMs =
        new Date(updated.completedAt).getTime() - new Date(updated.startedAt).getTime();
    }
  }

  if (newStatus === 'retrying') {
    updated.error = null;
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Queue Statistics — Aggregate from Job List
// ---------------------------------------------------------------------------

export function computeQueueStats(
  jobs: BackgroundJob[],
  queueName: string,
  jobType: JobType
): QueueStats {
  const queueJobs = jobs.filter((j) => j.jobType === jobType);

  const waiting = queueJobs.filter((j) => j.status === 'queued').length;
  const active = queueJobs.filter((j) => j.status === 'active').length;
  const completed = queueJobs.filter((j) => j.status === 'completed').length;
  const failed = queueJobs.filter((j) => j.status === 'failed').length;
  const delayed = queueJobs.filter((j) => j.status === 'retrying').length;

  const completedJobs = queueJobs.filter(
    (j) => j.status === 'completed' && j.processingTimeMs !== null
  );
  const avgProcessingTimeMs =
    completedJobs.length > 0
      ? completedJobs.reduce((sum, j) => sum + (j.processingTimeMs ?? 0), 0) / completedJobs.length
      : 0;

  return {
    queueName,
    waiting,
    active,
    completed,
    failed,
    delayed,
    avgProcessingTimeMs,
  };
}

// ---------------------------------------------------------------------------
// Job Sorting — Priority-Based
// ---------------------------------------------------------------------------

export function sortJobsByPriority(jobs: BackgroundJob[]): BackgroundJob[] {
  return [...jobs].sort((a, b) => {
    const weightA = JOB_PRIORITY_WEIGHTS[a.priority];
    const weightB = JOB_PRIORITY_WEIGHTS[b.priority];
    if (weightA !== weightB) return weightA - weightB;
    // Same priority: FIFO by creation time
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

// ---------------------------------------------------------------------------
// Retry Delay Calculation — Exponential Backoff
// ---------------------------------------------------------------------------

export function calculateRetryDelay(
  jobType: JobType,
  attemptCount: number
): number {
  const config = DEFAULT_QUEUE_CONFIGS[jobType];
  const baseDelay = config.retryDelayMs;
  // Exponential backoff: baseDelay * 2^(attempt - 1)
  return baseDelay * Math.pow(2, Math.max(0, attemptCount - 1));
}

// ---------------------------------------------------------------------------
// Upload Progress Tracking
// ---------------------------------------------------------------------------

export interface UploadProgress {
  evidenceId: string;
  fileName: string;
  totalBytes: number;
  uploadedBytes: number;
  percentComplete: number;
  status: 'preparing' | 'uploading' | 'processing' | 'complete' | 'error';
  startTime: string;
  estimatedTimeRemainingMs: number | null;
  uploadSpeedBps: number | null;
}

export function calculateUploadProgress(
  totalBytes: number,
  uploadedBytes: number,
  startTime: string
): Pick<UploadProgress, 'percentComplete' | 'estimatedTimeRemainingMs' | 'uploadSpeedBps'> {
  const percentComplete = totalBytes > 0 ? Math.min(100, (uploadedBytes / totalBytes) * 100) : 0;
  const elapsedMs = Date.now() - new Date(startTime).getTime();

  if (elapsedMs <= 0 || uploadedBytes <= 0) {
    return { percentComplete, estimatedTimeRemainingMs: null, uploadSpeedBps: null };
  }

  const uploadSpeedBps = (uploadedBytes * 1000) / elapsedMs;
  const remainingBytes = totalBytes - uploadedBytes;
  const estimatedTimeRemainingMs =
    uploadSpeedBps > 0 ? (remainingBytes / uploadSpeedBps) * 1000 : null;

  return { percentComplete, estimatedTimeRemainingMs, uploadSpeedBps };
}

// ---------------------------------------------------------------------------
// CDN Cache Configuration
// ---------------------------------------------------------------------------

export interface CDNCacheRule {
  pathPattern: string;
  maxAgeSeconds: number;
  staleWhileRevalidateSeconds: number;
  isPublic: boolean;
  description: string;
}

export const CDN_CACHE_RULES: CDNCacheRule[] = [
  {
    pathPattern: '/assets/*',
    maxAgeSeconds: 31536000, // 1 year
    staleWhileRevalidateSeconds: 86400,
    isPublic: true,
    description: 'Static assets (JS, CSS, images) — immutable content hash',
  },
  {
    pathPattern: '/testimonials/*',
    maxAgeSeconds: 2592000, // 30 days
    staleWhileRevalidateSeconds: 86400,
    isPublic: true,
    description: 'Testimonial videos — rarely change',
  },
  {
    pathPattern: '/evidence/*',
    maxAgeSeconds: 0,
    staleWhileRevalidateSeconds: 0,
    isPublic: false,
    description: 'Evidence files — private, no caching',
  },
  {
    pathPattern: '/api/*',
    maxAgeSeconds: 0,
    staleWhileRevalidateSeconds: 0,
    isPublic: false,
    description: 'API responses — never cache',
  },
];

export function getCacheHeadersForPath(path: string): string {
  for (const rule of CDN_CACHE_RULES) {
    const pattern = rule.pathPattern.replace('*', '');
    if (path.startsWith(pattern)) {
      if (rule.maxAgeSeconds === 0) {
        return 'no-store, no-cache, must-revalidate';
      }
      const visibility = rule.isPublic ? 'public' : 'private';
      return `${visibility}, max-age=${rule.maxAgeSeconds}, stale-while-revalidate=${rule.staleWhileRevalidateSeconds}`;
    }
  }
  return 'no-store';
}

// ---------------------------------------------------------------------------
// Database Query Optimization — Pagination
// ---------------------------------------------------------------------------

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function paginate<T>(
  items: T[],
  params: PaginationParams
): PaginatedResult<T> {
  const totalCount = items.length;
  const totalPages = Math.ceil(totalCount / params.pageSize);
  const page = Math.max(1, Math.min(params.page, totalPages || 1));
  const startIndex = (page - 1) * params.pageSize;
  const endIndex = startIndex + params.pageSize;

  return {
    items: items.slice(startIndex, endIndex),
    totalCount,
    page,
    pageSize: params.pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
