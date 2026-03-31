// ============================================================================
// PR 2 — Backpressure Guard
// Prevents queue flooding by enforcing depth limits, memory pressure checks,
// and providing pause/resume controls for all pipeline workers.
// ============================================================================

import { getQueue, QUEUE_NAMES } from '../lib/queues.js';

// ---------------------------------------------------------------------------
// Configuration — Tuneable via environment variables
// ---------------------------------------------------------------------------

export interface BackpressureConfig {
  /** Maximum number of waiting jobs before rejecting new enqueues */
  maxQueueDepth: number;
  /** Maximum number of active jobs across all workers before pausing */
  maxActiveJobs: number;
  /** Memory usage threshold (fraction 0-1) to trigger backpressure */
  memoryThresholdPct: number;
  /** How often to check memory pressure (ms) */
  checkIntervalMs: number;
}

const DEFAULT_CONFIG: BackpressureConfig = {
  maxQueueDepth: parseInt(process.env.MAX_QUEUE_DEPTH || '500', 10),
  maxActiveJobs: parseInt(process.env.MAX_ACTIVE_JOBS || '10', 10),
  memoryThresholdPct: parseFloat(process.env.MEMORY_THRESHOLD_PCT || '0.85'),
  checkIntervalMs: parseInt(process.env.BACKPRESSURE_CHECK_MS || '10000', 10),
};

// ---------------------------------------------------------------------------
// Per-Queue Depth Limits (override the global default per queue)
// ---------------------------------------------------------------------------

const QUEUE_DEPTH_LIMITS: Record<string, number> = {
  [QUEUE_NAMES.EVIDENCE_INGEST]: parseInt(process.env.DEPTH_EVIDENCE_INGEST || '200', 10),
  [QUEUE_NAMES.TIMELINE_BUILD]: parseInt(process.env.DEPTH_TIMELINE_BUILD || '100', 10),
  [QUEUE_NAMES.NARRATIVE_PROCESSING]: parseInt(process.env.DEPTH_NARRATIVE || '100', 10),
  [QUEUE_NAMES.CONTRADICTION_ANALYSIS]: parseInt(process.env.DEPTH_CONTRADICTION || '100', 10),
  [QUEUE_NAMES.VIDEO_PROCESSING]: parseInt(process.env.DEPTH_VIDEO || '50', 10),
  [QUEUE_NAMES.DOCTRINE_ANALYSIS]: parseInt(process.env.DEPTH_DOCTRINE || '100', 10),
};

// ---------------------------------------------------------------------------
// Memory Pressure Detection
// ---------------------------------------------------------------------------

export interface MemorySnapshot {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  usagePct: number;
  underPressure: boolean;
}

export function getMemorySnapshot(thresholdPct: number = DEFAULT_CONFIG.memoryThresholdPct): MemorySnapshot {
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  const usagePct = mem.heapUsed / mem.heapTotal;
  return {
    heapUsedMB,
    heapTotalMB,
    rssMB,
    usagePct: Math.round(usagePct * 100) / 100,
    underPressure: usagePct >= thresholdPct,
  };
}

// ---------------------------------------------------------------------------
// Queue Depth Check
// ---------------------------------------------------------------------------

export interface QueueDepthResult {
  queueName: string;
  waiting: number;
  active: number;
  limit: number;
  overLimit: boolean;
}

/**
 * Check the depth of a specific queue against its configured limit.
 */
export async function checkQueueDepth(queueName: string): Promise<QueueDepthResult> {
  const queue = getQueue(queueName);
  const [waiting, active] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
  ]);
  const limit = QUEUE_DEPTH_LIMITS[queueName] ?? DEFAULT_CONFIG.maxQueueDepth;
  return {
    queueName,
    waiting,
    active,
    limit,
    overLimit: waiting >= limit,
  };
}

/**
 * Check all pipeline queue depths.
 */
export async function checkAllQueueDepths(): Promise<QueueDepthResult[]> {
  const queueNames = Object.values(QUEUE_NAMES);
  const results = await Promise.all(queueNames.map(checkQueueDepth));
  return results;
}

// ---------------------------------------------------------------------------
// Backpressure Decision — Should we accept or reject a new job?
// ---------------------------------------------------------------------------

export interface BackpressureDecision {
  accept: boolean;
  reason?: string;
  memorySnapshot: MemorySnapshot;
  queueDepth?: QueueDepthResult;
}

/**
 * Decide whether a new job should be accepted into the given queue.
 * Returns accept=false with a reason if backpressure is triggered.
 */
export async function shouldAcceptJob(queueName: string): Promise<BackpressureDecision> {
  const memorySnapshot = getMemorySnapshot();

  // Check 1: Memory pressure
  if (memorySnapshot.underPressure) {
    console.warn(
      `[BackpressureGuard] Memory pressure detected: ${memorySnapshot.heapUsedMB}MB / ${memorySnapshot.heapTotalMB}MB (${Math.round(memorySnapshot.usagePct * 100)}%)`,
    );
    return {
      accept: false,
      reason: `Memory pressure: ${Math.round(memorySnapshot.usagePct * 100)}% heap used (threshold: ${Math.round(DEFAULT_CONFIG.memoryThresholdPct * 100)}%)`,
      memorySnapshot,
    };
  }

  // Check 2: Queue depth
  const queueDepth = await checkQueueDepth(queueName);
  if (queueDepth.overLimit) {
    console.warn(
      `[BackpressureGuard] Queue ${queueName} over depth limit: ${queueDepth.waiting} waiting (limit: ${queueDepth.limit})`,
    );
    return {
      accept: false,
      reason: `Queue depth exceeded: ${queueDepth.waiting}/${queueDepth.limit} waiting jobs`,
      memorySnapshot,
      queueDepth,
    };
  }

  // Check 3: Total active jobs across all queues
  const allDepths = await checkAllQueueDepths();
  const totalActive = allDepths.reduce((sum, d) => sum + d.active, 0);
  if (totalActive >= DEFAULT_CONFIG.maxActiveJobs) {
    return {
      accept: false,
      reason: `Too many active jobs: ${totalActive}/${DEFAULT_CONFIG.maxActiveJobs}`,
      memorySnapshot,
      queueDepth,
    };
  }

  return { accept: true, memorySnapshot, queueDepth };
}

// ---------------------------------------------------------------------------
// Guarded Enqueue — Wraps queue.add() with backpressure checks
// ---------------------------------------------------------------------------

/**
 * Enqueue a job with backpressure protection.
 * Throws if the queue is over its depth limit or memory pressure is detected.
 */
export async function guardedEnqueue(
  queueName: string,
  jobName: string,
  data: Record<string, unknown>,
  opts?: { priority?: number; delay?: number },
): Promise<{ jobId: string; backpressure: BackpressureDecision }> {
  const decision = await shouldAcceptJob(queueName);

  if (!decision.accept) {
    throw new BackpressureError(
      `Job rejected by backpressure guard: ${decision.reason}`,
      queueName,
      decision,
    );
  }

  const queue = getQueue(queueName);
  const job = await queue.add(jobName, data as never, {
    priority: opts?.priority,
    delay: opts?.delay,
  });

  return {
    jobId: job.id ?? 'unknown',
    backpressure: decision,
  };
}

// ---------------------------------------------------------------------------
// Custom Error
// ---------------------------------------------------------------------------

export class BackpressureError extends Error {
  public readonly queueName: string;
  public readonly decision: BackpressureDecision;

  constructor(message: string, queueName: string, decision: BackpressureDecision) {
    super(message);
    this.name = 'BackpressureError';
    this.queueName = queueName;
    this.decision = decision;
  }
}

// ---------------------------------------------------------------------------
// Periodic Health Monitor (optional — start during server boot)
// ---------------------------------------------------------------------------

let monitorInterval: ReturnType<typeof setInterval> | null = null;

export function startBackpressureMonitor(): void {
  if (monitorInterval) return;

  monitorInterval = setInterval(async () => {
    try {
      const mem = getMemorySnapshot();
      const depths = await checkAllQueueDepths();
      const overLimit = depths.filter((d) => d.overLimit);
      const totalWaiting = depths.reduce((sum, d) => sum + d.waiting, 0);
      const totalActive = depths.reduce((sum, d) => sum + d.active, 0);

      if (mem.underPressure || overLimit.length > 0) {
        console.warn(
          `[BackpressureGuard] Health check — Memory: ${mem.heapUsedMB}MB/${mem.heapTotalMB}MB (${Math.round(mem.usagePct * 100)}%), ` +
          `Queues: ${totalWaiting} waiting, ${totalActive} active, ${overLimit.length} over limit`,
        );
      }
    } catch (err) {
      // Swallow errors in the monitor — it's informational only
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[BackpressureGuard] Monitor error: ${msg}`);
    }
  }, DEFAULT_CONFIG.checkIntervalMs);

  console.log(`[BackpressureGuard] Monitor started (interval: ${DEFAULT_CONFIG.checkIntervalMs}ms)`);
}

export function stopBackpressureMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('[BackpressureGuard] Monitor stopped');
  }
}

// ---------------------------------------------------------------------------
// Dead Letter Queue (DLQ) — Move permanently failed jobs for inspection
// ---------------------------------------------------------------------------

export const DLQ_QUEUE_NAME = 'court-access-dead-letter';

/**
 * Move a permanently failed job to the dead letter queue.
 * Called by the base worker when all retries are exhausted.
 */
export async function moveToDeadLetter(
  originalQueue: string,
  jobId: string,
  jobData: Record<string, unknown>,
  error: string,
  attemptsMade: number,
): Promise<void> {
  try {
    const dlq = getQueue(DLQ_QUEUE_NAME);
    const snapshot = {
      originalQueue,
      originalJobId: jobId,
      jobData,
      error,
      attemptsMade,
      movedAt: new Date().toISOString(),
      memoryAtFailure: getMemorySnapshot(),
    };

    await dlq.add('dead-letter', snapshot as never);

    // DLQ Snapshot Logging — capture full payload for post-mortem debugging
    console.error(
      `[DLQ] SNAPSHOT — Job ${jobId} from ${originalQueue} permanently failed.\n` +
      `  Attempts: ${attemptsMade}\n` +
      `  Error: ${error.slice(0, 500)}\n` +
      `  UserId: ${jobData.userId ?? 'unknown'}\n` +
      `  CaseId: ${jobData.caseId ?? 'unknown'}\n` +
      `  TenantId: ${jobData.tenantId ?? 'unknown'}\n` +
      `  Memory: heap=${snapshot.memoryAtFailure.heapUsedMB}MB/${snapshot.memoryAtFailure.heapTotalMB}MB rss=${snapshot.memoryAtFailure.rssMB}MB\n` +
      `  Timestamp: ${snapshot.movedAt}`,
    );
  } catch (dlqError) {
    const msg = dlqError instanceof Error ? dlqError.message : String(dlqError);
    console.error(`[DLQ] Failed to move job ${jobId} to DLQ: ${msg}`);
  }
}
