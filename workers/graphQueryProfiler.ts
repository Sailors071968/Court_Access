// ============================================
// Court Access — Graph Query Profiler (Wave 1 Stabilization)
// Tracks Neo4j query latency and logs any query exceeding 200ms.
// Outputs to the monitoring system for early detection of graph
// scaling issues.
//
// Features:
//   - Per-query latency tracking
//   - Slow query log (>200ms threshold)
//   - Query pattern aggregation
//   - P50/P95/P99 latency percentiles
//   - Integration with systemHealth endpoint
// ============================================

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface QueryProfilerConfig {
  /** Threshold in milliseconds for slow query logging */
  slowQueryThresholdMs: number;
  /** Maximum number of slow queries to retain */
  maxSlowQueryLog: number;
  /** Maximum number of latency samples per query pattern */
  maxSamplesPerPattern: number;
  /** Whether profiling is enabled */
  enabled: boolean;
}

export const DEFAULT_PROFILER_CONFIG: QueryProfilerConfig = {
  slowQueryThresholdMs: 200,
  maxSlowQueryLog: 500,
  maxSamplesPerPattern: 200,
  enabled: true,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueryProfile {
  /** Cypher query string (or pattern) */
  query: string;
  /** Normalized query pattern for aggregation (parameterized) */
  pattern: string;
  /** Execution time in milliseconds */
  durationMs: number;
  /** Timestamp when the query was executed */
  timestamp: number;
  /** Number of rows returned */
  rowsReturned: number;
  /** Tenant ID for multi-tenant isolation */
  tenantId: string | null;
  /** Whether this was flagged as slow */
  isSlow: boolean;
  /** Optional operation context (e.g., "graphIntegrityCheck", "factExtraction") */
  context: string | null;
}

export interface PatternMetrics {
  /** Normalized query pattern */
  pattern: string;
  /** Total number of executions */
  totalExecutions: number;
  /** Average duration in milliseconds */
  avgDurationMs: number;
  /** P50 duration */
  p50DurationMs: number;
  /** P95 duration */
  p95DurationMs: number;
  /** P99 duration */
  p99DurationMs: number;
  /** Maximum duration observed */
  maxDurationMs: number;
  /** Minimum duration observed */
  minDurationMs: number;
  /** Number of times this pattern exceeded slow threshold */
  slowCount: number;
  /** Last execution timestamp */
  lastExecuted: number;
}

export interface ProfilerReport {
  timestamp: string;
  enabled: boolean;
  config: QueryProfilerConfig;
  totalQueries: number;
  totalSlowQueries: number;
  patterns: PatternMetrics[];
  recentSlowQueries: QueryProfile[];
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

// ---------------------------------------------------------------------------
// State (module-scoped singleton)
// ---------------------------------------------------------------------------

let config: QueryProfilerConfig = { ...DEFAULT_PROFILER_CONFIG };

/** Latency samples per normalized pattern */
const patternSamples: Map<string, number[]> = new Map();

/** Slow count per pattern */
const patternSlowCounts: Map<string, number> = new Map();

/** Total execution count per pattern */
const patternExecutionCounts: Map<string, number> = new Map();

/** Last execution time per pattern */
const patternLastExecuted: Map<string, number> = new Map();

/** Slow query log (most recent entries) */
const slowQueryLog: QueryProfile[] = [];

/** Global latency samples (for overall percentiles) */
const globalLatencySamples: number[] = [];
const MAX_GLOBAL_SAMPLES = 2000;

let totalQueries = 0;
let totalSlowQueries = 0;

// ---------------------------------------------------------------------------
// Query Pattern Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a Cypher query into a pattern by replacing literal values
 * with placeholders. This allows grouping similar queries for aggregation.
 *
 * Examples:
 *   "MATCH (n:Fact {id: 'abc123'}) RETURN n" → "MATCH (n:Fact {id: $param}) RETURN n"
 *   "MATCH (n) WHERE n.tenantId = '550e8400' RETURN n LIMIT 100"
 *     → "MATCH (n) WHERE n.tenantId = $param RETURN n LIMIT $param"
 */
export function normalizeQuery(query: string): string {
  return query
    // Replace quoted strings with $param
    .replace(/'[^']*'/g, '$param')
    .replace(/"[^"]*"/g, '$param')
    // Replace numbers with $param
    .replace(/\b\d+(\.\d+)?\b/g, '$param')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Percentile Calculation
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// ---------------------------------------------------------------------------
// Core Profiling API
// ---------------------------------------------------------------------------

/**
 * Record a completed Neo4j query execution.
 * Automatically flags slow queries and logs them.
 */
export function recordQuery(entry: {
  query: string;
  durationMs: number;
  rowsReturned?: number;
  tenantId?: string;
  context?: string;
}): QueryProfile {
  if (!config.enabled) {
    return {
      query: entry.query,
      pattern: '',
      durationMs: entry.durationMs,
      timestamp: Date.now(),
      rowsReturned: entry.rowsReturned ?? 0,
      tenantId: entry.tenantId ?? null,
      isSlow: false,
      context: entry.context ?? null,
    };
  }

  const pattern = normalizeQuery(entry.query);
  const isSlow = entry.durationMs > config.slowQueryThresholdMs;
  const now = Date.now();

  const profile: QueryProfile = {
    query: entry.query,
    pattern,
    durationMs: entry.durationMs,
    timestamp: now,
    rowsReturned: entry.rowsReturned ?? 0,
    tenantId: entry.tenantId ?? null,
    isSlow,
    context: entry.context ?? null,
  };

  totalQueries++;

  // Record per-pattern samples
  let samples = patternSamples.get(pattern);
  if (!samples) {
    samples = [];
    patternSamples.set(pattern, samples);
  }
  samples.push(entry.durationMs);
  if (samples.length > config.maxSamplesPerPattern) {
    samples.shift();
  }

  patternExecutionCounts.set(pattern, (patternExecutionCounts.get(pattern) ?? 0) + 1);
  patternLastExecuted.set(pattern, now);

  // Record global latency
  globalLatencySamples.push(entry.durationMs);
  if (globalLatencySamples.length > MAX_GLOBAL_SAMPLES) {
    globalLatencySamples.shift();
  }

  // Handle slow queries
  if (isSlow) {
    totalSlowQueries++;
    patternSlowCounts.set(pattern, (patternSlowCounts.get(pattern) ?? 0) + 1);

    slowQueryLog.push(profile);
    if (slowQueryLog.length > config.maxSlowQueryLog) {
      slowQueryLog.shift();
    }
  }

  return profile;
}

/**
 * Wrap a Neo4j query execution with automatic profiling.
 *
 * Usage:
 *   const result = await profileQuery(
 *     "MATCH (f:Fact {tenantId: $tid}) RETURN f",
 *     async () => await neo4j.run(query, params),
 *     { context: 'factExtraction' }
 *   );
 */
export async function profileQuery<T>(
  query: string,
  executor: () => Promise<T & { rowCount?: number }>,
  options?: { tenantId?: string; context?: string },
): Promise<T> {
  const start = Date.now();
  try {
    const result = await executor();
    const durationMs = Date.now() - start;
    recordQuery({
      query,
      durationMs,
      rowsReturned: (result as T & { rowCount?: number }).rowCount ?? 0,
      tenantId: options?.tenantId,
      context: options?.context,
    });
    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    recordQuery({
      query,
      durationMs,
      rowsReturned: 0,
      tenantId: options?.tenantId,
      context: options?.context,
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Metrics Retrieval
// ---------------------------------------------------------------------------

/**
 * Get metrics for a specific query pattern.
 */
export function getPatternMetrics(pattern: string): PatternMetrics | null {
  const samples = patternSamples.get(pattern);
  if (!samples || samples.length === 0) return null;

  const sorted = [...samples].sort((a, b) => a - b);
  const total = patternExecutionCounts.get(pattern) ?? 0;

  return {
    pattern,
    totalExecutions: total,
    avgDurationMs: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
    p50DurationMs: percentile(sorted, 50),
    p95DurationMs: percentile(sorted, 95),
    p99DurationMs: percentile(sorted, 99),
    maxDurationMs: sorted[sorted.length - 1],
    minDurationMs: sorted[0],
    slowCount: patternSlowCounts.get(pattern) ?? 0,
    lastExecuted: patternLastExecuted.get(pattern) ?? 0,
  };
}

/**
 * Get the full profiler report for the admin dashboard.
 */
export function getProfilerReport(): ProfilerReport {
  const patterns: PatternMetrics[] = [];
  for (const pattern of patternSamples.keys()) {
    const metrics = getPatternMetrics(pattern);
    if (metrics) patterns.push(metrics);
  }

  // Sort by slowest average
  patterns.sort((a, b) => b.avgDurationMs - a.avgDurationMs);

  const globalSorted = [...globalLatencySamples].sort((a, b) => a - b);
  const avgLatency = globalSorted.length > 0
    ? Math.round(globalSorted.reduce((a, b) => a + b, 0) / globalSorted.length)
    : 0;

  return {
    timestamp: new Date().toISOString(),
    enabled: config.enabled,
    config,
    totalQueries,
    totalSlowQueries,
    patterns,
    recentSlowQueries: slowQueryLog.slice(-20),
    avgLatencyMs: avgLatency,
    p95LatencyMs: percentile(globalSorted, 95),
    p99LatencyMs: percentile(globalSorted, 99),
  };
}

/**
 * Get only the slow query log (for focused admin view).
 */
export function getSlowQueries(limit: number = 50): QueryProfile[] {
  return slowQueryLog.slice(-limit);
}

/**
 * Get a quick summary for inclusion in the system health endpoint.
 */
export function getQueryProfileSummary(): {
  totalQueries: number;
  totalSlowQueries: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  slowQueryRate: number;
} {
  const sorted = [...globalLatencySamples].sort((a, b) => a - b);
  return {
    totalQueries,
    totalSlowQueries,
    avgLatencyMs: sorted.length > 0
      ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
      : 0,
    p95LatencyMs: percentile(sorted, 95),
    slowQueryRate: totalQueries > 0 ? Math.round((totalSlowQueries / totalQueries) * 10000) / 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Update profiler configuration at runtime.
 */
export function updateProfilerConfig(updates: Partial<QueryProfilerConfig>): void {
  config = { ...config, ...updates };
}

/**
 * Reset all profiler state. Intended for testing only.
 */
export function resetProfiler(): void {
  patternSamples.clear();
  patternSlowCounts.clear();
  patternExecutionCounts.clear();
  patternLastExecuted.clear();
  slowQueryLog.length = 0;
  globalLatencySamples.length = 0;
  totalQueries = 0;
  totalSlowQueries = 0;
  config = { ...DEFAULT_PROFILER_CONFIG };
}
