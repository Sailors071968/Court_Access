#!/usr/bin/env node
// ============================================
// System Health Reporter — PM2 Worker Process
// Collects system health metrics every WORKER_INTERVAL_MS (default: 60s)
// ============================================

const INTERVAL_MS = parseInt(process.env.WORKER_INTERVAL_MS || '60000', 10);

console.log(`[systemHealth] Starting system health worker (interval: ${INTERVAL_MS}ms)`);

function getMemoryMetrics() {
  const mem = process.memoryUsage();
  return {
    heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
    heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
    rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
    externalMB: Math.round((mem.external / 1024 / 1024) * 100) / 100,
    heapUsagePercent: Math.round((mem.heapUsed / mem.heapTotal) * 10000) / 100,
  };
}

const processStartTime = Date.now();

async function tick() {
  const timestamp = new Date().toISOString();
  try {
    // In production, this would import and call getSystemHealthReport()
    // from workers/systemHealth.ts via a compiled bundle,
    // passing real database ping functions.
    const memory = getMemoryMetrics();
    const uptimeSeconds = Math.floor((Date.now() - processStartTime) / 1000);

    const report = {
      status: 'healthy',
      timestamp,
      uptime: uptimeSeconds,
      memory,
      workers: { total: 10, active: 0, paused: 0, errored: 0 },
      queues: { totalActiveJobs: 0, totalFailedJobs: 0, totalCompletedJobs: 0, alerts: 0 },
      database: {
        postgres: { status: 'degraded', message: 'No ping function configured' },
        neo4j: { status: 'degraded', message: 'No ping function configured' },
      },
    };

    console.log(
      `[systemHealth] ${timestamp} — status: ${report.status}, ` +
      `uptime: ${uptimeSeconds}s, heap: ${memory.heapUsagePercent}%, ` +
      `rss: ${memory.rssMB}MB, workers: ${report.workers.total}`
    );
  } catch (error) {
    console.error(`[systemHealth] ${timestamp} — Error:`, error.message || error);
  }
}

// Initial tick
tick();

// Schedule recurring ticks
setInterval(tick, INTERVAL_MS);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[systemHealth] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[systemHealth] Shutting down gracefully...');
  process.exit(0);
});
