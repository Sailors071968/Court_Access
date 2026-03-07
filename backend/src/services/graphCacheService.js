// ============================================
// Court Access — Graph Cache Service
// Phase 118: Graph Intelligence + AI Analysis Layer
//
// Redis caching for graph queries.
// Cache keys: case_graph, entity_neighbors, timeline_events, graph_insights
// TTL: 15 minutes
// Invalidation on: new document upload, entity extraction, graph rebuild
// ============================================

import { getRedisConnection, isRedisAvailable } from './redisClient.js';

// ---------------------------------------------------------------------------
// Cache Configuration
// ---------------------------------------------------------------------------

const CACHE_TTL = 15 * 60; // 15 minutes in seconds

const CACHE_PREFIXES = {
  CASE_GRAPH: 'graph:case:',
  ENTITY_NEIGHBORS: 'graph:neighbors:',
  TIMELINE_EVENTS: 'graph:timeline:',
  GRAPH_INSIGHTS: 'graph:insights:',
  GRAPH_STATS: 'graph:stats:',
  AI_ANALYSIS: 'graph:ai:',
  EVIDENCE_SCORES: 'graph:scores:',
};

// ---------------------------------------------------------------------------
// Cache Operations
// ---------------------------------------------------------------------------

/**
 * Get a cached value.
 *
 * @param {string} key - Cache key
 * @returns {Promise<object|null>}
 */
export async function getCached(key) {
  if (!isRedisAvailable()) return null;

  try {
    const redis = getRedisConnection();
    if (!redis) return null;

    const data = await redis.get(key);
    if (!data) return null;

    return JSON.parse(data);
  } catch (err) {
    console.error(`[GraphCache] Get error for ${key}:`, err.message);
    return null;
  }
}

/**
 * Set a cached value with TTL.
 *
 * @param {string} key - Cache key
 * @param {object} value - Value to cache
 * @param {number} ttl - TTL in seconds (default: 15 min)
 */
export async function setCached(key, value, ttl = CACHE_TTL) {
  if (!isRedisAvailable()) return;

  try {
    const redis = getRedisConnection();
    if (!redis) return;

    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (err) {
    console.error(`[GraphCache] Set error for ${key}:`, err.message);
  }
}

/**
 * Invalidate cache entries matching a pattern.
 *
 * @param {string} pattern - Key pattern (e.g., 'graph:case:abc*')
 */
export async function invalidateCache(pattern) {
  if (!isRedisAvailable()) return;

  try {
    const redis = getRedisConnection();
    if (!redis) return;

    // Use SCAN instead of KEYS to avoid blocking Redis
    let cursor = '0';
    let totalDeleted = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== '0');
    if (totalDeleted > 0) {
      console.log(`[GraphCache] Invalidated ${totalDeleted} keys matching ${pattern}`);
    }
  } catch (err) {
    console.error(`[GraphCache] Invalidation error for ${pattern}:`, err.message);
  }
}

// ---------------------------------------------------------------------------
// Cache Key Builders
// ---------------------------------------------------------------------------

/**
 * Build cache key for case graph.
 */
export function caseGraphKey(caseId, options = {}) {
  const suffix = Object.entries(options)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('&');
  return `${CACHE_PREFIXES.CASE_GRAPH}${caseId}${suffix ? ':' + suffix : ''}`;
}

/**
 * Build cache key for entity neighbors.
 */
export function entityNeighborsKey(entityId, options = {}) {
  return `${CACHE_PREFIXES.ENTITY_NEIGHBORS}${entityId}:d${options.depth || 1}`;
}

/**
 * Build cache key for timeline events.
 */
export function timelineEventsKey(caseId) {
  return `${CACHE_PREFIXES.TIMELINE_EVENTS}${caseId}`;
}

/**
 * Build cache key for graph insights.
 */
export function graphInsightsKey(caseId, type = '') {
  return `${CACHE_PREFIXES.GRAPH_INSIGHTS}${caseId}${type ? ':' + type : ''}`;
}

/**
 * Build cache key for graph stats.
 */
export function graphStatsKey(caseId) {
  return `${CACHE_PREFIXES.GRAPH_STATS}${caseId}`;
}

/**
 * Build cache key for AI analysis.
 */
export function aiAnalysisKey(caseId, analysisType) {
  return `${CACHE_PREFIXES.AI_ANALYSIS}${caseId}:${analysisType}`;
}

/**
 * Build cache key for evidence scores.
 */
export function evidenceScoresKey(caseId) {
  return `${CACHE_PREFIXES.EVIDENCE_SCORES}${caseId}`;
}

// ---------------------------------------------------------------------------
// Invalidation Helpers
// ---------------------------------------------------------------------------

/**
 * Invalidate all graph-related cache for a case.
 * Called when: new document uploaded, entity extraction runs, graph rebuild triggered.
 */
export async function invalidateCaseGraphCache(caseId) {
  await invalidateCache(`graph:*:${caseId}*`);
  console.log(`[GraphCache] Invalidated all graph cache for case ${caseId}`);
}

/**
 * Check if caching is available.
 */
export function isCacheAvailable() {
  return isRedisAvailable();
}
