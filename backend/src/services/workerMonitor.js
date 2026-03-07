// ============================================
// Court Access — Worker Heartbeat Monitor
// Phase 100: Worker stability — heartbeat monitoring + auto-restart
//
// Monitors all background workers and automatically restarts on failure.
// Tracks heartbeats in the database for admin visibility.
// ============================================

import prisma from './prismaClient.js';

const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const FAILURE_THRESHOLD_MS = 90000;  // 90 seconds without heartbeat = failed
const MAX_RESTART_ATTEMPTS = 5;

const workers = new Map(); // name → { start, stop, heartbeatTimer, status }

/**
 * Register a worker for monitoring.
 * @param name - Unique worker name
 * @param startFn - Async function that starts the worker, returns truthy on success
 * @param stopFn - Async function that stops the worker gracefully
 */
export function registerWorker(name, startFn, stopFn) {
  workers.set(name, {
    name,
    startFn,
    stopFn,
    heartbeatTimer: null,
    status: 'stopped',
    restartCount: 0,
    lastBeatAt: null,
  });
}

/**
 * Start a registered worker and begin heartbeat monitoring.
 */
export async function startWorker(name) {
  const worker = workers.get(name);
  if (!worker) {
    console.warn(`[WorkerMonitor] Unknown worker: ${name}`);
    return false;
  }

  try {
    const result = await worker.startFn();
    if (!result) {
      worker.status = 'stopped';
      await updateHeartbeatRecord(name, 'stopped');
      return false;
    }

    worker.status = 'running';
    worker.lastBeatAt = new Date();

    // Start heartbeat timer
    if (worker.heartbeatTimer) clearInterval(worker.heartbeatTimer);
    worker.heartbeatTimer = setInterval(() => sendHeartbeat(name), HEARTBEAT_INTERVAL_MS);
    if (worker.heartbeatTimer.unref) worker.heartbeatTimer.unref();

    await updateHeartbeatRecord(name, 'running');
    console.log(`[WorkerMonitor] Worker "${name}" started (restarts: ${worker.restartCount})`);
    return true;
  } catch (err) {
    console.error(`[WorkerMonitor] Failed to start worker "${name}": ${err.message}`);
    worker.status = 'failed';
    await updateHeartbeatRecord(name, 'failed');
    return false;
  }
}

/**
 * Stop a registered worker and clear heartbeat.
 */
export async function stopWorker(name) {
  const worker = workers.get(name);
  if (!worker) return;

  if (worker.heartbeatTimer) {
    clearInterval(worker.heartbeatTimer);
    worker.heartbeatTimer = null;
  }

  try {
    await worker.stopFn();
  } catch {
    // Ignore stop errors
  }

  worker.status = 'stopped';
  await updateHeartbeatRecord(name, 'stopped');
  console.log(`[WorkerMonitor] Worker "${name}" stopped`);
}

/**
 * Send a heartbeat for a worker.
 */
async function sendHeartbeat(name) {
  const worker = workers.get(name);
  if (!worker) return;

  worker.lastBeatAt = new Date();
  await updateHeartbeatRecord(name, worker.status).catch(() => {});
}

/**
 * Auto-restart a failed worker.
 */
async function autoRestart(name) {
  const worker = workers.get(name);
  if (!worker) return;

  if (worker.restartCount >= MAX_RESTART_ATTEMPTS) {
    console.error(`[WorkerMonitor] Worker "${name}" exceeded max restart attempts (${MAX_RESTART_ATTEMPTS})`);
    worker.status = 'failed';
    await updateHeartbeatRecord(name, 'failed');
    return;
  }

  console.warn(`[WorkerMonitor] Auto-restarting worker "${name}" (attempt ${worker.restartCount + 1}/${MAX_RESTART_ATTEMPTS})`);
  worker.status = 'restarting';
  worker.restartCount++;
  await updateHeartbeatRecord(name, 'restarting');

  // Stop first, then restart
  await stopWorker(name);
  await startWorker(name);
}

/**
 * Update heartbeat record in database.
 */
async function updateHeartbeatRecord(workerName, status) {
  try {
    const worker = workers.get(workerName);
    await prisma.workerHeartbeat.upsert({
      where: { workerName },
      update: {
        status,
        lastBeatAt: new Date(),
        restartCount: worker?.restartCount || 0,
        metadata: {
          lastBeatAt: new Date().toISOString(),
          uptime: worker?.lastBeatAt
            ? Math.floor((Date.now() - worker.lastBeatAt.getTime()) / 1000)
            : 0,
        },
      },
      create: {
        workerName,
        status,
        lastBeatAt: new Date(),
        startedAt: new Date(),
        restartCount: 0,
        metadata: {},
      },
    });
  } catch {
    // Database might not be ready yet — silently ignore
  }
}

/**
 * Health check: detect failed workers and auto-restart them.
 * Run this periodically (e.g. every 60 seconds).
 */
export function startHealthChecker() {
  const timer = setInterval(async () => {
    const now = Date.now();

    for (const [name, worker] of workers) {
      if (worker.status !== 'running') continue;

      const timeSinceLastBeat = worker.lastBeatAt
        ? now - worker.lastBeatAt.getTime()
        : Infinity;

      if (timeSinceLastBeat > FAILURE_THRESHOLD_MS) {
        console.warn(`[WorkerMonitor] Worker "${name}" appears dead (no heartbeat for ${Math.round(timeSinceLastBeat / 1000)}s)`);
        await autoRestart(name);
      }
    }
  }, 60000); // Check every 60 seconds

  if (timer.unref) timer.unref();
  return timer;
}

/**
 * Get status of all registered workers.
 */
export function getWorkerStatuses() {
  const statuses = [];
  for (const [name, worker] of workers) {
    statuses.push({
      name,
      status: worker.status,
      restartCount: worker.restartCount,
      lastBeatAt: worker.lastBeatAt?.toISOString() || null,
    });
  }
  return statuses;
}

/**
 * Stop all workers and clear all timers.
 */
export async function stopAllWorkers() {
  for (const [name] of workers) {
    await stopWorker(name);
  }
}
