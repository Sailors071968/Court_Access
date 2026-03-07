// ============================================
// Court Access — Worker Queue Registry (Wave 0 Stabilization)
// Centralized concurrency limits for all async workers.
// All workers MUST reference this registry before spawning jobs.
// ============================================

export interface WorkerConfig {
  /** Maximum concurrent jobs for this worker */
  concurrency: number;
  /** Maximum retries before marking a job as permanently failed */
  maxRetries: number;
  /** Backoff delay in milliseconds between retries */
  retryBackoffMs: number;
  /** Maximum job duration in milliseconds before timeout */
  timeoutMs: number;
  /** Whether this worker is currently enabled */
  enabled: boolean;
}

/**
 * Centralized worker configuration registry.
 * Every asynchronous worker in the system must reference this config
 * to enforce concurrency limits and prevent resource exhaustion.
 *
 * Modification rules (Schema Freeze):
 * - Do NOT add new workers without stabilization review
 * - Do NOT increase concurrency limits without load testing
 * - Changes require approval from system architect
 */
export const WORKER_CONFIG: Record<string, WorkerConfig> = {
  evidenceIngest: {
    concurrency: 2,
    maxRetries: 3,
    retryBackoffMs: 5000,
    timeoutMs: 120_000,
    enabled: true,
  },
  factExtraction: {
    concurrency: 3,
    maxRetries: 3,
    retryBackoffMs: 3000,
    timeoutMs: 90_000,
    enabled: true,
  },
  aiAnalysis: {
    concurrency: 1,
    maxRetries: 2,
    retryBackoffMs: 10_000,
    timeoutMs: 180_000,
    enabled: true,
  },
  transcription: {
    concurrency: 2,
    maxRetries: 3,
    retryBackoffMs: 5000,
    timeoutMs: 300_000,
    enabled: true,
  },
  timelineBuild: {
    concurrency: 2,
    maxRetries: 2,
    retryBackoffMs: 5000,
    timeoutMs: 60_000,
    enabled: true,
  },
  documentIntegrity: {
    concurrency: 2,
    maxRetries: 3,
    retryBackoffMs: 3000,
    timeoutMs: 60_000,
    enabled: true,
  },
  graphSync: {
    concurrency: 1,
    maxRetries: 3,
    retryBackoffMs: 10_000,
    timeoutMs: 120_000,
    enabled: true,
  },
  anchorChain: {
    concurrency: 1,
    maxRetries: 5,
    retryBackoffMs: 15_000,
    timeoutMs: 60_000,
    enabled: true,
  },
  exportGeneration: {
    concurrency: 2,
    maxRetries: 2,
    retryBackoffMs: 5000,
    timeoutMs: 300_000,
    enabled: true,
  },
  nightlyIntegrity: {
    concurrency: 1,
    maxRetries: 1,
    retryBackoffMs: 60_000,
    timeoutMs: 600_000,
    enabled: true,
  },
};

// ---------------------------------------------------------------------------
// Worker State Tracking
// ---------------------------------------------------------------------------

interface WorkerState {
  activeJobs: number;
  totalProcessed: number;
  totalFailed: number;
  lastHeartbeat: number | null;
  status: 'idle' | 'running' | 'paused' | 'error';
}

const workerStates: Map<string, WorkerState> = new Map();

/** Initialize state tracking for all registered workers */
function initializeWorkerStates(): void {
  for (const workerName of Object.keys(WORKER_CONFIG)) {
    workerStates.set(workerName, {
      activeJobs: 0,
      totalProcessed: 0,
      totalFailed: 0,
      lastHeartbeat: null,
      status: 'idle',
    });
  }
}

initializeWorkerStates();

// ---------------------------------------------------------------------------
// Concurrency Guard
// ---------------------------------------------------------------------------

/**
 * Check whether a worker can accept a new job based on its concurrency limit.
 * Returns true if the worker has capacity, false otherwise.
 */
export function canAcceptJob(workerName: string): boolean {
  const config = WORKER_CONFIG[workerName];
  if (!config) {
    throw new Error(`[WorkerRegistry] Unknown worker: "${workerName}". Register it in WORKER_CONFIG first.`);
  }
  if (!config.enabled) {
    return false;
  }
  const state = workerStates.get(workerName);
  if (!state) {
    return false;
  }
  return state.activeJobs < config.concurrency;
}

/**
 * Acquire a job slot for a worker. Returns true if acquired, false if at capacity.
 * Must call releaseJob() when the job completes or fails.
 */
export function acquireJob(workerName: string): boolean {
  if (!canAcceptJob(workerName)) {
    return false;
  }
  const state = workerStates.get(workerName);
  if (!state) {
    return false;
  }
  state.activeJobs += 1;
  state.status = 'running';
  state.lastHeartbeat = Date.now();
  return true;
}

/**
 * Release a job slot after completion or failure.
 */
export function releaseJob(workerName: string, failed: boolean = false): void {
  const state = workerStates.get(workerName);
  if (!state) {
    throw new Error(`[WorkerRegistry] Unknown worker: "${workerName}".`);
  }
  state.activeJobs = Math.max(0, state.activeJobs - 1);
  state.totalProcessed += 1;
  if (failed) {
    state.totalFailed += 1;
  }
  state.lastHeartbeat = Date.now();
  if (state.activeJobs === 0) {
    state.status = 'idle';
  }
}

// ---------------------------------------------------------------------------
// Status Reporting
// ---------------------------------------------------------------------------

export interface WorkerStatusReport {
  name: string;
  config: WorkerConfig;
  state: WorkerState;
}

/**
 * Get the current status of all registered workers.
 * Used by the System Health endpoint and Queue Monitoring dashboard.
 */
export function getAllWorkerStatuses(): WorkerStatusReport[] {
  const reports: WorkerStatusReport[] = [];
  for (const [name, config] of Object.entries(WORKER_CONFIG)) {
    const state = workerStates.get(name);
    if (state) {
      reports.push({ name, config, state });
    }
  }
  return reports;
}

/**
 * Get status for a single worker by name.
 */
export function getWorkerStatus(workerName: string): WorkerStatusReport | null {
  const config = WORKER_CONFIG[workerName];
  const state = workerStates.get(workerName);
  if (!config || !state) {
    return null;
  }
  return { name: workerName, config, state };
}

/**
 * Pause a worker (prevents new jobs from being accepted).
 */
export function pauseWorker(workerName: string): void {
  const config = WORKER_CONFIG[workerName];
  if (!config) {
    throw new Error(`[WorkerRegistry] Unknown worker: "${workerName}".`);
  }
  config.enabled = false;
  const state = workerStates.get(workerName);
  if (state) {
    state.status = 'paused';
  }
}

/**
 * Resume a paused worker.
 */
export function resumeWorker(workerName: string): void {
  const config = WORKER_CONFIG[workerName];
  if (!config) {
    throw new Error(`[WorkerRegistry] Unknown worker: "${workerName}".`);
  }
  config.enabled = true;
  const state = workerStates.get(workerName);
  if (state && state.status === 'paused') {
    state.status = state.activeJobs > 0 ? 'running' : 'idle';
  }
}
