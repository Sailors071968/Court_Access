// ============================================
// Court Access — Memory Protection Watchdog (Wave 1 Stabilization)
// Runtime memory monitoring with automatic queue pausing when
// thresholds are exceeded.
//
// Monitors:
//   - Process memory (RSS)
//   - Node.js heap usage
//   - Redis memory (when connected)
//
// When threshold exceeded:
//   1. Pause AI queues
//   2. Emit alert to systemHealth worker
//   3. Log event with memory snapshot
// ============================================

import { pauseWorker, resumeWorker } from './registry';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface MemoryThresholds {
  /** Maximum heap usage percentage before triggering warning (0-100) */
  heapWarningPercent: number;
  /** Maximum heap usage percentage before triggering critical pause (0-100) */
  heapCriticalPercent: number;
  /** Maximum RSS in megabytes before triggering warning */
  rssWarningMB: number;
  /** Maximum RSS in megabytes before triggering critical pause */
  rssCriticalMB: number;
  /** Maximum Redis memory in megabytes before triggering warning */
  redisWarningMB: number;
  /** Maximum Redis memory in megabytes before triggering critical pause */
  redisCriticalMB: number;
}

export interface WatchdogConfig {
  /** Memory thresholds */
  thresholds: MemoryThresholds;
  /** How often to check memory in milliseconds */
  checkIntervalMs: number;
  /** Workers to pause when critical threshold is exceeded */
  pauseTargets: string[];
  /** Whether the watchdog is enabled */
  enabled: boolean;
}

/**
 * Default memory protection thresholds.
 * Conservative defaults — tune after load testing.
 */
export const DEFAULT_WATCHDOG_CONFIG: WatchdogConfig = {
  thresholds: {
    heapWarningPercent: 75,
    heapCriticalPercent: 90,
    rssWarningMB: 512,
    rssCriticalMB: 768,
    redisWarningMB: 256,
    redisCriticalMB: 384,
  },
  checkIntervalMs: 30_000, // check every 30 seconds
  pauseTargets: ['aiAnalysis', 'transcription', 'evidenceIngest', 'factExtraction'],
  enabled: true,
};

// ---------------------------------------------------------------------------
// Memory Snapshot Types
// ---------------------------------------------------------------------------

export type AlertLevel = 'normal' | 'warning' | 'critical';

export interface MemorySnapshot {
  timestamp: number;
  heap: {
    usedMB: number;
    totalMB: number;
    usagePercent: number;
    level: AlertLevel;
  };
  rss: {
    usedMB: number;
    level: AlertLevel;
  };
  redis: {
    usedMB: number;
    level: AlertLevel;
    connected: boolean;
  };
  overall: AlertLevel;
}

export interface WatchdogEvent {
  timestamp: number;
  eventType: 'warning' | 'critical' | 'recovery' | 'pause' | 'resume';
  message: string;
  snapshot: MemorySnapshot;
  pausedWorkers: string[];
}

export interface WatchdogStatus {
  enabled: boolean;
  running: boolean;
  config: WatchdogConfig;
  lastCheck: MemorySnapshot | null;
  currentLevel: AlertLevel;
  pausedWorkers: string[];
  totalChecks: number;
  totalWarnings: number;
  totalCritical: number;
  events: WatchdogEvent[];
}

// ---------------------------------------------------------------------------
// Watchdog State (module-scoped singleton)
// ---------------------------------------------------------------------------

let watchdogConfig: WatchdogConfig = { ...DEFAULT_WATCHDOG_CONFIG };
let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastSnapshot: MemorySnapshot | null = null;
let currentLevel: AlertLevel = 'normal';
const pausedByWatchdog: Set<string> = new Set();
let totalChecks = 0;
let totalWarnings = 0;
let totalCritical = 0;
const watchdogEvents: WatchdogEvent[] = [];
const MAX_EVENTS = 200;

/** Guard to prevent concurrent performCheck executions */
let checkInProgress = false;

/** Redis memory provider function (injectable for testing / production wiring) */
let redisMemoryProvider: (() => Promise<{ usedMB: number; connected: boolean }>) | null = null;

// ---------------------------------------------------------------------------
// Memory Collection
// ---------------------------------------------------------------------------

function getHeapMetrics(): { usedMB: number; totalMB: number; usagePercent: number } {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const mem = process.memoryUsage();
    const usedMB = Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100;
    const totalMB = Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100;
    return {
      usedMB,
      totalMB,
      usagePercent: totalMB > 0 ? Math.round(usedMB / totalMB * 100) : 0,
    };
  }
  return { usedMB: 0, totalMB: 0, usagePercent: 0 };
}

function getRssMetrics(): { usedMB: number } {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const mem = process.memoryUsage();
    return { usedMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100 };
  }
  return { usedMB: 0 };
}

async function getRedisMetrics(): Promise<{ usedMB: number; connected: boolean }> {
  if (redisMemoryProvider) {
    try {
      return await redisMemoryProvider();
    } catch {
      return { usedMB: 0, connected: false };
    }
  }
  return { usedMB: 0, connected: false };
}

function classifyHeap(usagePercent: number, thresholds: MemoryThresholds): AlertLevel {
  if (usagePercent >= thresholds.heapCriticalPercent) return 'critical';
  if (usagePercent >= thresholds.heapWarningPercent) return 'warning';
  return 'normal';
}

function classifyRss(usedMB: number, thresholds: MemoryThresholds): AlertLevel {
  if (usedMB >= thresholds.rssCriticalMB) return 'critical';
  if (usedMB >= thresholds.rssWarningMB) return 'warning';
  return 'normal';
}

function classifyRedis(usedMB: number, thresholds: MemoryThresholds): AlertLevel {
  if (usedMB >= thresholds.redisCriticalMB) return 'critical';
  if (usedMB >= thresholds.redisWarningMB) return 'warning';
  return 'normal';
}

function worstLevel(levels: AlertLevel[]): AlertLevel {
  if (levels.includes('critical')) return 'critical';
  if (levels.includes('warning')) return 'warning';
  return 'normal';
}

// ---------------------------------------------------------------------------
// Core Check Logic
// ---------------------------------------------------------------------------

async function collectSnapshot(): Promise<MemorySnapshot> {
  const heap = getHeapMetrics();
  const rss = getRssMetrics();
  const redis = await getRedisMetrics();
  const thresholds = watchdogConfig.thresholds;

  const heapLevel = classifyHeap(heap.usagePercent, thresholds);
  const rssLevel = classifyRss(rss.usedMB, thresholds);
  const redisLevel = classifyRedis(redis.usedMB, thresholds);

  return {
    timestamp: Date.now(),
    heap: { ...heap, level: heapLevel },
    rss: { ...rss, level: rssLevel },
    redis: { ...redis, level: redisLevel },
    overall: worstLevel([heapLevel, rssLevel, redisLevel]),
  };
}

function recordEvent(event: WatchdogEvent): void {
  watchdogEvents.push(event);
  if (watchdogEvents.length > MAX_EVENTS) {
    watchdogEvents.shift();
  }
}

async function performCheck(): Promise<void> {
  if (checkInProgress) return;
  checkInProgress = true;
  try {
    totalChecks++;
    const snapshot = collectSnapshot();
    lastSnapshot = await snapshot;

    const previousLevel = currentLevel;
    currentLevel = lastSnapshot.overall;

    // Handle level transitions
    if (currentLevel === 'critical' && previousLevel !== 'critical') {
      totalCritical++;
      pauseAIQueues(lastSnapshot);
    } else if (currentLevel === 'warning' && previousLevel === 'normal') {
      totalWarnings++;
      recordEvent({
        timestamp: Date.now(),
        eventType: 'warning',
        message: `Memory warning: heap=${lastSnapshot.heap.usagePercent}%, RSS=${lastSnapshot.rss.usedMB}MB`,
        snapshot: lastSnapshot,
        pausedWorkers: Array.from(pausedByWatchdog),
      });
    } else if (currentLevel === 'normal' && previousLevel !== 'normal') {
      resumeAIQueues(lastSnapshot);
    }
  } finally {
    checkInProgress = false;
  }
}

function pauseAIQueues(snapshot: MemorySnapshot): void {
  const targets = watchdogConfig.pauseTargets;
  for (const workerName of targets) {
    if (!pausedByWatchdog.has(workerName)) {
      try {
        pauseWorker(workerName);
        pausedByWatchdog.add(workerName);
      } catch {
        // Worker may not exist in registry
      }
    }
  }

  recordEvent({
    timestamp: Date.now(),
    eventType: 'critical',
    message: `Memory critical — pausing ${targets.length} workers: heap=${snapshot.heap.usagePercent}%, RSS=${snapshot.rss.usedMB}MB`,
    snapshot,
    pausedWorkers: Array.from(pausedByWatchdog),
  });
}

function resumeAIQueues(snapshot: MemorySnapshot): void {
  for (const workerName of pausedByWatchdog) {
    try {
      resumeWorker(workerName);
    } catch {
      // Worker may not exist
    }
  }

  recordEvent({
    timestamp: Date.now(),
    eventType: 'recovery',
    message: `Memory recovered — resuming ${pausedByWatchdog.size} workers`,
    snapshot,
    pausedWorkers: [],
  });

  pausedByWatchdog.clear();
}

// ---------------------------------------------------------------------------
// Watchdog Lifecycle
// ---------------------------------------------------------------------------

/**
 * Start the memory watchdog with the given configuration.
 * If already running, stops and restarts with new config.
 */
export function startWatchdog(config?: Partial<WatchdogConfig>): void {
  if (watchdogTimer) {
    stopWatchdog();
  }

  if (config) {
    watchdogConfig = { ...DEFAULT_WATCHDOG_CONFIG, ...config };
    if (config.thresholds) {
      watchdogConfig.thresholds = { ...DEFAULT_WATCHDOG_CONFIG.thresholds, ...config.thresholds };
    }
  }

  if (!watchdogConfig.enabled) return;

  isRunning = true;

  // Run first check immediately
  performCheck().catch(() => { /* watchdog check failed, will retry next interval */ });

  watchdogTimer = setInterval(() => {
    performCheck().catch(() => { /* watchdog check failed, will retry next interval */ });
  }, watchdogConfig.checkIntervalMs);
}

/**
 * Stop the memory watchdog.
 */
export function stopWatchdog(): void {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
  isRunning = false;
}

/**
 * Set a custom Redis memory provider.
 * In production, this would query Redis INFO memory.
 */
export function setRedisMemoryProvider(
  provider: () => Promise<{ usedMB: number; connected: boolean }>,
): void {
  redisMemoryProvider = provider;
}

// ---------------------------------------------------------------------------
// Status Reporting
// ---------------------------------------------------------------------------

/**
 * Get the current watchdog status for the admin dashboard.
 */
export function getWatchdogStatus(): WatchdogStatus {
  return {
    enabled: watchdogConfig.enabled,
    running: isRunning,
    config: watchdogConfig,
    lastCheck: lastSnapshot,
    currentLevel,
    pausedWorkers: Array.from(pausedByWatchdog),
    totalChecks,
    totalWarnings,
    totalCritical,
    events: watchdogEvents.slice(-50),
  };
}

/**
 * Get a quick memory health summary for inclusion in the system health endpoint.
 */
export function getMemoryHealthSummary(): {
  level: AlertLevel;
  heapPercent: number;
  rssMB: number;
  pausedWorkers: number;
  watchdogActive: boolean;
} {
  const heap = getHeapMetrics();
  const rss = getRssMetrics();

  return {
    level: currentLevel,
    heapPercent: heap.usagePercent,
    rssMB: rss.usedMB,
    pausedWorkers: pausedByWatchdog.size,
    watchdogActive: isRunning,
  };
}

/**
 * Force an immediate memory check (useful for admin actions).
 */
export async function forceCheck(): Promise<MemorySnapshot> {
  await performCheck();
  return lastSnapshot!;
}

/**
 * Update watchdog thresholds at runtime (for admin tuning).
 */
export function updateThresholds(thresholds: Partial<MemoryThresholds>): void {
  watchdogConfig.thresholds = { ...watchdogConfig.thresholds, ...thresholds };
}

/**
 * Get the list of workers currently paused by the watchdog.
 */
export function getWatchdogPausedWorkers(): string[] {
  return Array.from(pausedByWatchdog);
}
