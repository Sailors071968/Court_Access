// ============================================================================
// CourtAccess — Redis Connection Singleton
// Shared Redis/IORedis connection for BullMQ queues and caching.
// ============================================================================

import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Shared Redis connection for BullMQ queues.
 *
 * `lazyConnect` matters more than it looks. Connecting at module load meant
 * that merely importing this file opened a socket, which (a) kept the event
 * loop alive so any process importing it never exited on its own, and (b) on a
 * host with no Redis, retried forever — measured at 12 log lines a minute,
 * roughly 17,000 a day, burying real errors. Connecting on first use gives the
 * same behaviour to everything that actually uses a queue, and costs nothing to
 * everything that does not.
 */
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
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
