// ============================================
// Court Access — Redis Client
// Shared Redis connection for BullMQ and caching.
// ============================================

import IORedis from 'ioredis';
import { config } from '../config/index.js';

let redisConnection = null;
let redisAvailable = false;
let connectionAttempted = false;

/**
 * Get or create a shared Redis connection.
 * Returns null if Redis is not configured or unavailable.
 * Silently degrades when Redis is not running.
 */
export function getRedisConnection() {
  if (redisConnection) return redisConnection;
  if (connectionAttempted && !redisAvailable) return null;

  connectionAttempted = true;

  try {
    redisConnection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      lazyConnect: true, // Don't connect immediately
      retryStrategy(times) {
        if (times > 2) {
          redisAvailable = false;
          return null; // Stop retrying silently
        }
        return Math.min(times * 500, 2000);
      },
    });

    redisConnection.on('connect', () => {
      redisAvailable = true;
      console.log('[Redis] Connected successfully');
    });

    // Suppress noisy errors when Redis isn't running
    redisConnection.on('error', () => {});

    // Attempt connection
    redisConnection.connect().catch(() => {
      console.log('[Redis] Not available — queue features disabled (install Redis or use Docker Compose)');
      redisAvailable = false;
    });

    return redisConnection;
  } catch (err) {
    console.log('[Redis] Not available — queue features disabled');
    return null;
  }
}

/**
 * Check if Redis is currently available.
 */
export function isRedisAvailable() {
  return redisAvailable;
}

/**
 * Close the Redis connection gracefully.
 */
export async function closeRedisConnection() {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
    console.log('[Redis] Connection closed');
  }
}
