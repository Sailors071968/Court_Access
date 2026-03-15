// ============================================================================
// Phase 2 — Pipeline Worker Startup
// Starts all 5 ACU-enforced BullMQ workers during server initialization.
// Each worker extends CourtAccessWorker which provides:
//   - Atomic ACU credit reservation before processing
//   - Automatic refund on processing failure
//   - Structured logging and graceful shutdown
// ============================================================================

import { timelineProcessingWorker } from './timelineProcessingWorker.js';
import { narrativeProcessingWorker } from './narrativeProcessingWorker.js';
import { contradictionAnalysisWorker } from './contradictionAnalysisWorker.js';
import { videoProcessingWorker } from './videoProcessingWorker.js';
import { doctrineAnalysisWorker } from './doctrineAnalysisWorker.js';

// ---------------------------------------------------------------------------
// Worker Registry
// ---------------------------------------------------------------------------

const pipelineWorkers = [
  timelineProcessingWorker,
  narrativeProcessingWorker,
  contradictionAnalysisWorker,
  videoProcessingWorker,
  doctrineAnalysisWorker,
] as const;

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

/**
 * Start all ACU-enforced pipeline workers.
 * Call this once during server startup after Redis connection is established.
 * Workers will not start if DISABLE_WORKERS env var is set (useful for web-only deploys).
 */
export function startPipelineWorkers(): void {
  if (process.env.DISABLE_WORKERS === 'true') {
    console.log('[PipelineWorkers] Workers disabled via DISABLE_WORKERS env var');
    return;
  }

  console.log('[PipelineWorkers] Starting 5 ACU-enforced pipeline workers...');

  for (const worker of pipelineWorkers) {
    worker.start();
  }

  console.log('[PipelineWorkers] All pipeline workers started');
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

/**
 * Gracefully stop all pipeline workers.
 * Waits for active jobs to complete before closing.
 */
export async function stopPipelineWorkers(): Promise<void> {
  console.log('[PipelineWorkers] Stopping all pipeline workers...');

  await Promise.all(pipelineWorkers.map((w) => w.stop()));

  console.log('[PipelineWorkers] All pipeline workers stopped');
}
