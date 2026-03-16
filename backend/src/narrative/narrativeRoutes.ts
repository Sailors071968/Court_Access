// ============================================================================
// Narrative Deconstruction Engine — Route Stubs
// Placeholder until full narrative pipeline dependencies (Prisma models,
// BullMQ workers, Neo4j) are available in production.
// All routes require tenantId from auth context (request.context.tenantId).
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { getRequestContext } from '../security/authMiddleware.js';

// ---------------------------------------------------------------------------
// GET /api/narrative/:caseId/claims — All claims (empty stub)
// ---------------------------------------------------------------------------

async function getNarrativeClaims(
  request: AuthenticatedRequest,
  reply: FastifyReply,
) {
  const ctx = getRequestContext(request);
  if (!ctx) {
    return reply.code(401).send({ error: 'Authentication required — missing tenantId' });
  }

  const { caseId: _caseId } = request.params as { caseId: string };
  return reply.send({
    claims: [],
    total: 0,
    limit: 100,
    offset: 0,
    graph: { nodes: [], edges: [] },
  });
}

// ---------------------------------------------------------------------------
// GET /api/narrative/:caseId/contradictions — Contradicted claims (empty stub)
// ---------------------------------------------------------------------------

async function getNarrativeContradictions(
  request: AuthenticatedRequest,
  reply: FastifyReply,
) {
  const ctx = getRequestContext(request);
  if (!ctx) {
    return reply.code(401).send({ error: 'Authentication required — missing tenantId' });
  }

  const { caseId: _caseId } = request.params as { caseId: string };
  return reply.send({ contradictions: [], count: 0 });
}

// ---------------------------------------------------------------------------
// GET /api/narrative/:caseId/impeachment — Impeachment candidates (empty stub)
// ---------------------------------------------------------------------------

async function getNarrativeImpeachment(
  request: AuthenticatedRequest,
  reply: FastifyReply,
) {
  const ctx = getRequestContext(request);
  if (!ctx) {
    return reply.code(401).send({ error: 'Authentication required — missing tenantId' });
  }

  const { caseId: _caseId } = request.params as { caseId: string };
  return reply.send({
    candidates: [],
    total: 0,
    severityCounts: { high: 0, medium: 0, low: 0 },
  });
}

// ---------------------------------------------------------------------------
// POST /api/narrative/analyze/:caseId — Trigger full analysis (stub)
// ---------------------------------------------------------------------------

async function analyzeNarrative(
  request: AuthenticatedRequest,
  reply: FastifyReply,
) {
  const ctx = getRequestContext(request);
  if (!ctx) {
    return reply.code(401).send({ error: 'Authentication required — missing tenantId' });
  }

  const { caseId } = request.params as { caseId: string };
  return reply.send({
    status: 'queued',
    message: 'Narrative analysis stub — full pipeline not yet deployed',
    caseId,
    evidenceCount: 0,
  });
}

// ---------------------------------------------------------------------------
// GET /api/narrative/health — Narrative engine health
// ---------------------------------------------------------------------------

async function narrativeHealth(_request: AuthenticatedRequest, reply: FastifyReply) {
  return reply.send({
    status: 'ok',
    engine: 'narrative-deconstruction',
    workers: 0,
    message: 'Stub — full pipeline not yet deployed',
  });
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerNarrativeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/narrative/:caseId/claims', getNarrativeClaims as never);
  app.get('/api/narrative/:caseId/contradictions', getNarrativeContradictions as never);
  app.get('/api/narrative/:caseId/impeachment', getNarrativeImpeachment as never);
  app.post('/api/narrative/analyze/:caseId', analyzeNarrative as never);
  app.get('/api/narrative/health', narrativeHealth as never);

  console.log('[Server] Narrative routes registered (stub mode — tenant-enforced)');
}
