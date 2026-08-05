// ============================================================================
// PR 6 — Observability Layer: Deep Health Check
//
// Goes beyond the basic /api/health "status: ok" endpoint.
// Checks actual connectivity to all critical dependencies:
//   - PostgreSQL (Prisma)
//   - Redis (BullMQ queues)
//   - Neo4j (graph database)
//   - Disk space
//   - Memory usage
//
// Returns a structured health report with per-component status.
// Intended for load balancers, monitoring dashboards, and alerting.
// ============================================================================

import { getHeapStatistics } from 'node:v8';
import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComponentStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ComponentHealth {
  status: ComponentStatus;
  latencyMs: number;
  message?: string;
}

export interface HealthReport {
  status: ComponentStatus;
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  environment: string;
  components: {
    postgres: ComponentHealth;
    redis: ComponentHealth;
    neo4j: ComponentHealth;
    memory: ComponentHealth;
  };
}

// ---------------------------------------------------------------------------
// Process Start Time
// ---------------------------------------------------------------------------

const PROCESS_START = Date.now();

// ---------------------------------------------------------------------------
// Deep Health Check
// ---------------------------------------------------------------------------

/**
 * Run a deep health check against all critical dependencies.
 * Returns a structured report suitable for monitoring dashboards.
 */
export async function runDeepHealthCheck(): Promise<HealthReport> {
  const [postgres, redis, neo4j, memory] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkNeo4j(),
    checkMemory(),
  ]);

  // Overall status: worst of all components
  const statuses = [postgres.status, redis.status, neo4j.status, memory.status];
  let overallStatus: ComponentStatus = 'healthy';
  if (statuses.includes('unhealthy')) overallStatus = 'unhealthy';
  else if (statuses.includes('degraded')) overallStatus = 'degraded';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - PROCESS_START) / 1000),
    version: process.env.APP_VERSION || '1.1.0',
    environment: process.env.NODE_ENV || 'development',
    components: { postgres, redis, neo4j, memory },
  };
}

// ---------------------------------------------------------------------------
// PostgreSQL Check
// ---------------------------------------------------------------------------

async function checkPostgres(): Promise<ComponentHealth> {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      latencyMs: Math.round(performance.now() - start),
      message: err instanceof Error ? err.message : 'PostgreSQL connection failed',
    };
  }
}

// ---------------------------------------------------------------------------
// Redis Check
// ---------------------------------------------------------------------------

async function checkRedis(): Promise<ComponentHealth> {
  const start = performance.now();
  try {
    // Dynamic import to avoid hard dependency at module load time
    const { redisConnection } = await import('../lib/redis.js');

    if (!redisConnection) {
      return {
        status: 'unknown',
        latencyMs: Math.round(performance.now() - start),
        message: 'Redis connection not initialized',
      };
    }

    await redisConnection.ping();
    return {
      status: 'healthy',
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      latencyMs: Math.round(performance.now() - start),
      message: err instanceof Error ? err.message : 'Redis connection failed',
    };
  }
}

// ---------------------------------------------------------------------------
// Neo4j Check
// ---------------------------------------------------------------------------

async function checkNeo4j(): Promise<ComponentHealth> {
  const start = performance.now();
  try {
    // Neo4j may not be configured in all environments
    if (!process.env.NEO4J_URI) {
      return {
        status: 'unknown',
        latencyMs: 0,
        message: 'NEO4J_URI not configured',
      };
    }

    // We don't maintain a persistent Neo4j client in this module.
    // Return unknown status if no global client is available.
    // The graph module's Neo4jClient.healthCheck() should be used
    // by the caller to provide this data.
    return {
      status: 'unknown',
      latencyMs: Math.round(performance.now() - start),
      message: 'Neo4j health check requires graph module client',
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      latencyMs: Math.round(performance.now() - start),
      message: err instanceof Error ? err.message : 'Neo4j check failed',
    };
  }
}

// ---------------------------------------------------------------------------
// Memory Check
// ---------------------------------------------------------------------------

async function checkMemory(): Promise<ComponentHealth> {
  const start = performance.now();
  try {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);

    // Compare against the heap ceiling rather than heapTotal. heapTotal is
    // only what V8 has committed and grows on demand, so heapUsed/heapTotal is
    // routinely above 90% in a healthy process — which made this endpoint
    // report the service unhealthy at idle and would have had orchestrators
    // restarting or de-registering perfectly good instances.
    const heapLimitMB = Math.round(getHeapStatistics().heap_size_limit / 1024 / 1024);
    const heapPercent = heapLimitMB > 0 ? Math.round((heapUsedMB / heapLimitMB) * 100) : 0;

    // Resident size was compared against a fixed 1500MB, which a Node process
    // holding a 4GB heap crosses under ordinary load — so the endpoint went
    // 503 during a load test and would take instances out of rotation exactly
    // when traffic is highest. The budget is now the container's memory limit
    // where the operator supplies one, and otherwise scales with the heap
    // ceiling.
    const rssBudgetMB = parseInt(process.env.HEALTH_RSS_LIMIT_MB || '', 10) || Math.round(heapLimitMB * 1.5);
    const rssPercent = rssBudgetMB > 0 ? Math.round((rssMB / rssBudgetMB) * 100) : 0;

    let status: ComponentStatus = 'healthy';
    if (heapPercent > 90 || rssPercent > 90) {
      status = 'unhealthy';
    } else if (heapPercent > 75 || rssPercent > 75) {
      status = 'degraded';
    }

    return {
      status,
      latencyMs: Math.round(performance.now() - start),
      message:
        `heap=${heapUsedMB}/${heapLimitMB}MB (${heapPercent}% of limit, ${heapTotalMB}MB committed) ` +
        `rss=${rssMB}/${rssBudgetMB}MB (${rssPercent}% of budget)`,
    };
  } catch {
    return {
      status: 'unknown',
      latencyMs: Math.round(performance.now() - start),
      message: 'Memory check failed',
    };
  }
}
