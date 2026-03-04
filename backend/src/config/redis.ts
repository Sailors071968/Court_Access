// ============================================
// Court Access — Redis Configuration (BullMQ)
// ============================================

import IORedis from 'ioredis';
import { env } from './env.js';

let redisConnection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!redisConnection) {
    redisConnection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return redisConnection;
}
