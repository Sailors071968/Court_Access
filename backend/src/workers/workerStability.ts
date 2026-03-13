// ============================================================================
// Production Security Patch — Worker Stability Guards
// PART 4: Global error handlers, memory limits, BullMQ retry configuration
//
// Protections:
//   1. Global unhandledRejection + uncaughtException handlers
//   2. Memory usage monitoring with automatic restart threshold
//   3. Standard BullMQ retry configuration for all job queues
//
// Usage:
//   import { installWorkerStabilityGuards, BULLMQ_RETRY_CONFIG } from './workerStability.js';
//   installWorkerStabilityGuards();
// ============================================================================

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Maximum memory usage in MB before worker should be flagged for restart */
const MAX_MEMORY_MB = 1200;

/** Memory check interval in milliseconds */
const MEMORY_CHECK_INTERVAL_MS = 60_000; // 1 minute

/** Standard BullMQ retry configuration — apply to all job definitions */
export const BULLMQ_RETRY_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
};

// ---------------------------------------------------------------------------
// Global Error Handlers
// ---------------------------------------------------------------------------

let globalHandlersInstalled = false;
let memoryCheckTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Install global process error handlers.
 * Safe to call multiple times — only installs once.
 */
export function installGlobalErrorHandlers(): void {
  if (globalHandlersInstalled) return;
  globalHandlersInstalled = true;

  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    console.error('[WorkerStability] Unhandled Promise Rejection:', reason);
    console.error('[WorkerStability] Promise:', promise);
    // Do NOT exit — log and continue. The rejection is contained.
  });

  process.on('uncaughtException', (err: Error) => {
    console.error('[WorkerStability] Uncaught Exception:', err.message);
    console.error('[WorkerStability] Stack:', err.stack);
    // For uncaught exceptions, log but attempt to continue.
    // If the process is unstable, the memory watchdog or pm2 will restart it.
  });

  console.log('[WorkerStability] Global error handlers installed');
}

// ---------------------------------------------------------------------------
// Memory Limit Monitor
// ---------------------------------------------------------------------------

export interface MemoryStatus {
  rssMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
  exceedsLimit: boolean;
  limitMB: number;
}

/**
 * Get current memory usage status.
 */
export function getMemoryStatus(): MemoryStatus {
  const mem = process.memoryUsage();
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);

  return {
    rssMB,
    heapUsedMB,
    heapTotalMB,
    exceedsLimit: rssMB > MAX_MEMORY_MB,
    limitMB: MAX_MEMORY_MB,
  };
}

/**
 * Start periodic memory monitoring.
 * Logs warnings when memory exceeds the configured threshold.
 * In production with pm2, the process manager handles restarts.
 */
export function startMemoryMonitor(): void {
  if (memoryCheckTimer) return;

  memoryCheckTimer = setInterval(() => {
    const status = getMemoryStatus();
    if (status.exceedsLimit) {
      console.warn(
        `[WorkerStability] MEMORY WARNING: RSS=${status.rssMB}MB exceeds limit ${status.limitMB}MB. ` +
        `Heap: ${status.heapUsedMB}/${status.heapTotalMB}MB. Consider restarting.`
      );
    }
  }, MEMORY_CHECK_INTERVAL_MS);

  console.log(`[WorkerStability] Memory monitor started (limit: ${MAX_MEMORY_MB}MB, check every ${MEMORY_CHECK_INTERVAL_MS / 1000}s)`);
}

/**
 * Stop the memory monitor.
 */
export function stopMemoryMonitor(): void {
  if (memoryCheckTimer) {
    clearInterval(memoryCheckTimer);
    memoryCheckTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Combined Installer
// ---------------------------------------------------------------------------

/**
 * Install all worker stability guards:
 *   1. Global error handlers (unhandledRejection, uncaughtException)
 *   2. Memory usage monitor with configurable threshold
 *
 * Call this once at worker startup.
 */
export function installWorkerStabilityGuards(): void {
  installGlobalErrorHandlers();
  startMemoryMonitor();
  console.log('[WorkerStability] All stability guards active');
}

// ---------------------------------------------------------------------------
// Exported Configuration
// ---------------------------------------------------------------------------

export const WORKER_STABILITY_CONFIG = {
  maxMemoryMB: MAX_MEMORY_MB,
  memoryCheckIntervalMs: MEMORY_CHECK_INTERVAL_MS,
  retryConfig: BULLMQ_RETRY_CONFIG,
  globalHandlers: ['unhandledRejection', 'uncaughtException'],
  features: {
    globalErrorHandlers: true,
    memoryMonitoring: true,
    bullmqRetryDefaults: true,
  },
};
