// ============================================================================
// CourtAccess — Redis Connection Singleton
// Shared Redis/IORedis connection for BullMQ queues and caching.
// ============================================================================

import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/** Shared Redis connection for BullMQ queues */
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times: number) {
    return Math.min(times * 500, 5000);
  },
});

redisConnection.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected to', REDIS_URL.replace(/\/\/.*@/, '//***@'));
});

export default redisConnection;
