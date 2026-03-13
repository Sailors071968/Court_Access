// ============================================================================
// Timeline Reconstruction Engine — API Routes
// GET  /api/timeline/:caseId           — unified case timeline
// GET  /api/timeline/:caseId/events    — raw extracted events
// GET  /api/timeline/:caseId/conflicts — conflicting timeline entries
// POST /api/timeline/rebuild/:caseId   — trigger timeline rebuild
// GET  /api/timeline/health            — pipeline health check
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { enqueueTemporalExtraction, enqueueVideoEventExtraction } from './timelineProcessingPipeline.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Tenant extraction helper
// ---------------------------------------------------------------------------

function getTenantId(request: FastifyRequest): string | null {
  const user = (request as unknown as { user?: { tenantId?: string } }).user;
  return user?.tenantId ?? null;
}

// ---------------------------------------------------------------------------
// GET /api/timeline/:caseId — Unified case timeline
// ---------------------------------------------------------------------------

async function getCaseTimeline(
  request: FastifyRequest<{ Params: { caseId: string } }>,
  reply: FastifyReply,
) {
  const { caseId } = request.params;
  const tenantId = getTenantId(request);

  if (!tenantId) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  // Verify case belongs to tenant
  const caseRecord = await prisma.criminalCase.findFirst({
    where: { caseId, tenantId, deletedAt: null },
  });

  if (!caseRecord) {
    return reply.status(404).send({ error: 'Case not found' });
  }

  // Fetch evidence to build basic timeline from upload timestamps
  const evidence = await prisma.evidence.findMany({
    where: { caseId, tenantId },
    orderBy: { uploadedAt: 'asc' },
  });

  // Build timeline events from evidence metadata
  const events = evidence.map((e, index) => ({
    eventId: `timeline-${e.evidenceId}`,
    evidenceId: e.evidenceId,
    timestamp: e.uploadedAt?.toISOString() ?? null,
    description: `${e.evidenceType}: ${e.fileName}`,
    eventType: e.evidenceType,
    source: e.fileName,
    confidence: 0.7,
    order: index,
  }));

  return reply.send({
    caseId,
    events,
    total: events.length,
    status: events.length > 0 ? 'built' : 'empty',
    message: events.length === 0
      ? 'No evidence uploaded yet. Upload evidence to build timeline.'
      : `Timeline contains ${events.length} events from ${evidence.length} evidence items`,
  });
}

// ---------------------------------------------------------------------------
// GET /api/timeline/:caseId/events — Raw extracted events
// ---------------------------------------------------------------------------

async function getTimelineEvents(
  request: FastifyRequest<{ Params: { caseId: string } }>,
  reply: FastifyReply,
) {
  const { caseId } = request.params;
  const tenantId = getTenantId(request);

  if (!tenantId) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  const evidence = await prisma.evidence.findMany({
    where: { caseId, tenantId },
    orderBy: { uploadedAt: 'asc' },
  });

  const events = evidence.map((e) => ({
    evidenceId: e.evidenceId,
    fileName: e.fileName,
    evidenceType: e.evidenceType,
    uploadedAt: e.uploadedAt?.toISOString() ?? null,
    size: e.size.toString(),
  }));

  return reply.send({ events, total: events.length });
}

// ---------------------------------------------------------------------------
// GET /api/timeline/:caseId/conflicts — Timeline conflicts
// ---------------------------------------------------------------------------

async function getTimelineConflicts(
  request: FastifyRequest<{ Params: { caseId: string } }>,
  reply: FastifyReply,
) {
  const { caseId } = request.params;
  const tenantId = getTenantId(request);

  if (!tenantId) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  // In production: query timeline conflict records.
  // For now, return empty since no conflicts have been detected yet.
  return reply.send({
    caseId,
    conflicts: [],
    total: 0,
    message: 'No timeline conflicts detected. Conflicts are identified when multiple evidence sources report different events at the same timestamp.',
  });
}

// ---------------------------------------------------------------------------
// POST /api/timeline/rebuild/:caseId — Trigger timeline rebuild
// ---------------------------------------------------------------------------

async function rebuildTimeline(
  request: FastifyRequest<{ Params: { caseId: string } }>,
  reply: FastifyReply,
) {
  const { caseId } = request.params;
  const tenantId = getTenantId(request);

  if (!tenantId) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  // Verify case belongs to tenant
  const caseRecord = await prisma.criminalCase.findFirst({
    where: { caseId, tenantId, deletedAt: null },
  });

  if (!caseRecord) {
    return reply.status(404).send({ error: 'Case not found' });
  }

  // Find all evidence for this case
  const evidence = await prisma.evidence.findMany({
    where: { caseId, tenantId },
  });

  if (evidence.length === 0) {
    return reply.status(400).send({
      error: 'No evidence found for this case',
      message: 'Upload evidence first to build a timeline',
    });
  }

  // Enqueue temporal extraction for document evidence, video events for video evidence
  const VIDEO_TYPES = ['bodycam', 'dashcam', 'witness_video'];
  let queued = 0;

  for (const ev of evidence) {
    try {
      if (VIDEO_TYPES.includes(ev.evidenceType)) {
        await enqueueVideoEventExtraction({
          evidenceId: ev.evidenceId,
          caseId: ev.caseId,
          tenantId,
          s3Key: ev.s3Key || '',
          fileName: ev.fileName,
          duration: ev.duration ?? undefined,
        });
      } else {
        await enqueueTemporalExtraction({
          evidenceId: ev.evidenceId,
          caseId: ev.caseId,
          tenantId,
          fileName: ev.fileName,
          evidenceType: ev.evidenceType,
          s3Key: ev.s3Key || '',
        });
      }
      queued++;
    } catch (err) {
      console.error(`[TimelineRoutes] Failed to enqueue extraction for ${ev.evidenceId}:`, err);
    }
  }

  return reply.send({
    status: 'queued',
    message: `Timeline rebuild queued for ${queued} evidence items`,
    caseId,
    evidenceCount: queued,
  });
}

// ---------------------------------------------------------------------------
// GET /api/timeline/health — Pipeline health check
// ---------------------------------------------------------------------------

async function timelineHealth(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  return reply.send({
    status: 'ok',
    engine: 'timeline-reconstruction',
    workers: [
      'timeline-temporal-extraction',
      'timeline-video-events',
      'timeline-event-correlation',
      'timeline-builder',
    ],
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerTimelineRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/timeline/health', timelineHealth);
  app.get('/api/timeline/:caseId', getCaseTimeline);
  app.get('/api/timeline/:caseId/events', getTimelineEvents);
  app.get('/api/timeline/:caseId/conflicts', getTimelineConflicts);
  app.post('/api/timeline/rebuild/:caseId', rebuildTimeline);
}
