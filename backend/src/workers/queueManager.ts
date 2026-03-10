// ============================================================================
// Phase 54 — Centralized Worker Queue Governance
// Single source of truth for all BullMQ queue configurations.
// All workers MUST use this manager to create queues and workers.
// ============================================================================

import { Queue, Worker, Job, QueueEvents } from 'bullmq';

// ---------------------------------------------------------------------------
// Queue Configuration Registry
// ---------------------------------------------------------------------------

export interface QueueConfig {
  name: string;
  concurrency: number;
  maxRetries: number;
  retryBackoffMs: number;
  timeoutMs: number;
  rateLimitMax?: number;
  rateLimitDuration?: number;
  enabled: boolean;
  description: string;
}

export const QUEUE_CONFIGS: Record<string, QueueConfig> = {
  agencyCrawler: {
    name: 'agency-crawler-queue',
    concurrency: 2,
    maxRetries: 3,
    retryBackoffMs: 10_000,
    timeoutMs: 300_000, // 5 minutes per crawl
    rateLimitMax: 2,
    rateLimitDuration: 1000,
    enabled: true,
    description: 'Crawls agency websites to discover policy pages and documents',
  },
  policyDiscovery: {
    name: 'policy-discovery-queue',
    concurrency: 2,
    maxRetries: 3,
    retryBackoffMs: 5_000,
    timeoutMs: 180_000,
    rateLimitMax: 2,
    rateLimitDuration: 1000,
    enabled: true,
    description: 'Discovers policy documents from crawled agency pages',
  },
  download: {
    name: 'policy-document-download-queue',
    concurrency: 3,
    maxRetries: 3,
    retryBackoffMs: 5_000,
    timeoutMs: 120_000,
    rateLimitMax: 5,
    rateLimitDuration: 1000,
    enabled: true,
    description: 'Downloads policy documents and uploads to S3',
  },
  ocr: {
    name: 'policy-ocr-queue',
    concurrency: 3,
    maxRetries: 2,
    retryBackoffMs: 10_000,
    timeoutMs: 180_000,
    enabled: true,
    description: 'Extracts text from policy documents using OCR',
  },
  classification: {
    name: 'policy-classification-queue',
    concurrency: 2,
    maxRetries: 2,
    retryBackoffMs: 3_000,
    timeoutMs: 60_000,
    enabled: true,
    description: 'Classifies policy documents by type using NLP',
  },
  cpraCampaign: {
    name: 'cpra-campaign-queue',
    concurrency: 1,
    maxRetries: 3,
    retryBackoffMs: 30_000,
    timeoutMs: 120_000,
    rateLimitMax: 5,
    rateLimitDuration: 60_000, // 5 per minute
    enabled: true,
    description: 'Sends CPRA request emails to agencies',
  },
  annualUpdate: {
    name: 'cpra-annual-update-queue',
    concurrency: 1,
    maxRetries: 3,
    retryBackoffMs: 30_000,
    timeoutMs: 120_000,
    rateLimitMax: 5,
    rateLimitDuration: 60_000,
    enabled: true,
    description: 'Processes annual CPRA update requests',
  },
};

// ---------------------------------------------------------------------------
// Connection Configuration
// ---------------------------------------------------------------------------

function getRedisConnection(): { host: string; port: number } | { url: string } {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    return { url: redisUrl };
  }
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  };
}

// ---------------------------------------------------------------------------
// Queue Factory
// ---------------------------------------------------------------------------

const activeQueues = new Map<string, Queue>();
const activeWorkers = new Map<string, Worker>();

/**
 * Get or create a BullMQ queue for the given config key.
 */
export function getQueue<T = unknown>(configKey: string): Queue<T> {
  const config = QUEUE_CONFIGS[configKey];
  if (!config) {
    throw new Error(`[QueueManager] Unknown queue: "${configKey}". Register it in QUEUE_CONFIGS.`);
  }
  if (!config.enabled) {
    throw new Error(`[QueueManager] Queue "${configKey}" is disabled.`);
  }

  const existing = activeQueues.get(configKey);
  if (existing) {
    return existing as Queue<T>;
  }

  const queue = new Queue<T>(config.name, {
    connection: getRedisConnection() as { host: string; port: number },
    defaultJobOptions: {
      attempts: config.maxRetries,
      backoff: {
        type: 'exponential',
        delay: config.retryBackoffMs,
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

  activeQueues.set(configKey, queue as Queue);
  return queue;
}

/**
 * Create a BullMQ worker for the given config key.
 */
export function createManagedWorker<T = unknown>(
  configKey: string,
  processor: (job: Job<T>) => Promise<unknown>,
): Worker<T> {
  const config = QUEUE_CONFIGS[configKey];
  if (!config) {
    throw new Error(`[QueueManager] Unknown queue: "${configKey}". Register it in QUEUE_CONFIGS.`);
  }

  if (activeWorkers.has(configKey)) {
    throw new Error(`[QueueManager] Worker for "${configKey}" already exists. Call stopWorker() first.`);
  }

  const workerOpts: Record<string, unknown> = {
    connection: getRedisConnection(),
    concurrency: config.concurrency,
  };

  if (config.rateLimitMax && config.rateLimitDuration) {
    workerOpts.limiter = {
      max: config.rateLimitMax,
      duration: config.rateLimitDuration,
    };
  }

  const worker = new Worker<T>(
    config.name,
    processor,
    workerOpts as Parameters<typeof Worker<T>>[2],
  );

  worker.on('completed', (job) => {
    globalMonitor.recordCompletion(configKey, job.id ?? 'unknown');
  });

  worker.on('failed', (job, error) => {
    globalMonitor.recordFailure(configKey, job?.id ?? 'unknown', error.message);
  });

  activeWorkers.set(configKey, worker as Worker);
  console.log(
    `[QueueManager] Worker started: ${configKey} (concurrency: ${config.concurrency})`
  );

  return worker;
}

/**
 * Stop a specific worker.
 */
export async function stopWorker(configKey: string): Promise<void> {
  const worker = activeWorkers.get(configKey);
  if (worker) {
    await worker.close();
    activeWorkers.delete(configKey);
    console.log(`[QueueManager] Worker stopped: ${configKey}`);
  }
}

/**
 * Stop all workers and close all queues.
 */
export async function shutdownAll(): Promise<void> {
  console.log('[QueueManager] Shutting down all workers and queues...');

  const workerCloses = Array.from(activeWorkers.entries()).map(async ([key, worker]) => {
    await worker.close();
    console.log(`[QueueManager] Worker stopped: ${key}`);
  });
  await Promise.all(workerCloses);
  activeWorkers.clear();

  const queueCloses = Array.from(activeQueues.entries()).map(async ([key, queue]) => {
    await queue.close();
    console.log(`[QueueManager] Queue closed: ${key}`);
  });
  await Promise.all(queueCloses);
  activeQueues.clear();

  console.log('[QueueManager] Shutdown complete.');
}

// ---------------------------------------------------------------------------
// Global Queue Monitor
// ---------------------------------------------------------------------------

export interface QueueMetrics {
  configKey: string;
  queueName: string;
  description: string;
  concurrency: number;
  enabled: boolean;
  completedJobs: number;
  failedJobs: number;
  lastCompletedAt: number | null;
  lastFailedAt: number | null;
  lastError: string | null;
}

class GlobalQueueMonitor {
  private metrics = new Map<string, {
    completedJobs: number;
    failedJobs: number;
    lastCompletedAt: number | null;
    lastFailedAt: number | null;
    lastError: string | null;
  }>();

  constructor() {
    for (const key of Object.keys(QUEUE_CONFIGS)) {
      this.metrics.set(key, {
        completedJobs: 0,
        failedJobs: 0,
        lastCompletedAt: null,
        lastFailedAt: null,
        lastError: null,
      });
    }
  }

  recordCompletion(configKey: string, jobId: string): void {
    const m = this.metrics.get(configKey);
    if (m) {
      m.completedJobs++;
      m.lastCompletedAt = Date.now();
    }
  }

  recordFailure(configKey: string, jobId: string, error: string): void {
    const m = this.metrics.get(configKey);
    if (m) {
      m.failedJobs++;
      m.lastFailedAt = Date.now();
      m.lastError = error;
    }
  }

  getAllMetrics(): QueueMetrics[] {
    const result: QueueMetrics[] = [];
    for (const [key, config] of Object.entries(QUEUE_CONFIGS)) {
      const m = this.metrics.get(key) ?? {
        completedJobs: 0,
        failedJobs: 0,
        lastCompletedAt: null,
        lastFailedAt: null,
        lastError: null,
      };
      result.push({
        configKey: key,
        queueName: config.name,
        description: config.description,
        concurrency: config.concurrency,
        enabled: config.enabled,
        ...m,
      });
    }
    return result;
  }

  getMetrics(configKey: string): QueueMetrics | null {
    const config = QUEUE_CONFIGS[configKey];
    const m = this.metrics.get(configKey);
    if (!config || !m) return null;
    return {
      configKey,
      queueName: config.name,
      description: config.description,
      concurrency: config.concurrency,
      enabled: config.enabled,
      ...m,
    };
  }
}

export const globalMonitor = new GlobalQueueMonitor();

// Graceful shutdown handlers
process.on('SIGINT', () => { shutdownAll(); });
process.on('SIGTERM', () => { shutdownAll(); });
