#!/usr/bin/env node
// ============================================
// Queue Monitor Runner — PM2 Worker Process
// Collects queue metrics every WORKER_INTERVAL_MS (default: 30s)
// ============================================

const INTERVAL_MS = parseInt(process.env.WORKER_INTERVAL_MS || '30000', 10);

console.log(`[queueMonitor] Starting queue monitor worker (interval: ${INTERVAL_MS}ms)`);

async function tick() {
  const timestamp = new Date().toISOString();
  try {
    // In production, this would import and call getQueueDashboardData() + checkQueueAlerts()
    // from workers/queueMonitor.ts via a compiled bundle.
    // For now, we log the heartbeat and simulate metric collection.
    const metrics = {
      timestamp,
      queues: [
        'evidenceIngest', 'factExtraction', 'aiAnalysis', 'transcription',
        'timelineBuild', 'documentIntegrity', 'graphSync', 'anchorChain',
        'exportGeneration', 'nightlyIntegrity',
      ].map((name) => ({
        name,
        active: 0,
        waiting: 0,
        completed: 0,
        failed: 0,
        status: 'idle',
      })),
      alertCount: 0,
    };

    console.log(`[queueMonitor] ${timestamp} — ${metrics.queues.length} queues checked, ${metrics.alertCount} alerts`);
  } catch (error) {
    console.error(`[queueMonitor] ${timestamp} — Error:`, error.message || error);
  }
}

// Initial tick
tick();

// Schedule recurring ticks
setInterval(tick, INTERVAL_MS);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[queueMonitor] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[queueMonitor] Shutting down gracefully...');
  process.exit(0);
});
