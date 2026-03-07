// ============================================
// Court Access — Cron Scheduler (Wave 0 Stabilization)
// Centralized scheduling configuration for all monitoring workers.
// Defines intervals and manages scheduled job lifecycle.
// ============================================

// ---------------------------------------------------------------------------
// Schedule Configuration
// ---------------------------------------------------------------------------

export interface ScheduledJob {
  name: string;
  description: string;
  intervalMs: number;
  enabled: boolean;
  lastRun: number | null;
  nextRun: number | null;
  runCount: number;
  errorCount: number;
  status: 'idle' | 'running' | 'error' | 'disabled';
}

/**
 * Cron schedule definitions for all monitoring workers.
 * These match the PM2 ecosystem.config.cjs intervals.
 */
export const CRON_SCHEDULES = {
  queueMonitor: {
    name: 'Queue Monitor',
    description: 'Collects queue metrics (active, waiting, failed, retrying jobs)',
    intervalMs: 30_000, // every 30 seconds
    pm2Process: 'queueMonitor',
  },
  graphIntegrityCheck: {
    name: 'Graph Integrity Check',
    description: 'Validates Neo4j graph consistency (orphan nodes, duplicates, cross-tenant edges)',
    intervalMs: 900_000, // every 15 minutes
    pm2Process: 'graphIntegrityCheck',
  },
  systemHealth: {
    name: 'System Health Reporter',
    description: 'Aggregates worker status, queue sizes, database latency, memory usage',
    intervalMs: 60_000, // every 60 seconds
    pm2Process: 'systemHealth',
  },
} as const;

// ---------------------------------------------------------------------------
// Scheduler State (module-scoped singleton)
// ---------------------------------------------------------------------------

const scheduledJobs = new Map<string, ScheduledJob>();
const activeTimers = new Map<string, ReturnType<typeof setInterval>>();

/**
 * Initialize a scheduled job in the registry.
 */
export function registerJob(
  key: string,
  config: { name: string; description: string; intervalMs: number },
): ScheduledJob {
  const job: ScheduledJob = {
    name: config.name,
    description: config.description,
    intervalMs: config.intervalMs,
    enabled: true,
    lastRun: null,
    nextRun: Date.now() + config.intervalMs,
    runCount: 0,
    errorCount: 0,
    status: 'idle',
  };
  scheduledJobs.set(key, job);
  return job;
}

/**
 * Start a scheduled job with a callback.
 * The callback is invoked at the configured interval.
 */
export function startJob(
  key: string,
  callback: () => Promise<void>,
): boolean {
  const job = scheduledJobs.get(key);
  if (!job || !job.enabled) return false;
  if (activeTimers.has(key)) return false; // already running

  const wrappedCallback = async () => {
    if (!job.enabled) return;
    job.status = 'running';
    job.lastRun = Date.now();
    try {
      await callback();
      job.runCount++;
      job.status = 'idle';
    } catch {
      job.errorCount++;
      job.status = 'error';
    }
    job.nextRun = Date.now() + job.intervalMs;
  };

  // Run immediately, then schedule
  wrappedCallback();
  const timer = setInterval(wrappedCallback, job.intervalMs);
  activeTimers.set(key, timer);
  return true;
}

/**
 * Stop a scheduled job.
 */
export function stopJob(key: string): boolean {
  const timer = activeTimers.get(key);
  if (!timer) return false;
  clearInterval(timer);
  activeTimers.delete(key);
  const job = scheduledJobs.get(key);
  if (job) {
    job.status = 'disabled';
    job.enabled = false;
    job.nextRun = null;
  }
  return true;
}

/**
 * Get the status of all scheduled jobs.
 */
export function getAllJobStatuses(): ScheduledJob[] {
  return Array.from(scheduledJobs.values());
}

/**
 * Get a specific job status.
 */
export function getJobStatus(key: string): ScheduledJob | undefined {
  return scheduledJobs.get(key);
}

/**
 * Stop all scheduled jobs (for graceful shutdown).
 */
export function stopAllJobs(): void {
  for (const [key, timer] of activeTimers.entries()) {
    clearInterval(timer);
    const job = scheduledJobs.get(key);
    if (job) {
      job.status = 'disabled';
      job.enabled = false;
      job.nextRun = null;
    }
    activeTimers.delete(key);
  }
}
