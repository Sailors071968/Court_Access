// ============================================
// Court Access — Rate Limiting Middleware
// Phase 27/33/98: Production Hardening
//
// Hybrid rate limiter: Redis-backed when available, in-memory fallback.
// Supports multi-instance deployments via Redis sliding window.
// ============================================

import { getRedisConnection, isRedisAvailable } from '../services/redisClient.js';

/**
 * Create a rate limiter middleware.
 * Uses Redis sliding window when available, falls back to in-memory Map.
 *
 * @param options - { windowMs, maxRequests, keyFn, message, prefix }
 * @returns Express middleware
 */
export function rateLimiter(options = {}) {
  const {
    windowMs = 60000,       // 1 minute window
    maxRequests = 100,       // Max requests per window
    keyFn = (req) => req.ip, // Key function (default: by IP)
    message = 'Too many requests, please try again later.',
    prefix = 'rl',           // Redis key prefix
  } = options;

  // In-memory fallback Map (used when Redis is unavailable)
  const requestCounts = new Map();

  // Cleanup old entries periodically (unref to not block graceful shutdown)
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounts) {
      if (now - data.windowStart > windowMs * 2) {
        requestCounts.delete(key);
      }
    }
  }, windowMs);
  if (cleanupTimer.unref) cleanupTimer.unref();

  /**
   * Redis-backed sliding window rate limiting.
   * Uses a sorted set with timestamp scores for precise windowing.
   */
  async function checkRedisRateLimit(redis, key) {
    const redisKey = `${prefix}:${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const pipeline = redis.pipeline();
    // Remove expired entries
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    // Add current request
    pipeline.zadd(redisKey, now, `${now}:${Math.random().toString(36).slice(2)}`);
    // Count requests in window
    pipeline.zcard(redisKey);
    // Set TTL on key
    pipeline.pexpire(redisKey, windowMs + 1000);

    const results = await pipeline.exec();
    const count = results[2][1]; // zcard result
    return count;
  }

  /**
   * In-memory fallback rate limiting (single instance only).
   */
  function checkMemoryRateLimit(key) {
    const now = Date.now();
    let data = requestCounts.get(key);

    if (!data || now - data.windowStart > windowMs) {
      data = { count: 0, windowStart: now };
    }

    data.count++;
    requestCounts.set(key, data);
    return data.count;
  }

  return async (req, res, next) => {
    const key = keyFn(req);
    let count;

    try {
      if (isRedisAvailable()) {
        const redis = getRedisConnection();
        if (redis) {
          count = await checkRedisRateLimit(redis, key);
        } else {
          count = checkMemoryRateLimit(key);
        }
      } else {
        count = checkMemoryRateLimit(key);
      }
    } catch {
      // If Redis fails, fall back to memory
      count = checkMemoryRateLimit(key);
    }

    // Set rate limit headers
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - count)));
    res.set('X-RateLimit-Reset', String(Math.ceil((Date.now() + windowMs) / 1000)));

    if (count > maxRequests) {
      return res.status(429).json({ error: message });
    }

    next();
  };
}

/**
 * Pre-configured rate limiters for different route types.
 */
export const apiLimiter = rateLimiter({
  windowMs: 60000,
  maxRequests: 100,
  message: 'API rate limit exceeded.',
});

export const uploadLimiterPerMinute = rateLimiter({
  windowMs: 60000,
  maxRequests: 20,
  keyFn: (req) => `upload-min:${req.user?.id || req.ip}`,
  message: 'Upload rate limit exceeded. Maximum 20 uploads per minute.',
  prefix: 'rl:upload-min',
});

export const uploadLimiterPerHour = rateLimiter({
  windowMs: 3600000,
  maxRequests: 100,
  keyFn: (req) => `upload-hr:${req.user?.id || req.ip}`,
  message: 'Upload rate limit exceeded. Maximum 100 uploads per hour.',
  prefix: 'rl:upload-hr',
});

export const authLimiter = rateLimiter({
  windowMs: 900000, // 15 minutes
  maxRequests: 10,
  message: 'Too many authentication attempts.',
});

export const webhookLimiter = rateLimiter({
  windowMs: 60000,
  maxRequests: 2000,
  keyFn: () => 'stripe-webhooks', // Use constant key — all Stripe webhooks share same IPs
  message: 'Webhook rate limit exceeded.',
});
