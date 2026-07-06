// ============================================
// Court Access — Worker Circuit Breakers (Wave 1 Stabilization)
// Protects the system from runaway jobs by enforcing rate limits,
// concurrency caps, and backlog thresholds.
//
// Protections:
//   - Max AI analysis jobs per minute
//   - Max transcription concurrency
//   - Queue pause when backlog threshold exceeded
//
// When a circuit breaker trips:
//   1. Pause the affected queue
//   2. Log the event
//   3. Alert the systemHealth worker
// ============================================

import { pauseWorker, resumeWorker } from './registry';

// ---------------------------------------------------------------------------
// Circuit Breaker Configuration
// ---------------------------------------------------------------------------

export interface CircuitBreakerConfig {
  /** Worker name this breaker protects */
  workerName: string;
  /** Maximum operations allowed in the rate window */
  maxOpsPerWindow: number;
  /** Rate window duration in milliseconds */
  windowMs: number;
  /** Maximum concurrent operations before tripping */
  maxConcurrency: number;
  /** Backlog queue size that triggers a pause */
  backlogThreshold: number;
  /** Cooldown period in milliseconds after tripping before auto-reset */
  cooldownMs: number;
  /** Whether this circuit breaker is enabled */
  enabled: boolean;
}

export type BreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerStatus {
  workerName: string;
  state: BreakerState;
  /** Number of operations in the current rate window */
  opsInWindow: number;
  /** Current concurrent operations */
  currentConcurrency: number;
  /** Current backlog size */
  currentBacklog: number;
  /** Reason the breaker tripped (null if closed) */
  tripReason: string | null;
  /** Timestamp when the breaker last tripped */
  lastTripped: number | null;
  /** Timestamp when the breaker will auto-reset (null if not tripped) */
  resetAt: number | null;
  /** Total number of times this breaker has tripped */
  totalTrips: number;
  /** Whether the breaker is enabled */
  enabled: boolean;
}

export interface BreakerEvent {
  timestamp: number;
  workerName: string;
  eventType: 'trip' | 'reset' | 'half-open' | 'manual-reset';
  reason: string;
  metrics: {
    opsInWindow: number;
    concurrency: number;
    backlog: number;
  };
}

// ---------------------------------------------------------------------------
// Default Circuit Breaker Configurations
// ---------------------------------------------------------------------------

/**
 * Circuit breaker configurations for all protected workers.
 * These are intentionally conservative defaults for Phase 1.
 * Tune after load testing in production.
 */
export const CIRCUIT_BREAKER_CONFIGS: Record<string, CircuitBreakerConfig> = {
  aiAnalysis: {
    workerName: 'aiAnalysis',
    maxOpsPerWindow: 30,
    windowMs: 60_000, // 30 ops per minute
    maxConcurrency: 1,
    backlogThreshold: 10,
    cooldownMs: 120_000, // 2 minute cooldown
    enabled: true,
  },
  transcription: {
    workerName: 'transcription',
    maxOpsPerWindow: 20,
    windowMs: 60_000, // 20 ops per minute
    maxConcurrency: 2,
    backlogThreshold: 15,
    cooldownMs: 90_000, // 90 second cooldown
    enabled: true,
  },
  evidenceIngest: {
    workerName: 'evidenceIngest',
    maxOpsPerWindow: 60,
    windowMs: 60_000, // 60 ops per minute
    maxConcurrency: 2,
    backlogThreshold: 25,
    cooldownMs: 60_000, // 60 second cooldown
    enabled: true,
  },
  factExtraction: {
    workerName: 'factExtraction',
    maxOpsPerWindow: 50,
    windowMs: 60_000, // 50 ops per minute
    maxConcurrency: 3,
    backlogThreshold: 20,
    cooldownMs: 60_000,
    enabled: true,
  },
  graphSync: {
    workerName: 'graphSync',
    maxOpsPerWindow: 40,
    windowMs: 60_000,
    maxConcurrency: 1,
    backlogThreshold: 15,
    cooldownMs: 90_000,
    enabled: true,
  },
};

// ---------------------------------------------------------------------------
// Circuit Breaker State (module-scoped singleton)
// ---------------------------------------------------------------------------

interface BreakerInternalState {
  state: BreakerState;
  /** Timestamps of operations within the rate window */
  opTimestamps: number[];
  /** Current reported concurrency */
  currentConcurrency: number;
  /** Current reported backlog */
  currentBacklog: number;
  tripReason: string | null;
  lastTripped: number | null;
  resetAt: number | null;
  totalTrips: number;
}

const breakerStates: Map<string, BreakerInternalState> = new Map();
const breakerEvents: BreakerEvent[] = [];
const MAX_EVENTS = 500;

/** Initialize breaker states for all configured workers */
function initializeBreakers(): void {
  for (const key of Object.keys(CIRCUIT_BREAKER_CONFIGS)) {
    breakerStates.set(key, {
      state: 'closed',
      opTimestamps: [],
      currentConcurrency: 0,
      currentBacklog: 0,
      tripReason: null,
      lastTripped: null,
      resetAt: null,
      totalTrips: 0,
    });
  }
}

initializeBreakers();

// ---------------------------------------------------------------------------
// Event Logging
// ---------------------------------------------------------------------------

function recordEvent(event: BreakerEvent): void {
  breakerEvents.push(event);
  if (breakerEvents.length > MAX_EVENTS) {
    breakerEvents.shift();
  }
}

// ---------------------------------------------------------------------------
// Core Circuit Breaker Logic
// ---------------------------------------------------------------------------

/**
 * Record an operation for rate limiting purposes.
 * Call this each time a job starts for a protected worker.
 * Returns false if the circuit breaker trips (operation should be rejected).
 */
export function recordOperation(workerName: string): boolean {
  const config = CIRCUIT_BREAKER_CONFIGS[workerName];
  const internal = breakerStates.get(workerName);
  if (!config || !internal || !config.enabled) return true; // no breaker configured, allow

  // If breaker is open, reject
  if (internal.state === 'open') {
    // Check if cooldown has elapsed
    if (internal.resetAt && Date.now() >= internal.resetAt) {
      transitionToHalfOpen(workerName, config, internal);
    } else {
      return false;
    }
  }

  const now = Date.now();

  // Prune old timestamps outside the rate window
  const cutoff = now - config.windowMs;
  internal.opTimestamps = internal.opTimestamps.filter((t) => t >= cutoff);

  // Record the new operation
  internal.opTimestamps.push(now);

  // Check rate limit
  if (internal.opTimestamps.length > config.maxOpsPerWindow) {
    tripBreaker(workerName, config, internal, `Rate limit exceeded: ${internal.opTimestamps.length} ops in ${config.windowMs}ms window (max: ${config.maxOpsPerWindow})`);
    return false;
  }

  return true;
}

/**
 * Update concurrency count for a worker.
 * Call this when a job starts (delta=+1) or completes (delta=-1).
 */
export function updateConcurrency(workerName: string, delta: number): boolean {
  const config = CIRCUIT_BREAKER_CONFIGS[workerName];
  const internal = breakerStates.get(workerName);
  if (!config || !internal || !config.enabled) return true;

  // Check if breaker is open before modifying concurrency
  if (internal.state === 'open') {
    if (internal.resetAt && Date.now() >= internal.resetAt) {
      transitionToHalfOpen(workerName, config, internal);
    } else {
      if (delta < 0) {
        internal.currentConcurrency = Math.max(0, internal.currentConcurrency + delta);
      }
      return delta < 0; // allow releases, block new acquisitions
    }
  }

  internal.currentConcurrency = Math.max(0, internal.currentConcurrency + delta);

  // Check concurrency limit
  if (delta > 0 && internal.currentConcurrency > config.maxConcurrency) {
    // Roll back the increment since the operation is being rejected
    internal.currentConcurrency = Math.max(0, internal.currentConcurrency - delta);
    tripBreaker(workerName, config, internal, `Concurrency exceeded: ${internal.currentConcurrency + delta} active (max: ${config.maxConcurrency})`);
    return false;
  }

  return true;
}

/**
 * Update backlog size for a worker.
 * Call this whenever the waiting queue size changes.
 */
export function updateBacklog(workerName: string, backlogSize: number): boolean {
  const config = CIRCUIT_BREAKER_CONFIGS[workerName];
  const internal = breakerStates.get(workerName);
  if (!config || !internal || !config.enabled) return true;

  internal.currentBacklog = backlogSize;

  if (internal.state === 'open') {
    if (internal.resetAt && Date.now() >= internal.resetAt) {
      transitionToHalfOpen(workerName, config, internal);
    } else {
      return false;
    }
  }

  // Check backlog threshold
  if (backlogSize > config.backlogThreshold) {
    tripBreaker(workerName, config, internal, `Backlog threshold exceeded: ${backlogSize} waiting (max: ${config.backlogThreshold})`);
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// State Transitions
// ---------------------------------------------------------------------------

function tripBreaker(
  workerName: string,
  config: CircuitBreakerConfig,
  internal: BreakerInternalState,
  reason: string,
): void {
  internal.state = 'open';
  internal.tripReason = reason;
  internal.lastTripped = Date.now();
  internal.resetAt = Date.now() + config.cooldownMs;
  internal.totalTrips++;

  // Pause the worker queue
  try {
    pauseWorker(workerName);
  } catch {
    // Worker may not exist in registry — that's okay for circuit breaker
  }

  // Log the event
  recordEvent({
    timestamp: Date.now(),
    workerName,
    eventType: 'trip',
    reason,
    metrics: {
      opsInWindow: internal.opTimestamps.length,
      concurrency: internal.currentConcurrency,
      backlog: internal.currentBacklog,
    },
  });
}

function transitionToHalfOpen(
  _workerName: string,
  _config: CircuitBreakerConfig,
  internal: BreakerInternalState,
): void {
  internal.state = 'half-open';
  internal.tripReason = null;
  internal.resetAt = null;
  internal.opTimestamps = [];

  // Resume the worker so trial operations can actually execute
  try {
    resumeWorker(_workerName);
  } catch {
    // Worker may not exist in registry
  }

  recordEvent({
    timestamp: Date.now(),
    workerName: _workerName,
    eventType: 'half-open',
    reason: 'Cooldown elapsed, allowing trial operations',
    metrics: {
      opsInWindow: internal.opTimestamps.length,
      concurrency: internal.currentConcurrency,
      backlog: internal.currentBacklog,
    },
  });
}

/**
 * Manually reset a tripped circuit breaker.
 * Resumes the worker and transitions the breaker to closed state.
 */
export function resetBreaker(workerName: string): boolean {
  const internal = breakerStates.get(workerName);
  if (!internal) return false;

  internal.state = 'closed';
  internal.tripReason = null;
  internal.resetAt = null;
  internal.opTimestamps = [];

  // Resume the worker
  try {
    resumeWorker(workerName);
  } catch {
    // Worker may not exist in registry
  }

  recordEvent({
    timestamp: Date.now(),
    workerName,
    eventType: 'manual-reset',
    reason: 'Manual reset by administrator',
    metrics: {
      opsInWindow: 0,
      concurrency: internal.currentConcurrency,
      backlog: internal.currentBacklog,
    },
  });

  return true;
}

/**
 * Close a half-open breaker after a successful trial operation.
 */
export function confirmReset(workerName: string): boolean {
  const internal = breakerStates.get(workerName);
  if (!internal || internal.state !== 'half-open') return false;

  internal.state = 'closed';
  internal.tripReason = null;
  internal.opTimestamps = [];

  // Resume the worker
  try {
    resumeWorker(workerName);
  } catch {
    // Worker may not exist in registry
  }

  recordEvent({
    timestamp: Date.now(),
    workerName,
    eventType: 'reset',
    reason: 'Half-open breaker confirmed closed after successful trial',
    metrics: {
      opsInWindow: 0,
      concurrency: internal.currentConcurrency,
      backlog: internal.currentBacklog,
    },
  });

  return true;
}

// ---------------------------------------------------------------------------
// Status Reporting
// ---------------------------------------------------------------------------

/**
 * Get the status of a specific circuit breaker.
 */
export function getBreakerStatus(workerName: string): CircuitBreakerStatus | null {
  const config = CIRCUIT_BREAKER_CONFIGS[workerName];
  const internal = breakerStates.get(workerName);
  if (!config || !internal) return null;

  // Prune expired timestamps before reporting
  const cutoff = Date.now() - config.windowMs;
  internal.opTimestamps = internal.opTimestamps.filter((t) => t >= cutoff);

  return {
    workerName,
    state: internal.state,
    opsInWindow: internal.opTimestamps.length,
    currentConcurrency: internal.currentConcurrency,
    currentBacklog: internal.currentBacklog,
    tripReason: internal.tripReason,
    lastTripped: internal.lastTripped,
    resetAt: internal.resetAt,
    totalTrips: internal.totalTrips,
    enabled: config.enabled,
  };
}

/**
 * Get the status of all circuit breakers.
 */
export function getAllBreakerStatuses(): CircuitBreakerStatus[] {
  const statuses: CircuitBreakerStatus[] = [];
  for (const workerName of Object.keys(CIRCUIT_BREAKER_CONFIGS)) {
    const status = getBreakerStatus(workerName);
    if (status) statuses.push(status);
  }
  return statuses;
}

/**
 * Get recent circuit breaker events (for admin dashboard).
 */
export function getBreakerEvents(limit: number = 50): BreakerEvent[] {
  return breakerEvents.slice(-limit);
}

/**
 * Check if a specific worker's circuit breaker is allowing operations.
 */
export function isWorkerAllowed(workerName: string): boolean {
  const internal = breakerStates.get(workerName);
  if (!internal) return true; // no breaker configured

  const config = CIRCUIT_BREAKER_CONFIGS[workerName];
  if (!config?.enabled) return true;

  if (internal.state === 'open') {
    // Check if cooldown elapsed
    if (internal.resetAt && Date.now() >= internal.resetAt) {
      transitionToHalfOpen(workerName, config, internal);
      return true; // allow trial operation
    }
    return false;
  }

  return true;
}

/**
 * Get a summary report of all circuit breakers for the admin health endpoint.
 */
export function getCircuitBreakerReport(): {
  totalBreakers: number;
  openBreakers: number;
  halfOpenBreakers: number;
  closedBreakers: number;
  recentEvents: BreakerEvent[];
  breakers: CircuitBreakerStatus[];
} {
  const breakers = getAllBreakerStatuses();
  return {
    totalBreakers: breakers.length,
    openBreakers: breakers.filter((b) => b.state === 'open').length,
    halfOpenBreakers: breakers.filter((b) => b.state === 'half-open').length,
    closedBreakers: breakers.filter((b) => b.state === 'closed').length,
    recentEvents: getBreakerEvents(20),
    breakers,
  };
}
