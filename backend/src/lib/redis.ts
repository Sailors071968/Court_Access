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

/** The target, safe to log: credentials removed. */
const REDIS_TARGET = REDIS_URL.replace(/\/\/.*@/, '//***@');

/**
 * A refused connection arrives as an AggregateError whose own `message` is
 * empty, so logging `err.message` alone produced an unbroken run of
 * "[Redis] Connection error:" with nothing after it — during an incident where
 * ruling Redis out cost real time. The cause is in the nested errors, and the
 * target matters too: the default is localhost, so a host that has Redis
 * elsewhere but no REDIS_URL fails here looking like Redis is down.
 */
function describeRedisError(err: Error): string {
  if (err.message) return err.message;

  const nested = (err as AggregateError).errors;
  if (Array.isArray(nested) && nested.length > 0) {
    const seen = [...new Set(nested.map((e) => (e instanceof Error ? e.message || e.name : String(e))))];
    return seen.join('; ');
  }

  return (err as NodeJS.ErrnoException).code ?? err.name ?? 'no detail';
}

redisConnection.on('error', (err) => {
  console.error(`[Redis] Connection error (${REDIS_TARGET}):`, describeRedisError(err));
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected to', REDIS_TARGET);
});

export default redisConnection;
