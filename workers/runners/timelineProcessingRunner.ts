// ============================================================================
// Timeline Processing Worker — Daemonized Runner
// Long-running BullMQ-style worker for timeline reconstruction jobs.
// Polls for pending timeline jobs and processes them.
// ============================================================================

const POLL_INTERVAL_MS = 10_000; // 10 seconds
const WORKER_NAME = 'timelineProcessing';

let running = true;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Job Queue (in-memory, production uses BullMQ/Redis)
// ---------------------------------------------------------------------------

interface TimelineJob {
  id: string;
  caseId: string;
  tenantId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  error?: string;
}

const jobQueue: TimelineJob[] = [];

export function enqueueTimelineJob(caseId: string, tenantId: string): string {
  const id = `tj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  jobQueue.push({ id, caseId, tenantId, status: 'pending', createdAt: Date.now() });
  console.log(`[${WORKER_NAME}] Job enqueued: ${id} for case ${caseId}`);
  return id;
}

// ---------------------------------------------------------------------------
// Job Processing
// ---------------------------------------------------------------------------

async function processJob(job: TimelineJob): Promise<void> {
  job.status = 'processing';
  console.log(`[${WORKER_NAME}] Processing job ${job.id} for case ${job.caseId}...`);

  try {
    // Stub: In production, this runs temporal extraction, event correlation, conflict detection
    // For now, simulate processing delay
    await new Promise<void>(resolve => setTimeout(resolve, 100));
    
    job.status = 'completed';
    console.log(`[${WORKER_NAME}] Job ${job.id} completed`);
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
    console.error(`[${WORKER_NAME}] Job ${job.id} failed:`, err);
  }
}

// ---------------------------------------------------------------------------
// Main Loop
// ---------------------------------------------------------------------------

async function poll(): Promise<void> {
  const pendingJobs = jobQueue.filter(j => j.status === 'pending');
  
  if (pendingJobs.length > 0) {
    console.log(`[${WORKER_NAME}] ${pendingJobs.length} pending job(s)`);
    for (const job of pendingJobs) {
      if (!running) break;
      await processJob(job);
    }
  }

  // Cleanup old completed/failed jobs (keep last 1000)
  while (jobQueue.length > 1000) {
    const idx = jobQueue.findIndex(j => j.status === 'completed' || j.status === 'failed');
    if (idx >= 0) jobQueue.splice(idx, 1);
    else break;
  }
}

async function mainLoop(): Promise<void> {
  console.log(`[${WORKER_NAME}] Starting timeline processing worker (poll every ${POLL_INTERVAL_MS / 1000}s)`);

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
