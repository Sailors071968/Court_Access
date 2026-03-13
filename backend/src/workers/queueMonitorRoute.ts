// ============================================================================
// Production Security Patch — Queue Monitor Dashboard Route
// PART 5: Exposes /ops/queues for Redis/BullMQ job visibility
//
// Displays: active jobs, failed jobs, stalled jobs, job duration, queue backlog
//
// Usage:
//   import { registerQueueMonitorRoutes } from './workers/queueMonitorRoute.js';
//   await registerQueueMonitorRoutes(app);
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { extractBearerToken, verifyAccessToken } from '../security/authMiddleware.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueSnapshot {
  name: string;
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  stalled: number;
  delayed: number;
  avgDurationMs: number;
  lastJobAt: string | null;
}

interface QueueDashboard {
  timestamp: string;
  totalQueues: number;
  totalActive: number;
  totalWaiting: number;
  totalFailed: number;
  totalStalled: number;
  queues: QueueSnapshot[];
  systemStatus: 'healthy' | 'degraded' | 'critical';
}

// ---------------------------------------------------------------------------
// In-memory queue tracking (production would query Redis/BullMQ directly)
// ---------------------------------------------------------------------------

const queueRegistry = new Map<string, QueueSnapshot>();

// Pre-register known queues
const KNOWN_QUEUES = [
  'agencyCrawler', 'policyDiscovery', 'download', 'ocr',
  'classification', 'cpraCampaign', 'annualUpdate',
  'aiAnalysis', 'transcription', 'evidenceIngest',
  'factExtraction', 'graphSync', 'video-segment-queue',
];

for (const name of KNOWN_QUEUES) {
  queueRegistry.set(name, {
    name,
    active: 0,
    waiting: 0,
    completed: 0,
    failed: 0,
    stalled: 0,
    delayed: 0,
    avgDurationMs: 0,
    lastJobAt: null,
  });
}

// ---------------------------------------------------------------------------
// Queue tracking API (called by workers)
// ---------------------------------------------------------------------------

export function updateQueueMetrics(name: string, metrics: Partial<QueueSnapshot>): void {
  const existing = queueRegistry.get(name) ?? {
    name, active: 0, waiting: 0, completed: 0, failed: 0,
    stalled: 0, delayed: 0, avgDurationMs: 0, lastJobAt: null,
  };
  queueRegistry.set(name, { ...existing, ...metrics, name });
}

export function recordJobCompletion(name: string, durationMs: number): void {
  const q = queueRegistry.get(name);
  if (q) {
    q.completed++;
    q.active = Math.max(0, q.active - 1);
    // Rolling average
    q.avgDurationMs = q.avgDurationMs === 0
      ? durationMs
      : Math.round((q.avgDurationMs * 0.9) + (durationMs * 0.1));
    q.lastJobAt = new Date().toISOString();
  }
}

export function recordJobFailure(name: string): void {
  const q = queueRegistry.get(name);
  if (q) {
    q.failed++;
    q.active = Math.max(0, q.active - 1);
    q.lastJobAt = new Date().toISOString();
  }
}

// ---------------------------------------------------------------------------
// Dashboard Assembly
// ---------------------------------------------------------------------------

function buildDashboard(): QueueDashboard {
  const queues = Array.from(queueRegistry.values());
  const totalActive = queues.reduce((s, q) => s + q.active, 0);
  const totalWaiting = queues.reduce((s, q) => s + q.waiting, 0);
  const totalFailed = queues.reduce((s, q) => s + q.failed, 0);
  const totalStalled = queues.reduce((s, q) => s + q.stalled, 0);

  let systemStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (totalStalled > 0 || totalFailed > 50) systemStatus = 'critical';
  else if (totalFailed > 10 || totalWaiting > 100) systemStatus = 'degraded';

  return {
    timestamp: new Date().toISOString(),
    totalQueues: queues.length,
    totalActive,
    totalWaiting,
    totalFailed,
    totalStalled,
    queues,
    systemStatus,
  };
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Auth guard for /ops/ routes (these bypass the global auth hook)
// ---------------------------------------------------------------------------

async function requireOpsAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    reply.code(401).send({ error: 'Authentication required', message: 'Ops routes require a valid Bearer token' });
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    if (payload.role !== 'admin' && payload.role !== 'staff') {
      reply.code(403).send({ error: 'Forbidden', message: 'Ops routes require admin or staff role' });
      return;
    }
  } catch {
    reply.code(401).send({ error: 'Invalid or expired token' });
    return;
  }
}

export async function registerQueueMonitorRoutes(app: FastifyInstance): Promise<void> {
  // GET /ops/queues — Queue monitoring dashboard (JSON)
  app.get('/ops/queues', { preHandler: [requireOpsAuth] }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    const dashboard = buildDashboard();
    return { success: true, data: dashboard };
  });

  // GET /ops/queues/:name — Individual queue details
  app.get('/ops/queues/:name', { preHandler: [requireOpsAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name } = request.params as { name: string };
    const queue = queueRegistry.get(name);
    if (!queue) {
      return reply.code(404).send({ error: `Queue "${name}" not found` });
    }
    return { success: true, data: queue };
  });

  // POST /ops/queues/:name/retry — Retry failed jobs in a queue
  app.post('/ops/queues/:name/retry', { preHandler: [requireOpsAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name } = request.params as { name: string };
    const queue = queueRegistry.get(name);
    if (!queue) {
      return reply.code(404).send({ error: `Queue "${name}" not found` });
    }
    // In production with real BullMQ, this would call queue.retryAll()
    const retriedCount = queue.failed;
    queue.waiting += queue.failed;
    queue.failed = 0;
    return { success: true, message: `${retriedCount} failed jobs moved to waiting`, queue: name };
  });

  // GET /ops/health — Quick health summary
  app.get('/ops/health', { preHandler: [requireOpsAuth] }, async () => {
    const dashboard = buildDashboard();
    return {
      status: dashboard.systemStatus,
      totalActive: dashboard.totalActive,
      totalFailed: dashboard.totalFailed,
      totalStalled: dashboard.totalStalled,
      queueCount: dashboard.totalQueues,
    };
  });

  console.log('[Server] Queue monitor routes registered at /ops/queues');
}
