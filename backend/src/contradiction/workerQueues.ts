// ============================================================================
// Worker Queue Isolation
// Separate BullMQ-compatible queue definitions for each CDE pipeline stage.
// Each queue runs independently to prevent pipeline stages from blocking
// other system functions.
// ============================================================================

// ---------------------------------------------------------------------------
// Queue Definitions
// ---------------------------------------------------------------------------

export interface QueueConfig {
  name: string;
  concurrency: number;
  maxRetries: number;
  backoffMs: number;
  timeoutMs: number;
  description: string;
}

/**
 * Isolated queue configurations for each CDE pipeline stage.
 * Each queue is designed to run in its own PM2 worker process.
 */
export const CDE_QUEUE_CONFIGS: Record<string, QueueConfig> = {
  event_extraction_queue: {
    name: 'event_extraction_queue',
    concurrency: 3,
    maxRetries: 2,
    backoffMs: 5000,
    timeoutMs: 120_000, // 2 min per extraction job
    description: 'Extracts events from evidence documents (reports, transcripts, CAD logs)',
  },

  timeline_alignment_queue: {
    name: 'timeline_alignment_queue',
    concurrency: 2,
    maxRetries: 1,
    backoffMs: 3000,
    timeoutMs: 60_000, // 1 min per timeline merge
    description: 'Merges and aligns events into unified timelines with clock drift correction',
  },

  contradiction_analysis_queue: {
    name: 'contradiction_analysis_queue',
    concurrency: 2,
    maxRetries: 1,
    backoffMs: 5000,
    timeoutMs: 180_000, // 3 min per analysis
    description: 'Runs 7-rule contradiction detection pipeline on case events',
  },

  doctrine_analysis_queue: {
    name: 'doctrine_analysis_queue',
    concurrency: 2,
    maxRetries: 1,
    backoffMs: 3000,
    timeoutMs: 60_000, // 1 min per doctrine match batch
    description: 'Maps contradictions to POST Learning Domain doctrine rules',
  },
};

// ---------------------------------------------------------------------------
// Job Types
// ---------------------------------------------------------------------------

export interface QueueJob<T = unknown> {
  jobId: string;
  queueName: string;
  data: T;
  priority: number; // 1 = highest, 10 = lowest
  createdAt: string;
  attempts: number;
  maxRetries: number;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'retrying';
  result?: unknown;
  error?: string;
}

export interface ExtractionQueueJobData {
  caseId: string;
  evidenceId: string;
  evidenceType: 'report' | 'transcript' | 'cad_log' | 'video' | 'witness_statement';
  content: string;
}

export interface TimelineQueueJobData {
  caseId: string;
}

export interface ContradictionQueueJobData {
  caseId: string;
  batchSize?: number;
}

export interface DoctrineQueueJobData {
  caseId: string;
  contradictionIds: string[];
}

// ---------------------------------------------------------------------------
// In-Memory Queue Implementation (BullMQ-compatible interface)
// Production would use Redis-backed BullMQ.
// ---------------------------------------------------------------------------

type JobProcessor<T> = (job: QueueJob<T>) => Promise<unknown>;

export class InMemoryQueue<T = unknown> {
  private readonly config: QueueConfig;
  private readonly jobs: Map<string, QueueJob<T>> = new Map();
  private processor: JobProcessor<T> | null = null;
  private processing = false;

  constructor(config: QueueConfig) {
    this.config = config;
  }

  /** Register a job processor function. */
  process(fn: JobProcessor<T>): void {
    this.processor = fn;
  }

  /** Add a job to the queue. */
  async add(jobId: string, data: T, priority = 5): Promise<QueueJob<T>> {
    const job: QueueJob<T> = {
      jobId,
      queueName: this.config.name,
      data,
      priority,
      createdAt: new Date().toISOString(),
      attempts: 0,
      maxRetries: this.config.maxRetries,
      status: 'pending',
    };

    this.jobs.set(jobId, job);
    void this.processNext();
    return job;
  }

  /** Get queue status. */
  getStatus(): {
    name: string;
    pending: number;
    active: number;
    completed: number;
    failed: number;
    total: number;
  } {
    let pending = 0;
    let active = 0;
    let completed = 0;
    let failed = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case 'pending':
        case 'retrying':
          pending++;
          break;
        case 'active':
          active++;
          break;
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
      }
    }

    return {
      name: this.config.name,
      pending,
      active,
      completed,
      failed,
      total: this.jobs.size,
    };
  }

  /** Get a specific job by ID. */
  getJob(jobId: string): QueueJob<T> | undefined {
    return this.jobs.get(jobId);
  }

  /** Process next pending job. */
  private async processNext(): Promise<void> {
    if (this.processing || !this.processor) return;

    const pendingJobs = Array.from(this.jobs.values())
      .filter((j) => j.status === 'pending' || j.status === 'retrying')
      .sort((a, b) => a.priority - b.priority);

    if (pendingJobs.length === 0) return;

    const job = pendingJobs[0];
    this.processing = true;
    job.status = 'active';
    job.attempts++;

    try {
      const result = await Promise.race([
        this.processor(job),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Job timeout')), this.config.timeoutMs),
        ),
      ]);
      job.status = 'completed';
      job.result = result;
    } catch (err) {
      if (job.attempts < job.maxRetries) {
        job.status = 'retrying';
        job.error = err instanceof Error ? err.message : String(err);
        // Schedule retry after backoff
        setTimeout(() => void this.processNext(), this.config.backoffMs);
      } else {
        job.status = 'failed';
        job.error = err instanceof Error ? err.message : String(err);
      }
    } finally {
      this.processing = false;
      void this.processNext();
    }
  }
}

// ---------------------------------------------------------------------------
// Queue Factory
// ---------------------------------------------------------------------------

/**
 * Create all CDE pipeline queues.
 * Returns a map of queue name → queue instance.
 */
export function createCdeQueues(): {
  extractionQueue: InMemoryQueue<ExtractionQueueJobData>;
  timelineQueue: InMemoryQueue<TimelineQueueJobData>;
  contradictionQueue: InMemoryQueue<ContradictionQueueJobData>;
  doctrineQueue: InMemoryQueue<DoctrineQueueJobData>;
} {
  return {
    extractionQueue: new InMemoryQueue<ExtractionQueueJobData>(
      CDE_QUEUE_CONFIGS.event_extraction_queue,
    ),
    timelineQueue: new InMemoryQueue<TimelineQueueJobData>(
      CDE_QUEUE_CONFIGS.timeline_alignment_queue,
    ),
    contradictionQueue: new InMemoryQueue<ContradictionQueueJobData>(
      CDE_QUEUE_CONFIGS.contradiction_analysis_queue,
    ),
    doctrineQueue: new InMemoryQueue<DoctrineQueueJobData>(
      CDE_QUEUE_CONFIGS.doctrine_analysis_queue,
    ),
  };
}

// ---------------------------------------------------------------------------
// PM2 Ecosystem Configuration
// ---------------------------------------------------------------------------

/**
 * Generate PM2 ecosystem configuration for CDE workers.
 * Each queue gets its own isolated worker process.
 */
export const PM2_ECOSYSTEM_CONFIG = {
  apps: [
    {
      name: 'cde-extraction-worker',
      script: 'backend/src/contradiction/workers/extractionWorker.ts',
      instances: 1,
      max_memory_restart: '512M',
      env: {
        QUEUE_NAME: 'event_extraction_queue',
        NODE_ENV: 'production',
      },
    },
    {
      name: 'cde-timeline-worker',
      script: 'backend/src/contradiction/workers/timelineWorker.ts',
      instances: 1,
      max_memory_restart: '256M',
      env: {
        QUEUE_NAME: 'timeline_alignment_queue',
        NODE_ENV: 'production',
      },
    },
    {
      name: 'cde-contradiction-worker',
      script: 'backend/src/contradiction/workers/contradictionWorker.ts',
      instances: 1,
      max_memory_restart: '512M',
      env: {
        QUEUE_NAME: 'contradiction_analysis_queue',
        NODE_ENV: 'production',
      },
    },
    {
      name: 'cde-doctrine-worker',
      script: 'backend/src/contradiction/workers/doctrineWorker.ts',
      instances: 1,
      max_memory_restart: '256M',
      env: {
        QUEUE_NAME: 'doctrine_analysis_queue',
        NODE_ENV: 'production',
      },
    },
  ],
};
