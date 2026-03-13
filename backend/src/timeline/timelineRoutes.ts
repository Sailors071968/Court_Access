// ============================================================================
// Timeline Reconstruction Engine — API Routes
// GET  /api/timeline/:caseId          — full timeline with events
// GET  /api/timeline/:caseId/events   — event list with filters
// GET  /api/timeline/:caseId/conflicts — conflicting events
// POST /api/timeline/rebuild/:caseId  — trigger full rebuild
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { enqueueTimelineBuild } from './timelineProcessingPipeline.js';
import { buildTimelineGraph } from './timelineGraphIntegration.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Tenant extraction helper (mirrors evidence/caseRoutes pattern)
// ---------------------------------------------------------------------------

function getTenantId(request: FastifyRequest): string | null {
  const user = (request as unknown as { user?: { tenantId?: string } }).user;
  return user?.tenantId ?? null;
}

// ---------------------------------------------------------------------------
// GET /api/timeline/:caseId — Full timeline with events and graph
// ---------------------------------------------------------------------------

async function getTimeline(
  request: FastifyRequest<{ Params: { caseId: string } }>,
  reply: FastifyReply,
) {
  const { caseId } = request.params;
  const tenantId = getTenantId(request);

  if (!tenantId) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  // Fetch case timeline record (with tenant isolation)
  const timeline = await prisma.caseTimeline.findFirst({
    where: { caseId, tenantId },
  });

  // Fetch all events sorted by timestamp
  const events = await prisma.timelineEvent.findMany({
    where: { caseId, tenantId },
    orderBy: { timestamp: 'asc' },
  });

  // Build graph representation
  const graph = buildTimelineGraph({
    caseId,
    events: events.map((e) => ({
      eventId: e.eventId,
      eventType: e.eventType,
      timestamp: e.timestamp.toISOString(),
      confidence: e.confidence,
      sourceType: e.sourceType,
      sourceEvidenceId: e.sourceEvidenceId,
      description: e.description,
      correlationGroup: e.correlationGroup,
    })),
    conflicts: timeline?.metadata
      ? ((timeline.metadata as Record<string, unknown>).conflictDetails as Array<{
          eventIdA: string;
          eventIdB: string;
          type: string;
          description: string;
        }>)?.map((c) => ({ ...c, conflictType: c.type })) ?? []
      : [],
  });

  return reply.send({
    timeline: timeline
      ? {
          timelineId: timeline.timelineId,
          caseId: timeline.caseId,
          status: timeline.status,
          eventCount: timeline.eventCount,
          conflictCount: timeline.conflictCount,
          clockOffsets: timeline.clockOffsets,
          builtAt: timeline.builtAt?.toISOString() ?? null,
        }
      : null,
    events: events.map((e) => ({
      eventId: e.eventId,
      caseId: e.caseId,
      sourceEvidenceId: e.sourceEvidenceId,
      eventType: e.eventType,
      timestamp: e.timestamp.toISOString(),
      endTimestamp: e.endTimestamp?.toISOString() ?? null,
      confidence: e.confidence,
      sourceType: e.sourceType,
      description: e.description,
      rawText: e.rawText,
      metadata: e.metadata,
      correlationGroup: e.correlationGroup,
    })),
    graph,
  });
}

// ---------------------------------------------------------------------------
// GET /api/timeline/:caseId/events — Filtered event list
// ---------------------------------------------------------------------------

async function getTimelineEvents(
  request: FastifyRequest<{
    Params: { caseId: string };
    Querystring: {
      sourceType?: string;
      eventType?: string;
      minConfidence?: string;
      correlationGroup?: string;
      limit?: string;
      offset?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const { caseId } = request.params;
  const tenantId = getTenantId(request);

  if (!tenantId) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  const query = request.query;
  const minConfidenceRaw = query.minConfidence ? parseFloat(query.minConfidence) : undefined;
  const minConfidence = minConfidenceRaw !== undefined && !isNaN(minConfidenceRaw) ? minConfidenceRaw : undefined;
  const limitRaw = query.limit ? parseInt(query.limit, 10) : 100;
  const limit = isNaN(limitRaw) || limitRaw < 0 ? 100 : limitRaw;
  const offsetRaw = query.offset ? parseInt(query.offset, 10) : 0;
  const offset = isNaN(offsetRaw) || offsetRaw < 0 ? 0 : offsetRaw;

  const where: Record<string, unknown> = { caseId, tenantId };
  if (query.sourceType) where.sourceType = query.sourceType;
  if (query.eventType) where.eventType = query.eventType;
  if (minConfidence !== undefined) where.confidence = { gte: minConfidence };
  if (query.correlationGroup) where.correlationGroup = query.correlationGroup;

  const [events, total] = await Promise.all([
    prisma.timelineEvent.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: limit,
      skip: offset,
    }),
    prisma.timelineEvent.count({ where }),
  ]);

  return reply.send({
    events: events.map((e) => ({
      eventId: e.eventId,
      caseId: e.caseId,
      sourceEvidenceId: e.sourceEvidenceId,
      eventType: e.eventType,
      timestamp: e.timestamp.toISOString(),
      endTimestamp: e.endTimestamp?.toISOString() ?? null,
      confidence: e.confidence,
      sourceType: e.sourceType,
      description: e.description,
      rawText: e.rawText,
      metadata: e.metadata,
      correlationGroup: e.correlationGroup,
    })),
    total,
    limit,
    offset,
  });
}

// ---------------------------------------------------------------------------
// GET /api/timeline/:caseId/conflicts — Conflicting events
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

  const timeline = await prisma.caseTimeline.findFirst({
    where: { caseId, tenantId },
  });

  if (!timeline) {
    return reply.send({ conflicts: [], conflictCount: 0 });
  }

  // Extract conflict details from timeline metadata
  const metadata = timeline.metadata as Record<string, unknown> | null;
  const conflictDetails = (metadata?.conflictDetails as Array<{
    type: string;
    description: string;
    eventIdA: string;
    eventIdB: string;
  }>) ?? [];

  // Fetch the actual events referenced in conflicts
  const eventIds = new Set<string>();
  for (const c of conflictDetails) {
    eventIds.add(c.eventIdA);
    eventIds.add(c.eventIdB);
  }

  const events = eventIds.size > 0
    ? await prisma.timelineEvent.findMany({
        where: { eventId: { in: Array.from(eventIds) }, tenantId },
      })
    : [];

  const eventMap = new Map(events.map((e) => [e.eventId, e]));

  const conflicts = conflictDetails.map((c) => {
    const eventA = eventMap.get(c.eventIdA);
    const eventB = eventMap.get(c.eventIdB);
    return {
      conflictType: c.type,
      description: c.description,
      eventA: eventA
        ? {
            eventId: eventA.eventId,
            eventType: eventA.eventType,
            timestamp: eventA.timestamp.toISOString(),
            sourceType: eventA.sourceType,
            description: eventA.description,
          }
        : null,
      eventB: eventB
        ? {
            eventId: eventB.eventId,
            eventType: eventB.eventType,
            timestamp: eventB.timestamp.toISOString(),
            sourceType: eventB.sourceType,
            description: eventB.description,
          }
        : null,
    };
  });

  return reply.send({
    conflicts,
    conflictCount: timeline.conflictCount,
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

  // Enqueue rebuild job
  await enqueueTimelineBuild({
    caseId,
    tenantId,
    rebuild: true,
  });

  return reply.send({
    status: 'queued',
    message: `Timeline rebuild queued for case ${caseId}`,
    caseId,
  });
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerTimelineRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/timeline/:caseId', getTimeline);
  app.get('/api/timeline/:caseId/events', getTimelineEvents);
  app.get('/api/timeline/:caseId/conflicts', getTimelineConflicts);
  app.post('/api/timeline/rebuild/:caseId', rebuildTimeline);
}
