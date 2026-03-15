// ============================================================================
// Graph Integrity Check Worker — Daemonized Runner
// Long-running process that periodically validates Neo4j graph consistency.
// Runs every 6 hours by default.
// ============================================================================

import { runFullIntegrityReport, extractAlerts } from '../graphIntegrityCheck.js';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const WORKER_NAME = 'graphIntegrityCheck';

let running = true;
let checkTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Neo4j Query Stub
// In production, replace with actual Neo4j driver session.run()
// ---------------------------------------------------------------------------

async function executeNeo4jQuery(_cypher: string): Promise<Record<string, unknown>[]> {
  // Stub: returns empty results (no issues detected)
  // When Neo4j is connected, this will execute the actual Cypher query
  return [];
}

// ---------------------------------------------------------------------------
// Main Loop
// ---------------------------------------------------------------------------

async function runCheck(): Promise<void> {
  try {
    console.log(`[${WORKER_NAME}] Running graph integrity checks...`);
    const report = await runFullIntegrityReport(executeNeo4jQuery);
    const alerts = extractAlerts(report);

    console.log(
      `[${WORKER_NAME}] Integrity report: ${report.passedChecks}/${report.totalChecks} passed, ` +
      `${report.totalIssues} issues, ${report.executionDurationMs}ms`,
    );

    if (alerts.length > 0) {
      console.warn(`[${WORKER_NAME}] ${alerts.length} alert(s):`);
      for (const alert of alerts) {
        console.warn(`  [${alert.severity.toUpperCase()}] ${alert.checkName}: ${alert.message}`);
      }
    }
  } catch (err) {
    console.error(`[${WORKER_NAME}] Check error:`, err);
  }
}

async function mainLoop(): Promise<void> {
  console.log(`[${WORKER_NAME}] Starting graph integrity worker (check every ${CHECK_INTERVAL_MS / 3600000}h)`);

  // Run initial check
  await runCheck();

  while (running) {
    await new Promise<void>((resolve) => {
      checkTimer = setTimeout(resolve, CHECK_INTERVAL_MS);
    });
    if (running) {
      await runCheck();
    }
  }

  console.log(`[${WORKER_NAME}] Worker stopped gracefully`);
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

function shutdown(signal: string): void {
  console.log(`[${WORKER_NAME}] Received ${signal}, shutting down...`);
  running = false;
  if (checkTimer) {
    clearTimeout(checkTimer);
    checkTimer = null;
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
