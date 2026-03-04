// ============================================
// Court Access — Redis Configuration (BullMQ)
// ============================================

import IORedis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

let redisConnection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!redisConnection) {
    redisConnection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        logger.warn('Redis connection retry', { attempt: times, delayMs: delay });
        return delay;
      },
      reconnectOnError(err: Error) {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return targetErrors.some((e) => err.message.includes(e));
      },
    });

    redisConnection.on('error', (err) => {
      logger.error('Redis connection error', { error: err.message });
    });

    redisConnection.on('connect', () => {
      logger.info('Redis connected');
    });
  }
  return redisConnection;
}
