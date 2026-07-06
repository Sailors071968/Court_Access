// ============================================
// Court Access — Queue Monitoring Dashboard (Wave 0 Stabilization)
// Provides /admin/queues endpoint for BullMQ-style queue visibility.
// Displays: queue size, failed jobs, retry count, job duration.
// ============================================

import { getAllWorkerStatuses, type WorkerStatusReport } from './registry';

// ---------------------------------------------------------------------------
// Queue Metrics Types
// ---------------------------------------------------------------------------

export interface QueueMetrics {
  name: string;
  /** Number of jobs currently being processed */
  active: number;
  /** Number of jobs waiting to be processed */
  waiting: number;
  /** Total jobs successfully completed since last restart */
  completed: number;
  /** Total jobs that failed since last restart */
  failed: number;
  /** Number of jobs currently in retry backoff */
  retrying: number;
  /** Average job duration in milliseconds (rolling window) */
  avgDurationMs: number;
  /** Maximum concurrency allowed */
  maxConcurrency: number;
  /** Whether the worker is currently accepting jobs */
  enabled: boolean;
  /** Worker status */
  status: 'idle' | 'running' | 'paused' | 'error';
  /** Timestamp of last heartbeat */
  lastHeartbeat: number | null;
}

export interface QueueDashboardData {
  timestamp: string;
  totalActiveJobs: number;
  totalFailedJobs: number;
  totalCompletedJobs: number;
  queues: QueueMetrics[];
  systemLoad: {
    totalWorkers: number;
    activeWorkers: number;
    pausedWorkers: number;
    errorWorkers: number;
  };
}

// ---------------------------------------------------------------------------
// Job Duration Tracking (rolling window)
// ---------------------------------------------------------------------------

const jobDurations: Map<string, number[]> = new Map();
const MAX_DURATION_SAMPLES = 100;

/**
 * Record a job's duration for rolling average computation.
 */
export function recordJobDuration(workerName: string, durationMs: number): void {
  let durations = jobDurations.get(workerName);
  if (!durations) {
    durations = [];
    jobDurations.set(workerName, durations);
  }
  durations.push(durationMs);
  if (durations.length > MAX_DURATION_SAMPLES) {
    durations.shift();
  }
}

function getAverageDuration(workerName: string): number {
  const durations = jobDurations.get(workerName);
  if (!durations || durations.length === 0) {
    return 0;
  }
  const sum = durations.reduce((a, b) => a + b, 0);
  return Math.round(sum / durations.length);
}

// ---------------------------------------------------------------------------
// Waiting Queue Simulation
// In production, this would query BullMQ/Redis. For now, we track locally.
// ---------------------------------------------------------------------------

const waitingCounts: Map<string, number> = new Map();
const retryingCounts: Map<string, number> = new Map();

/**
 * Increment the waiting count for a worker queue.
 */
export function enqueueJob(workerName: string): void {
  const current = waitingCounts.get(workerName) ?? 0;
  waitingCounts.set(workerName, current + 1);
}

/**
 * Decrement the waiting count when a job is picked up.
 */
export function dequeueJob(workerName: string): void {
  const current = waitingCounts.get(workerName) ?? 0;
  waitingCounts.set(workerName, Math.max(0, current - 1));
}

/**
 * Increment retry count for a worker.
 */
export function markRetrying(workerName: string): void {
  const current = retryingCounts.get(workerName) ?? 0;
  retryingCounts.set(workerName, current + 1);
}

/**
 * Decrement retry count when retry completes.
 */
export function clearRetry(workerName: string): void {
  const current = retryingCounts.get(workerName) ?? 0;
  retryingCounts.set(workerName, Math.max(0, current - 1));
}

// ---------------------------------------------------------------------------
// Dashboard Data Assembly
// ---------------------------------------------------------------------------

/**
 * Build the full queue monitoring dashboard payload.
 * Intended to be served at /admin/queues as JSON.
 */
export function getQueueDashboardData(): QueueDashboardData {
  const statuses: WorkerStatusReport[] = getAllWorkerStatuses();

  let totalActive = 0;
  let totalFailed = 0;
  let totalCompleted = 0;
  let activeWorkers = 0;
  let pausedWorkers = 0;
  let errorWorkers = 0;

  const queues: QueueMetrics[] = statuses.map((report) => {
    const waiting = waitingCounts.get(report.name) ?? 0;
    const retrying = retryingCounts.get(report.name) ?? 0;
    const avgDurationMs = getAverageDuration(report.name);

    totalActive += report.state.activeJobs;
    totalFailed += report.state.totalFailed;
    totalCompleted += report.state.totalProcessed - report.state.totalFailed;

    if (report.state.status === 'running') activeWorkers++;
    if (report.state.status === 'paused') pausedWorkers++;
    if (report.state.status === 'error') errorWorkers++;

    return {
      name: report.name,
      active: report.state.activeJobs,
      waiting,
      completed: report.state.totalProcessed - report.state.totalFailed,
      failed: report.state.totalFailed,
      retrying,
      avgDurationMs,
      maxConcurrency: report.config.concurrency,
      enabled: report.config.enabled,
      status: report.state.status,
      lastHeartbeat: report.state.lastHeartbeat,
    };
  });

  return {
    timestamp: new Date().toISOString(),
    totalActiveJobs: totalActive,
    totalFailedJobs: totalFailed,
    totalCompletedJobs: totalCompleted,
    queues,
    systemLoad: {
      totalWorkers: statuses.length,
      activeWorkers,
      pausedWorkers,
      errorWorkers,
    },
  };
}

// ---------------------------------------------------------------------------
// Alert Thresholds
// ---------------------------------------------------------------------------

export interface QueueAlert {
  workerName: string;
  alertType: 'high_failure_rate' | 'queue_backlog' | 'worker_stalled' | 'concurrency_saturated';
  message: string;
  severity: 'warning' | 'critical';
  timestamp: string;
}

/**
 * Check all queues for alert conditions.
 * Returns a list of active alerts that should be surfaced to operators.
 */
export function checkQueueAlerts(): QueueAlert[] {
  const alerts: QueueAlert[] = [];
  const statuses = getAllWorkerStatuses();
  const now = new Date().toISOString();

  for (const report of statuses) {
    const { name, state, config } = report;

    // High failure rate: >20% of processed jobs failed
    if (state.totalProcessed > 10 && state.totalFailed / state.totalProcessed > 0.2) {
      alerts.push({
        workerName: name,
        alertType: 'high_failure_rate',
        message: `Worker "${name}" has ${state.totalFailed}/${state.totalProcessed} failed jobs (${Math.round(state.totalFailed / state.totalProcessed * 100)}%)`,
        severity: 'critical',
        timestamp: now,
      });
    }

    // Queue backlog: waiting > 3x concurrency
    const waiting = waitingCounts.get(name) ?? 0;
    if (waiting > config.concurrency * 3) {
      alerts.push({
        workerName: name,
        alertType: 'queue_backlog',
        message: `Worker "${name}" has ${waiting} jobs waiting (concurrency limit: ${config.concurrency})`,
        severity: 'warning',
        timestamp: now,
      });
    }

    // Concurrency saturated: all slots full
    if (state.activeJobs >= config.concurrency && config.enabled) {
      alerts.push({
        workerName: name,
        alertType: 'concurrency_saturated',
        message: `Worker "${name}" is at full capacity: ${state.activeJobs}/${config.concurrency} slots used`,
        severity: 'warning',
        timestamp: now,
      });
    }

    // Stalled worker: running status but no heartbeat in 5 minutes
    if (state.status === 'running' && state.lastHeartbeat !== null) {
      const stalledThresholdMs = 5 * 60 * 1000;
      if (Date.now() - state.lastHeartbeat > stalledThresholdMs) {
        alerts.push({
          workerName: name,
          alertType: 'worker_stalled',
          message: `Worker "${name}" has not sent a heartbeat in over 5 minutes`,
          severity: 'critical',
          timestamp: now,
        });
      }
    }
  }

  return alerts;
}
