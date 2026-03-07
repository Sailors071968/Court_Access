// ============================================
// Court Access — Performance Profiler
// Phase 119: Production Hardening
//
// Logs slow operations to Redis metrics:
// - Graph queries >200ms
// - Timeline queries >200ms
// - Entity extraction >5s
// - API endpoints >500ms
//
// Provides dashboard metrics for System Health page.
// ============================================

import { getRedisConnection, isRedisAvailable } from './redisClient.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const THRESHOLDS = {
  graphQuery: 200,        // ms
  timelineQuery: 200,     // ms
  entityExtraction: 5000, // ms
  apiEndpoint: 500,       // ms
  aiAnalysis: 10000,      // ms
};

const METRICS_PREFIX = 'perf:metrics:';
const SLOW_LOG_PREFIX = 'perf:slow:';
const METRICS_TTL = 24 * 60 * 60; // 24 hours
const SLOW_LOG_MAX = 100; // Keep last 100 slow operations

// ---------------------------------------------------------------------------
// Core Profiling Functions
// ---------------------------------------------------------------------------

/**
 * Start a performance timer.
 *
 * @param {string} operationName - Name of the operation being timed
 * @returns {{ end: () => Promise<{ duration: number, slow: boolean }> }}
 */
export function startTimer(operationName) {
  const start = performance.now();

  return {
    /**
     * End the timer and record the metric.
     *
     * @param {object} metadata - Additional metadata to log
     * @returns {Promise<{ duration: number, slow: boolean }>}
     */
    async end(metadata = {}) {
      const duration = performance.now() - start;
      const category = categorizeOperation(operationName);
      const threshold = THRESHOLDS[category] || THRESHOLDS.apiEndpoint;
      const slow = duration > threshold;

      // Record metric
      await recordMetric(operationName, duration, category, slow, metadata);

      if (slow) {
        await logSlowOperation(operationName, duration, threshold, metadata);
      }

      return { duration, slow };
    },
  };
}

/**
 * Profile an async function and return its result.
 *
 * @param {string} operationName
 * @param {Function} fn - Async function to profile
 * @param {object} metadata
 * @returns {Promise<{ result: *, duration: number, slow: boolean }>}
 */
export async function profile(operationName, fn, metadata = {}) {
  const timer = startTimer(operationName);
  try {
    const result = await fn();
    const { duration, slow } = await timer.end(metadata);
    return { result, duration, slow };
  } catch (err) {
    await timer.end({ ...metadata, error: err.message });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Metric Recording
// ---------------------------------------------------------------------------

/**
 * Record a performance metric to Redis.
 */
async function recordMetric(operation, duration, category, slow, metadata) {
  if (!isRedisAvailable()) return;

  try {
    const redis = getRedisConnection();
    if (!redis) return;

    const now = Date.now();
    const hourBucket = Math.floor(now / 3600000);
    const metricKey = `${METRICS_PREFIX}${category}:${hourBucket}`;

    const pipeline = redis.pipeline();

    // Increment request count
    pipeline.hincrby(metricKey, 'count', 1);

    // Track total duration for average calculation
    pipeline.hincrbyfloat(metricKey, 'totalMs', duration);

    // Track slow count
    if (slow) {
      pipeline.hincrby(metricKey, 'slowCount', 1);
    }

    // Track min/max
    pipeline.hsetnx(metricKey, 'minMs', duration.toFixed(2));
    pipeline.hsetnx(metricKey, 'maxMs', duration.toFixed(2));

    // Set TTL
    pipeline.expire(metricKey, METRICS_TTL);

    await pipeline.exec();

    // Update min/max separately (atomic compare-and-set not available, so use Lua)
    const currentMin = parseFloat(await redis.hget(metricKey, 'minMs') || '99999');
    const currentMax = parseFloat(await redis.hget(metricKey, 'maxMs') || '0');

    if (duration < currentMin) {
      await redis.hset(metricKey, 'minMs', duration.toFixed(2));
    }
    if (duration > currentMax) {
      await redis.hset(metricKey, 'maxMs', duration.toFixed(2));
    }
  } catch (err) {
    // Profiling should never break the app
    console.error('[Profiler] Metric recording failed:', err.message);
  }
}

/**
 * Log a slow operation to Redis sorted set (for dashboard display).
 */
async function logSlowOperation(operation, duration, threshold, metadata) {
  if (!isRedisAvailable()) return;

  try {
    const redis = getRedisConnection();
    if (!redis) return;

    const now = Date.now();
    const logKey = `${SLOW_LOG_PREFIX}${categorizeOperation(operation)}`;

    const entry = JSON.stringify({
      operation,
      duration: Math.round(duration),
      threshold,
      metadata,
      timestamp: new Date(now).toISOString(),
    });

    // Add to sorted set (score = timestamp for ordering)
    await redis.zadd(logKey, now, entry);

    // Trim to keep only last N entries
    await redis.zremrangebyrank(logKey, 0, -(SLOW_LOG_MAX + 1));

    // Set TTL
    await redis.expire(logKey, METRICS_TTL);

    console.warn(`[Profiler] Slow operation: ${operation} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
  } catch {
    // Ignore logging errors
  }
}

// ---------------------------------------------------------------------------
// Dashboard Metrics
// ---------------------------------------------------------------------------

/**
 * Get performance summary for the dashboard.
 *
 * @returns {Promise<object>} Performance summary with per-category metrics
 */
export async function getPerformanceSummary() {
  const summary = {
    categories: {},
    slowOperations: [],
    timestamp: new Date().toISOString(),
  };

  if (!isRedisAvailable()) return summary;

  try {
    const redis = getRedisConnection();
    if (!redis) return summary;

    const hourBucket = Math.floor(Date.now() / 3600000);
    const categories = Object.keys(THRESHOLDS);

    for (const category of categories) {
      const metricKey = `${METRICS_PREFIX}${category}:${hourBucket}`;
      const data = await redis.hgetall(metricKey);

      if (data && data.count) {
        const count = parseInt(data.count, 10);
        const totalMs = parseFloat(data.totalMs || '0');

        summary.categories[category] = {
          count,
          averageMs: count > 0 ? (totalMs / count).toFixed(2) : 0,
          minMs: parseFloat(data.minMs || '0'),
          maxMs: parseFloat(data.maxMs || '0'),
          slowCount: parseInt(data.slowCount || '0', 10),
          threshold: THRESHOLDS[category],
        };
      }
    }

    // Get recent slow operations across all categories
    for (const category of categories) {
      const logKey = `${SLOW_LOG_PREFIX}${category}`;
      const entries = await redis.zrevrange(logKey, 0, 9); // Last 10 per category
      for (const entry of entries) {
        try {
          summary.slowOperations.push(JSON.parse(entry));
        } catch {
          // Skip malformed entries
        }
      }
    }

    // Sort slow operations by timestamp descending
    summary.slowOperations.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Limit to 20 total
    summary.slowOperations = summary.slowOperations.slice(0, 20);
  } catch (err) {
    console.error('[Profiler] Failed to get summary:', err.message);
  }

  return summary;
}

/**
 * Express middleware to profile API endpoints.
 */
export function profileMiddleware() {
  return (req, res, next) => {
    const timer = startTimer(`${req.method} ${req.route?.path || req.path}`);

    // Override res.json to capture response timing
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      timer.end({
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        userId: req.user?.id,
      }).catch(() => {}); // Ignore profiling errors
      return originalJson(body);
    };

    next();
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categorizeOperation(name) {
  if (name.includes('graph') || name.includes('Graph')) return 'graphQuery';
  if (name.includes('timeline') || name.includes('Timeline')) return 'timelineQuery';
  if (name.includes('entity') || name.includes('Entity') || name.includes('extract')) return 'entityExtraction';
  if (name.includes('ai') || name.includes('AI') || name.includes('analysis')) return 'aiAnalysis';
  return 'apiEndpoint';
}

export { THRESHOLDS };
