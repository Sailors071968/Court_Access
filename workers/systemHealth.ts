// ============================================
// Court Access — System Health Endpoint (Wave 0 Stabilization)
// Serves /api/system/health with worker, queue, database, and memory metrics.
// ============================================

import { getAllWorkerStatuses } from './registry';
import { getQueueDashboardData, checkQueueAlerts } from './queueMonitor';

// ---------------------------------------------------------------------------
// Health Check Types
// ---------------------------------------------------------------------------

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latencyMs: number | null;
  message: string;
  lastChecked: string;
}

export interface SystemHealthReport {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version: string;
  components: ComponentHealth[];
  workers: {
    total: number;
    active: number;
    paused: number;
    errored: number;
  };
  queues: {
    totalActiveJobs: number;
    totalFailedJobs: number;
    totalCompletedJobs: number;
    alerts: number;
  };
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
    externalMB: number;
    heapUsagePercent: number;
  };
  database: {
    postgres: ComponentHealth;
    neo4j: ComponentHealth;
  };
}

// ---------------------------------------------------------------------------
// Process Start Time (for uptime calculation)
// ---------------------------------------------------------------------------

const processStartTime = Date.now();

// ---------------------------------------------------------------------------
// Database Health Checks
// ---------------------------------------------------------------------------

export interface DatabasePingFn {
  (): Promise<{ latencyMs: number; ok: boolean; message: string }>;
}

/**
 * Check PostgreSQL connectivity.
 * In production, executes `SELECT 1` against the connection pool.
 * Pass in a real ping function when wiring up the endpoint.
 */
export async function checkPostgresHealth(
  pingFn?: DatabasePingFn,
): Promise<ComponentHealth> {
  const lastChecked = new Date().toISOString();

  if (!pingFn) {
    return {
      name: 'PostgreSQL',
      status: 'healthy',
      latencyMs: null,
      message: 'No ping function configured — health check skipped',
      lastChecked,
    };
  }

  try {
    const result = await pingFn();
    return {
      name: 'PostgreSQL',
      status: result.ok ? 'healthy' : 'unhealthy',
      latencyMs: result.latencyMs,
      message: result.message,
      lastChecked,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      name: 'PostgreSQL',
      status: 'unhealthy',
      latencyMs: null,
      message: `Connection failed: ${message}`,
      lastChecked,
    };
  }
}

/**
 * Check Neo4j connectivity.
 * In production, executes `RETURN 1` via the Neo4j driver.
 */
export async function checkNeo4jHealth(
  pingFn?: DatabasePingFn,
): Promise<ComponentHealth> {
  const lastChecked = new Date().toISOString();

  if (!pingFn) {
    return {
      name: 'Neo4j',
      status: 'healthy',
      latencyMs: null,
      message: 'No ping function configured — health check skipped',
      lastChecked,
    };
  }

  try {
    const result = await pingFn();
    return {
      name: 'Neo4j',
      status: result.ok ? 'healthy' : 'unhealthy',
      latencyMs: result.latencyMs,
      message: result.message,
      lastChecked,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      name: 'Neo4j',
      status: 'unhealthy',
      latencyMs: null,
      message: `Connection failed: ${message}`,
      lastChecked,
    };
  }
}

// ---------------------------------------------------------------------------
// Memory Metrics
// ---------------------------------------------------------------------------

export interface MemoryMetrics {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
  heapUsagePercent: number;
}

export function getMemoryMetrics(): MemoryMetrics {
  // In a browser environment, we estimate from performance API.
  // In Node.js, we'd use process.memoryUsage().
  // This provides a safe fallback for both environments.
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100;
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100;
    const rssMB = Math.round(mem.rss / 1024 / 1024 * 100) / 100;
    const externalMB = Math.round(mem.external / 1024 / 1024 * 100) / 100;
    return {
      heapUsedMB,
      heapTotalMB,
      rssMB,
      externalMB,
      heapUsagePercent: heapTotalMB > 0 ? Math.round(heapUsedMB / heapTotalMB * 100) : 0,
    };
  }

  // Fallback for browser environment
  return {
    heapUsedMB: 0,
    heapTotalMB: 0,
    rssMB: 0,
    externalMB: 0,
    heapUsagePercent: 0,
  };
}

// ---------------------------------------------------------------------------
// Full Health Report Assembly
// ---------------------------------------------------------------------------

/**
 * Build the complete system health report.
 * This is the main handler for GET /api/system/health.
 */
export async function getSystemHealthReport(options?: {
  postgresPing?: DatabasePingFn;
  neo4jPing?: DatabasePingFn;
  version?: string;
}): Promise<SystemHealthReport> {
  const { postgresPing, neo4jPing, version = '0.1.0-stabilization' } = options ?? {};

  // Run database health checks in parallel
  const [postgresHealth, neo4jHealth] = await Promise.all([
    checkPostgresHealth(postgresPing),
    checkNeo4jHealth(neo4jPing),
  ]);

  // Get worker statuses
  const workerStatuses = getAllWorkerStatuses();
  const activeWorkers = workerStatuses.filter((w) => w.state.status === 'running').length;
  const pausedWorkers = workerStatuses.filter((w) => w.state.status === 'paused').length;
  const erroredWorkers = workerStatuses.filter((w) => w.state.status === 'error').length;

  // Get queue data
  const queueData = getQueueDashboardData();
  const alerts = checkQueueAlerts();

  // Get memory
  const memory = getMemoryMetrics();

  // Determine overall status
  const components: ComponentHealth[] = [postgresHealth, neo4jHealth];
  let overallStatus: HealthStatus = 'healthy';

  if (components.some((c) => c.status === 'unhealthy')) {
    overallStatus = 'unhealthy';
  } else if (components.some((c) => c.status === 'degraded') || erroredWorkers > 0 || alerts.length > 0) {
    overallStatus = 'degraded';
  }

  // Memory pressure check
  if (memory.heapUsagePercent > 90) {
    overallStatus = 'unhealthy';
  } else if (memory.heapUsagePercent > 75) {
    overallStatus = overallStatus === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.round((Date.now() - processStartTime) / 1000),
    version,
    components,
    workers: {
      total: workerStatuses.length,
      active: activeWorkers,
      paused: pausedWorkers,
      errored: erroredWorkers,
    },
    queues: {
      totalActiveJobs: queueData.totalActiveJobs,
      totalFailedJobs: queueData.totalFailedJobs,
      totalCompletedJobs: queueData.totalCompletedJobs,
      alerts: alerts.length,
    },
    memory,
    database: {
      postgres: postgresHealth,
      neo4j: neo4jHealth,
    },
  };
}
