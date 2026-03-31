// ============================================================================
// CourtAccess — Redis Connection Singleton (Hardened for Scale)
// Shared Redis/IORedis connection for BullMQ queues and caching.
// Includes reconnection strategy, connection monitoring, and health checks.
// ============================================================================

import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_MAX_RETRIES = parseInt(process.env.REDIS_MAX_RETRIES || '20', 10);

// ---------------------------------------------------------------------------
// Connection State Tracking
// ---------------------------------------------------------------------------

let connectionState: 'connecting' | 'connected' | 'disconnected' | 'error' = 'connecting';
let lastErrorTime = 0;
let reconnectCount = 0;

/** Shared Redis connection for BullMQ queues */
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: true,
  // Connection pool settings
  connectTimeout: 10_000,
  commandTimeout: 15_000,
  keepAlive: 30_000,
  // Reconnection strategy with exponential backoff + jitter
  retryStrategy(times: number) {
    reconnectCount = times;
    if (times > REDIS_MAX_RETRIES) {
      console.error(`[Redis] Max reconnection attempts (${REDIS_MAX_RETRIES}) exceeded. Giving up.`);
      return null; // Stop retrying
    }
    // Exponential backoff with jitter: base * 2^attempt + random(0..500)
    const delay = Math.min(times * 500, 10_000) + Math.floor(Math.random() * 500);
    console.warn(`[Redis] Reconnecting (attempt ${times}/${REDIS_MAX_RETRIES}) in ${delay}ms`);
    return delay;
  },
  // Lazy connect — don't block module load if Redis is down
  lazyConnect: false,
});

// ---------------------------------------------------------------------------
// Connection Event Monitoring
// ---------------------------------------------------------------------------

redisConnection.on('error', (err) => {
  connectionState = 'error';
  lastErrorTime = Date.now();
  console.error('[Redis] Connection error:', err.message);
});

redisConnection.on('connect', () => {
  connectionState = 'connected';
  reconnectCount = 0;
  console.log('[Redis] Connected to', REDIS_URL.replace(/\/\/.*@/, '//***@'));
});

redisConnection.on('close', () => {
  connectionState = 'disconnected';
  console.warn('[Redis] Connection closed');
});

redisConnection.on('reconnecting', () => {
  connectionState = 'connecting';
});

// ---------------------------------------------------------------------------
// Redis Health Check
// ---------------------------------------------------------------------------

export interface RedisHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connectionState: string;
  latencyMs: number;
  reconnectCount: number;
  lastErrorTime: number | null;
  memoryUsageMB?: number;
}

/**
 * Perform a health check on the Redis connection.
 * Returns connection status, latency, and memory usage.
 */
export async function checkRedisHealth(): Promise<RedisHealthStatus> {
  const start = performance.now();

  if (connectionState !== 'connected') {
    return {
      status: 'unhealthy',
      connectionState,
      latencyMs: 0,
      reconnectCount,
      lastErrorTime: lastErrorTime || null,
    };
  }

  try {
    await redisConnection.ping();
    const latencyMs = Math.round(performance.now() - start);

    // Get memory info
    let memoryUsageMB: number | undefined;
    try {
      const info = await redisConnection.info('memory');
      const match = info.match(/used_memory:(\d+)/);
      if (match) {
        memoryUsageMB = Math.round(parseInt(match[1], 10) / 1024 / 1024);
      }
    } catch {
      // Memory info is optional
    }

    return {
      status: latencyMs > 100 ? 'degraded' : 'healthy',
      connectionState,
      latencyMs,
      reconnectCount,
      lastErrorTime: lastErrorTime || null,
      memoryUsageMB,
    };
  } catch {
    return {
      status: 'unhealthy',
      connectionState,
      latencyMs: Math.round(performance.now() - start),
      reconnectCount,
      lastErrorTime: lastErrorTime || null,
    };
  }
}

/**
 * Get the current connection state without performing a health check.
 */
export function getRedisConnectionState(): string {
  return connectionState;
}

/**
 * Gracefully disconnect Redis.
 * Call during server shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  try {
    await redisConnection.quit();
    console.log('[Redis] Disconnected gracefully');
  } catch {
    redisConnection.disconnect();
    console.warn('[Redis] Forced disconnect');
  }
}

export default redisConnection;
