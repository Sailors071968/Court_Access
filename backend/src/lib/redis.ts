// ============================================================================
// CourtAccess — Redis Connection Singleton
// Shared Redis/IORedis connection for BullMQ queues and caching.
// Lazy initialization: connection is not created until first access,
// allowing the server to start without Redis when DISABLE_WORKERS=true.
// ============================================================================

import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let _redisConnection: IORedis | null = null;

function getRedisConnection(): IORedis {
  if (!_redisConnection) {
    _redisConnection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times: number) {
        return Math.min(times * 500, 5000);
      },
    });

    _redisConnection.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    _redisConnection.on('connect', () => {
      console.log('[Redis] Connected to', REDIS_URL.replace(/\/\/.*@/, '//***@'));
    });
  }
  return _redisConnection;
}

/** Shared Redis connection for BullMQ queues (lazy — created on first access) */
export const redisConnection = new Proxy({} as IORedis, {
  get(_target, prop, receiver) {
    const conn = getRedisConnection();
    const value = Reflect.get(conn, prop, conn);
    if (typeof value === 'function') {
      return value.bind(conn);
    }
    return value;
  },
});

export default redisConnection;
