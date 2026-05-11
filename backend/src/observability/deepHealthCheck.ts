// ============================================================================
// Observability Layer: Deep Health Check (Stage 1 Expansion)
//
// Goes beyond the basic /api/health "status: ok" endpoint.
// Checks actual connectivity to all critical dependencies:
//   - PostgreSQL (Prisma)
//   - Redis (passive — no queue activation)
//   - Neo4j (graph database)
//   - OCR system dependencies (passive — no OCR execution)
//   - Queue state (passive — no worker processing)
//   - Disk space
//   - Memory usage
//   - CPU load
//   - Infrastructure metadata
//
// Returns a structured health report with per-component status.
// Intended for load balancers, monitoring dashboards, and alerting.
// ============================================================================

import prisma from '../lib/prisma.js';
import { execSync } from 'node:child_process';
import os from 'node:os';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComponentStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown' | 'disabled';

export interface ComponentHealth {
  status: ComponentStatus;
  latencyMs: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthReport {
  status: ComponentStatus;
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  environment: string;
  infrastructure: {
    nodeEnv: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    hostname: string;
    pid: number;
    uptime: number;
    cpuCount: number;
    cpuLoad: number[];
    memoryTotal: number;
    memoryFree: number;
    memoryUsedPct: number;
  };
  components: {
    postgres: ComponentHealth;
    redis: ComponentHealth;
    neo4j: ComponentHealth;
    memory: ComponentHealth;
    disk: ComponentHealth;
    ocr: ComponentHealth;
    queues: ComponentHealth;
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
 *
 * IMPORTANT: All checks are PASSIVE ONLY.
 * - Redis: ping only, no queue activation
 * - OCR: tool availability check only, no OCR execution
 * - Queues: state reporting only, no worker processing
 */
export async function runDeepHealthCheck(): Promise<HealthReport> {
  const [postgres, redis, neo4j, memory, disk, ocr, queues] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkNeo4j(),
    checkMemory(),
    checkDisk(),
    checkOcrDependencies(),
    checkQueueState(),
  ]);

  // Overall status: worst of all components (ignoring 'disabled' and 'unknown')
  const activeStatuses = [postgres.status, redis.status, neo4j.status, memory.status, disk.status]
    .filter(s => s !== 'disabled' && s !== 'unknown');
  let overallStatus: ComponentStatus = 'healthy';
  if (activeStatuses.includes('unhealthy')) overallStatus = 'unhealthy';
  else if (activeStatuses.includes('degraded')) overallStatus = 'degraded';

  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - PROCESS_START) / 1000),
    version: process.env.APP_VERSION || '1.1.0',
    environment: process.env.NODE_ENV || 'development',
    infrastructure: {
      nodeEnv: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      pid: process.pid,
      uptime: Math.floor(process.uptime()),
      cpuCount: os.cpus().length,
      cpuLoad: os.loadavg(),
      memoryTotal: Math.round(totalMem / 1024 / 1024),
      memoryFree: Math.round(freeMem / 1024 / 1024),
      memoryUsedPct: Math.round(((totalMem - freeMem) / totalMem) * 100),
    },
    components: { postgres, redis, neo4j, memory, disk, ocr, queues },
  };
}

// ---------------------------------------------------------------------------
// PostgreSQL Check
// ---------------------------------------------------------------------------

async function checkPostgres(): Promise<ComponentHealth> {
  const start = performance.now();
  try {
    // Connectivity + latency check
    await prisma.$queryRaw`SELECT 1`;
    const latency = Math.round(performance.now() - start);

    // Connection pool info
    let poolInfo: Record<string, unknown> = {};
    try {
      const metrics = await prisma.$metrics.json();
      poolInfo = {
        activeConnections: metrics?.counters?.find((c: { key: string }) => c.key === 'prisma_pool_connections_open')?.value ?? 'n/a',
        idleConnections: metrics?.counters?.find((c: { key: string }) => c.key === 'prisma_pool_connections_idle')?.value ?? 'n/a',
      };
    } catch {
      // $metrics may not be available in all Prisma versions
      poolInfo = { note: 'Prisma metrics not available' };
    }

    return {
      status: latency > 500 ? 'degraded' : 'healthy',
      latencyMs: latency,
      message: latency > 500 ? `High query latency: ${latency}ms` : undefined,
      details: {
        queryLatencyMs: latency,
        ...poolInfo,
      },
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
// Redis Check (PASSIVE ONLY — no queue activation)
// ---------------------------------------------------------------------------

async function checkRedis(): Promise<ComponentHealth> {
  const start = performance.now();

  // If workers are disabled, still try to check Redis but mark as informational
  const workersDisabled = process.env.DISABLE_WORKERS === 'true';

  try {
    const { default: redisConn } = await import('../lib/redis.js');

    if (!redisConn) {
      return {
        status: workersDisabled ? 'disabled' : 'unknown',
        latencyMs: Math.round(performance.now() - start),
        message: 'Redis connection not initialized',
        details: { workersDisabled },
      };
    }

    // PASSIVE: ping only — no queue reads, no worker starts
    const pong = await redisConn.ping();
    const latency = Math.round(performance.now() - start);

    // Get connection info (passive)
    let redisInfo: Record<string, unknown> = {};
    try {
      const info = await redisConn.info('server');
      const clientInfo = await redisConn.info('clients');
      const memInfo = await redisConn.info('memory');

      redisInfo = {
        redisVersion: extractInfoString(info, 'redis_version'),
        connectedClients: extractInfoValue(memInfo, 'connected_clients') ?? extractInfoValue(clientInfo, 'connected_clients'),
        usedMemoryMB: Math.round((extractInfoValue(memInfo, 'used_memory') ?? 0) / 1024 / 1024),
        tlsEnabled: info.includes('tls_port') || (process.env.REDIS_URL?.startsWith('rediss://') ?? false),
        uptimeSeconds: extractInfoValue(info, 'uptime_in_seconds'),
      };
    } catch {
      redisInfo = { note: 'Redis INFO not available' };
    }

    return {
      status: pong === 'PONG' ? (latency > 100 ? 'degraded' : 'healthy') : 'degraded',
      latencyMs: latency,
      message: workersDisabled ? 'Redis reachable (workers disabled)' : undefined,
      details: {
        pingResponse: pong,
        workersDisabled,
        ...redisInfo,
      },
    };
  } catch (err) {
    return {
      status: workersDisabled ? 'disabled' : 'unhealthy',
      latencyMs: Math.round(performance.now() - start),
      message: err instanceof Error ? err.message : 'Redis connection failed',
      details: { workersDisabled },
    };
  }
}

// ---------------------------------------------------------------------------
// Neo4j Check
// ---------------------------------------------------------------------------

async function checkNeo4j(): Promise<ComponentHealth> {
  const start = performance.now();
  try {
    if (!process.env.NEO4J_URI) {
      return {
        status: 'unknown',
        latencyMs: 0,
        message: 'NEO4J_URI not configured',
      };
    }

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
    const externalMB = Math.round(usage.external / 1024 / 1024);
    const heapPercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

    let status: ComponentStatus = 'healthy';
    if (heapPercent > 90 || rssMB > 1500) {
      status = 'unhealthy';
    } else if (heapPercent > 75 || rssMB > 1000) {
      status = 'degraded';
    }

    return {
      status,
      latencyMs: Math.round(performance.now() - start),
      message: `heap=${heapUsedMB}/${heapTotalMB}MB (${heapPercent}%) rss=${rssMB}MB`,
      details: {
        heapUsedMB,
        heapTotalMB,
        heapPercent,
        rssMB,
        externalMB,
        arrayBuffersMB: Math.round(usage.arrayBuffers / 1024 / 1024),
      },
    };
  } catch {
    return {
      status: 'unknown',
      latencyMs: Math.round(performance.now() - start),
      message: 'Memory check failed',
    };
  }
}

// ---------------------------------------------------------------------------
// Disk Check
// ---------------------------------------------------------------------------

async function checkDisk(): Promise<ComponentHealth> {
  const start = performance.now();
  try {
    const dfOutput = execSync('df -BM / | tail -1', { timeout: 5000 }).toString().trim();
    const parts = dfOutput.split(/\s+/);
    const totalMB = parseInt(parts[1]) || 0;
    const usedMB = parseInt(parts[2]) || 0;
    const availMB = parseInt(parts[3]) || 0;
    const usePct = parseInt(parts[4]) || 0;

    let status: ComponentStatus = 'healthy';
    if (usePct > 95 || availMB < 500) {
      status = 'unhealthy';
    } else if (usePct > 85 || availMB < 2000) {
      status = 'degraded';
    }

    // Check tmp directory writable
    let tmpWritable = false;
    try {
      const tmpDir = process.env.OCR_TEMP_DIR || '/tmp';
      execSync(`touch ${tmpDir}/.health_check_test && rm ${tmpDir}/.health_check_test`, { timeout: 2000 });
      tmpWritable = true;
    } catch { /* ignore */ }

    return {
      status,
      latencyMs: Math.round(performance.now() - start),
      message: `${usePct}% used, ${availMB}MB available`,
      details: {
        totalMB,
        usedMB,
        availableMB: availMB,
        usePercent: usePct,
        tmpWritable,
      },
    };
  } catch {
    return {
      status: 'unknown',
      latencyMs: Math.round(performance.now() - start),
      message: 'Disk check failed',
    };
  }
}

// ---------------------------------------------------------------------------
// OCR Dependencies Check (PASSIVE — no OCR execution)
// ---------------------------------------------------------------------------

async function checkOcrDependencies(): Promise<ComponentHealth> {
  const start = performance.now();
  const details: Record<string, unknown> = {};

  try {
    // Check pdftoppm
    try {
      const version = execSync('pdftoppm -v 2>&1 || true', { timeout: 3000 }).toString().trim();
      details.pdftoppm = { installed: true, version: version.split('\n')[0] };
    } catch {
      details.pdftoppm = { installed: false };
    }

    // Check ImageMagick (convert)
    try {
      const version = execSync('convert --version 2>&1 | head -1 || true', { timeout: 3000 }).toString().trim();
      details.imageMagick = { installed: version.includes('ImageMagick'), version: version.split('\n')[0] };
    } catch {
      details.imageMagick = { installed: false };
    }

    // Check tesseract
    try {
      const version = execSync('tesseract --version 2>&1 | head -1 || true', { timeout: 3000 }).toString().trim();
      details.tesseract = { installed: version.includes('tesseract'), version: version.split('\n')[0] };
    } catch {
      details.tesseract = { installed: false };
    }

    // Check temp directory
    const tmpDir = process.env.OCR_TEMP_DIR || '/tmp';
    try {
      const dfTmp = execSync(`df -BM ${tmpDir} | tail -1`, { timeout: 3000 }).toString().trim();
      const tmpParts = dfTmp.split(/\s+/);
      details.tempStorage = {
        path: tmpDir,
        availableMB: parseInt(tmpParts[3]) || 0,
        writable: true,
      };
    } catch {
      details.tempStorage = { path: tmpDir, writable: false };
    }

    const pdftoppmOk = (details.pdftoppm as Record<string, unknown>)?.installed === true;
    const imageMagickOk = (details.imageMagick as Record<string, unknown>)?.installed === true;
    const tesseractOk = (details.tesseract as Record<string, unknown>)?.installed === true;
    const allInstalled = pdftoppmOk && imageMagickOk && tesseractOk;

    return {
      status: allInstalled ? 'healthy' : 'degraded',
      latencyMs: Math.round(performance.now() - start),
      message: allInstalled
        ? 'All OCR dependencies installed (not yet activated)'
        : `Missing: ${[!pdftoppmOk && 'pdftoppm', !imageMagickOk && 'ImageMagick', !tesseractOk && 'tesseract'].filter(Boolean).join(', ')}`,
      details,
    };
  } catch {
    return {
      status: 'unknown',
      latencyMs: Math.round(performance.now() - start),
      message: 'OCR dependency check failed',
      details,
    };
  }
}

// ---------------------------------------------------------------------------
// Queue State Check (PASSIVE — no worker processing)
// ---------------------------------------------------------------------------

async function checkQueueState(): Promise<ComponentHealth> {
  const start = performance.now();
  const workersDisabled = process.env.DISABLE_WORKERS === 'true';

  const registeredQueues = [
    'timeline-processing',
    'narrative-processing',
    'contradiction-analysis',
    'video-processing',
    'doctrine-analysis',
  ];

  try {
    // Import worker health function (passive — just reads stats)
    const { getPipelineWorkerHealth } = await import('../workers/startPipelineWorkers.js');
    const workerHealth = getPipelineWorkerHealth();

    return {
      status: workersDisabled ? 'disabled' : 'healthy',
      latencyMs: Math.round(performance.now() - start),
      message: workersDisabled ? 'Workers disabled (DISABLE_WORKERS=true)' : 'Workers active',
      details: {
        workersDisabled,
        registeredQueues,
        queueCount: registeredQueues.length,
        workers: workerHealth.map(w => ({
          name: w.name,
          running: w.running,
          processed: w.processed,
          failed: w.failed,
          stalled: w.stalled,
        })),
      },
    };
  } catch (err) {
    return {
      status: workersDisabled ? 'disabled' : 'unknown',
      latencyMs: Math.round(performance.now() - start),
      message: workersDisabled
        ? 'Workers disabled — queue state unavailable'
        : (err instanceof Error ? err.message : 'Queue state check failed'),
      details: {
        workersDisabled,
        registeredQueues,
        queueCount: registeredQueues.length,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Helper: Extract value from Redis INFO string
// ---------------------------------------------------------------------------

function extractInfoValue(info: string, key: string): number | null {
  const match = info.match(new RegExp(`${key}:(\\d+)`));
  return match ? parseInt(match[1], 10) : null;
}

function extractInfoString(info: string, key: string): string | null {
  const match = info.match(new RegExp(`${key}:(.+?)\\r?\\n`));
  return match ? match[1].trim() : null;
}
