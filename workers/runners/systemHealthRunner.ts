// ============================================================================
// System Health Worker — Daemonized Runner
// Long-running process that periodically checks system health metrics.
// Reports memory, worker status, and database connectivity.
// ============================================================================

import { getSystemHealthReport } from '../systemHealth.js';

const POLL_INTERVAL_MS = 60_000; // 60 seconds
const WORKER_NAME = 'systemHealth';

let running = true;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Main Loop
// ---------------------------------------------------------------------------

async function poll(): Promise<void> {
  try {
    const report = await getSystemHealthReport({ version: '1.1.0' });

    console.log(
      `[${WORKER_NAME}] Health: status=${report.status}, uptime=${report.uptime}s, ` +
      `heap=${report.memory.heapUsedMB}/${report.memory.heapTotalMB}MB (${report.memory.heapUsagePercent}%), ` +
      `workers=${report.workers.active}/${report.workers.total} active`,
    );

    if (report.status !== 'healthy') {
      console.warn(`[${WORKER_NAME}] System status: ${report.status}`);
      for (const component of report.components) {
        if (component.status !== 'healthy') {
          console.warn(`  [${component.status.toUpperCase()}] ${component.name}: ${component.message}`);
        }
      }
    }
  } catch (err) {
    console.error(`[${WORKER_NAME}] Poll error:`, err);
  }
}

async function mainLoop(): Promise<void> {
  console.log(`[${WORKER_NAME}] Starting system health worker (poll every ${POLL_INTERVAL_MS / 1000}s)`);

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
