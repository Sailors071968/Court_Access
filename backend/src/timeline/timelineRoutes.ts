// ============================================================================
// Phase 3 — Timeline Reconstruction Engine Routes
// Real data-serving endpoints backed by PostgreSQL TimelineEvent records.
// POST routes enqueue BullMQ jobs via pipelineJobService for ACU-enforced
// timeline reconstruction (event extraction → merge → conflict detection).
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import {
  getTimeline,
  getTimelineEvents,
  getTimelineConflicts,
} from './timelineReconstructionService.js';
import { enqueueTimelineProcessing } from '../workers/pipelineJobService.js';
import { getQueueHealth } from '../lib/queues.js';

export async function registerTimelineRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/timeline/:caseId — Full timeline summary with events + conflicts
  app.get('/api/timeline/:caseId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    const tenantId = user.tenantId || 'dev-tenant';
    const { caseId } = request.params as { caseId: string };

    try {
      const timeline = await getTimeline(caseId, tenantId);
      return timeline;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: 'Failed to fetch timeline', message: msg });
    }
  });

  // GET /api/timeline/:caseId/events — Timeline events with filtering
  app.get('/api/timeline/:caseId/events', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    const tenantId = user.tenantId || 'dev-tenant';
    const { caseId } = request.params as { caseId: string };
    const query = request.query as {
      sourceType?: string;
      minConfidence?: string;
      conflictsOnly?: string;
      limit?: string;
      offset?: string;
    };

    try {
      const events = await getTimelineEvents(caseId, tenantId, {
        sourceType: query.sourceType,
        minConfidence: query.minConfidence ? parseFloat(query.minConfidence) : undefined,
        conflictsOnly: query.conflictsOnly === 'true',
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return events;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: 'Failed to fetch timeline events', message: msg });
    }
  });

  // GET /api/timeline/:caseId/conflicts — Timeline conflict data
  app.get('/api/timeline/:caseId/conflicts', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    const tenantId = user.tenantId || 'dev-tenant';
    const { caseId } = request.params as { caseId: string };

    try {
      const conflicts = await getTimelineConflicts(caseId, tenantId);
      return conflicts;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: 'Failed to fetch timeline conflicts', message: msg });
    }
  });

  // POST /api/timeline/rebuild/:caseId — Trigger timeline reconstruction via BullMQ
  app.post('/api/timeline/rebuild/:caseId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    const { caseId } = request.params as { caseId: string };

    try {
      const result = await enqueueTimelineProcessing({
        userId: user.userId,
        tenantId: user.tenantId,
        caseId,
      });
      return {
        caseId,
        status: result.status,
        jobId: result.jobId,
        processingJobId: result.processingJobId,
        message: 'Timeline reconstruction queued',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: 'Failed to enqueue timeline rebuild', message: msg });
    }
  });

  // POST /api/timeline/process — Trigger timeline processing (same as rebuild)
  app.post('/api/timeline/process', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    const body = request.body as { caseId?: string } | undefined;
    const caseId = body?.caseId;

    if (!caseId) {
      return reply.code(400).send({ error: 'Missing required field: caseId' });
    }

    try {
      const result = await enqueueTimelineProcessing({
        userId: user.userId,
        tenantId: user.tenantId,
        caseId,
      });
      return {
        caseId,
        status: result.status,
        jobId: result.jobId,
        processingJobId: result.processingJobId,
        message: 'Timeline processing queued',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: 'Failed to enqueue timeline processing', message: msg });
    }
  });

  // GET /api/timeline/health — Timeline engine health with queue stats
  app.get('/api/timeline/health', async () => {
    try {
      const queueHealth = await getQueueHealth();
      const timelineQueue = queueHealth.TIMELINE_BUILD ?? { waiting: -1, active: -1, completed: -1, failed: -1 };

      return {
        status: 'ok',
        engine: 'timeline-reconstruction',
        version: 'phase-3',
        queue: {
          name: 'TIMELINE_BUILD',
          waiting: timelineQueue.waiting,
          active: timelineQueue.active,
          completed: timelineQueue.completed,
          failed: timelineQueue.failed,
        },
      };
    } catch {
      return {
        status: 'degraded',
        engine: 'timeline-reconstruction',
        version: 'phase-3',
        queue: null,
        message: 'Queue health check failed',
      };
    }
  });

  console.log('[Server] Timeline reconstruction routes registered (Phase 3 — live)');
}
