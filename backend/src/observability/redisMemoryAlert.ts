// ============================================================================
// Scale Validation — Redis Memory Alert
//
// Monitors Redis used_memory and emits warnings when usage exceeds
// configurable thresholds. Prevents silent Redis OOM during large-scale
// processing (100s GB evidence pipelines).
//
// Usage: call startRedisMemoryMonitor() during server boot.
// ============================================================================

import { redisConnection } from '../lib/redis.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface RedisMemoryConfig {
  /** Polling interval in ms (default: 30s) */
  intervalMs: number;
  /** Warn when used_memory exceeds this fraction (0-1) of maxmemory (default: 0.8) */
  warnThresholdPct: number;
  /** Critical alert when used_memory exceeds this fraction (default: 0.95) */
  criticalThresholdPct: number;
}

const DEFAULT_CONFIG: RedisMemoryConfig = {
  intervalMs: parseInt(process.env.REDIS_MEMORY_CHECK_MS || '30000', 10),
  warnThresholdPct: parseFloat(process.env.REDIS_MEMORY_WARN_PCT || '0.80'),
  criticalThresholdPct: parseFloat(process.env.REDIS_MEMORY_CRITICAL_PCT || '0.95'),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RedisMemorySnapshot {
  usedMemoryBytes: number;
  usedMemoryMB: number;
  maxMemoryBytes: number;
  maxMemoryMB: number;
  usagePct: number;
  status: 'ok' | 'warn' | 'critical' | 'unknown';
  fragmentation: number;
  connectedClients: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Memory Check
// ---------------------------------------------------------------------------

/**
 * Query Redis INFO memory and return a structured snapshot.
 */
export async function getRedisMemorySnapshot(
  config: RedisMemoryConfig = DEFAULT_CONFIG,
): Promise<RedisMemorySnapshot> {
  try {
    const info = await redisConnection.info('memory');
    const clientInfo = await redisConnection.info('clients');

    const usedMemory = extractInfoValue(info, 'used_memory');
    const maxMemory = extractInfoValue(info, 'maxmemory');
    const fragRatio = extractInfoFloat(info, 'mem_fragmentation_ratio');
    const clients = extractInfoValue(clientInfo, 'connected_clients');

    const usedMemoryBytes = usedMemory ?? 0;
    const maxMemoryBytes = maxMemory ?? 0;
    const usagePct = maxMemoryBytes > 0 ? usedMemoryBytes / maxMemoryBytes : 0;

    let status: 'ok' | 'warn' | 'critical' | 'unknown' = 'ok';
    if (maxMemoryBytes === 0) {
      // No maxmemory set — can't compute percentage, treat as unknown
      status = 'unknown';
    } else if (usagePct >= config.criticalThresholdPct) {
      status = 'critical';
    } else if (usagePct >= config.warnThresholdPct) {
      status = 'warn';
    }

    return {
      usedMemoryBytes,
      usedMemoryMB: Math.round(usedMemoryBytes / 1024 / 1024),
      maxMemoryBytes,
      maxMemoryMB: Math.round(maxMemoryBytes / 1024 / 1024),
      usagePct: Math.round(usagePct * 10000) / 100, // e.g. 82.35
      status,
      fragmentation: fragRatio ?? 0,
      connectedClients: clients ?? 0,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[RedisMemoryAlert] Failed to query Redis INFO: ${msg}`);
    return {
      usedMemoryBytes: 0,
      usedMemoryMB: 0,
      maxMemoryBytes: 0,
      maxMemoryMB: 0,
      usagePct: 0,
      status: 'unknown',
      fragmentation: 0,
      connectedClients: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Periodic Monitor
// ---------------------------------------------------------------------------

let monitorInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start a periodic Redis memory monitor.
 * Logs warnings at the configured thresholds.
 *
 * Does nothing when the workers are disabled. What this monitor exists to catch
 * is Redis running out of memory under queue load, and with DISABLE_WORKERS=true
 * there are no queues — so the only thing it can produce on a host without Redis
 * is noise. The guard lives here rather than at the call site because the
 * connection is lazy: this monitor's first INFO is what opens the socket, so
 * starting it is what makes Redis mandatory again. Measured on a host with no
 * Redis and workers disabled: it logged an unbroken stream of contentless
 * `[Redis] Connection error:` lines, ~2 a minute at the default interval, which
 * is exactly the noise lazyConnect was introduced to remove.
 */
export function startRedisMemoryMonitor(config: RedisMemoryConfig = DEFAULT_CONFIG): void {
  if (monitorInterval) return;

  if (process.env.DISABLE_WORKERS === 'true') {
    console.log('[RedisMemoryAlert] Monitor not started — no queues to watch (DISABLE_WORKERS=true)');
    return;
  }

  monitorInterval = setInterval(async () => {
    const snapshot = await getRedisMemorySnapshot(config);

    if (snapshot.status === 'critical') {
      console.error(
        `[RedisMemoryAlert] CRITICAL — Redis memory at ${snapshot.usagePct}% ` +
        `(${snapshot.usedMemoryMB}MB / ${snapshot.maxMemoryMB}MB). ` +
        `Fragmentation: ${snapshot.fragmentation}x. Clients: ${snapshot.connectedClients}. ` +
        `ACTION REQUIRED: Scale Redis or reduce queue depth immediately.`,
      );
    } else if (snapshot.status === 'warn') {
      console.warn(
        `[RedisMemoryAlert] WARNING — Redis memory at ${snapshot.usagePct}% ` +
        `(${snapshot.usedMemoryMB}MB / ${snapshot.maxMemoryMB}MB). ` +
        `Fragmentation: ${snapshot.fragmentation}x. Clients: ${snapshot.connectedClients}.`,
      );
    }
  }, config.intervalMs);

  console.log(
    `[RedisMemoryAlert] Monitor started (interval: ${config.intervalMs}ms, ` +
    `warn: ${config.warnThresholdPct * 100}%, critical: ${config.criticalThresholdPct * 100}%)`,
  );
}

export function stopRedisMemoryMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('[RedisMemoryAlert] Monitor stopped');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractInfoValue(info: string, key: string): number | null {
  const match = info.match(new RegExp(`^${key}:(\\d+)`, 'm'));
  return match ? parseInt(match[1], 10) : null;
}

function extractInfoFloat(info: string, key: string): number | null {
  const match = info.match(new RegExp(`^${key}:([\\d.]+)`, 'm'));
  return match ? parseFloat(match[1]) : null;
}
