// ============================================================================
// Queue Monitor Worker — Daemonized Runner
// Long-running process that periodically collects queue metrics.
// Designed to run under PM2 without crash-looping.
// ============================================================================

import { getQueueDashboardData, checkQueueAlerts } from '../queueMonitor.js';

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const WORKER_NAME = 'queueMonitor';

let running = true;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Main Loop
// ---------------------------------------------------------------------------

async function poll(): Promise<void> {
  try {
    const dashboard = getQueueDashboardData();
    const alerts = checkQueueAlerts();

    if (alerts.length > 0) {
      console.log(`[${WORKER_NAME}] ${alerts.length} alert(s) detected:`);
      for (const alert of alerts) {
        console.log(`  [${alert.severity.toUpperCase()}] ${alert.workerName}: ${alert.message}`);
      }
    }

    console.log(
      `[${WORKER_NAME}] Poll: active=${dashboard.totalActiveJobs}, ` +
      `failed=${dashboard.totalFailedJobs}, completed=${dashboard.totalCompletedJobs}, ` +
      `workers=${dashboard.systemLoad.totalWorkers}`,
    );
  } catch (err) {
    console.error(`[${WORKER_NAME}] Poll error:`, err);
  }
}

async function mainLoop(): Promise<void> {
  console.log(`[${WORKER_NAME}] Starting queue monitor worker (poll every ${POLL_INTERVAL_MS / 1000}s)`);

  while (running) {
    await poll();
    await new Promise<void>((resolve) => {
      pollTimer = setTimeout(resolve, POLL_INTERVAL_MS);
    });
  }

  console.log(`[${WORKER_NAME}] Worker stopped gracefully`);
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

function shutdown(signal: string): void {
  console.log(`[${WORKER_NAME}] Received ${signal}, shutting down...`);
  running = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

mainLoop().catch((err) => {
  console.error(`[${WORKER_NAME}] Fatal error:`, err);
  process.exit(1);
});
