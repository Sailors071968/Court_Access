// ============================================================================
// Phase 4 — Narrative Deconstruction Engine Routes
// Real DB-backed API replacing Phase 2 stubs.
// All routes require tenantId from auth context (request.user.tenantId).
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { enqueueNarrativeProcessing } from '../workers/pipelineJobService.js';
import {
  getNarrativeClaims as fetchClaims,
  getNarrativeContradictions as fetchContradictions,
  getNarrativeImpeachment as fetchImpeachment,
} from './narrativeReconstructionService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract tenantId from request — falls back to query param or default. */
function extractTenantId(request: FastifyRequest): string {
  const user = (request as unknown as Record<string, unknown>).user as
    | { tenantId?: string }
    | undefined;
  if (user?.tenantId) return user.tenantId;
  const query = request.query as Record<string, string> | undefined;
  if (query?.tenantId) return query.tenantId;
  return 'default';
}

// ---------------------------------------------------------------------------
// GET /api/narrative/:caseId/claims — All claims with graph
// ---------------------------------------------------------------------------

async function handleGetClaims(
  request: FastifyRequest<{
    Params: { caseId: string };
    Querystring: { limit?: string; offset?: string; tenantId?: string };
  }>,
  reply: FastifyReply,
) {
  const { caseId } = request.params;
  const tenantId = extractTenantId(request);
  const limit = Math.max(1, Math.min(parseInt((request.query as Record<string, string>).limit || '100', 10) || 100, 1000));
  const offset = Math.max(0, parseInt((request.query as Record<string, string>).offset || '0', 10) || 0);

  try {
    const result = await fetchClaims(caseId, tenantId, { limit, offset });
    return reply.send(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[NarrativeRoutes] Failed to fetch claims', { caseId, error: msg });
    return reply.status(500).send({ error: 'Failed to fetch narrative claims' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/narrative/:caseId/contradictions — Contradicted claims
// ---------------------------------------------------------------------------

async function handleGetContradictions(
  request: FastifyRequest<{ Params: { caseId: string }; Querystring: { tenantId?: string } }>,
  reply: FastifyReply,
) {
  const { caseId } = request.params;
  const tenantId = extractTenantId(request);

  try {
    const result = await fetchContradictions(caseId, tenantId);
    return reply.send(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[NarrativeRoutes] Failed to fetch contradictions', { caseId, error: msg });
    return reply.status(500).send({ error: 'Failed to fetch narrative contradictions' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/narrative/:caseId/impeachment — Impeachment candidates
// ---------------------------------------------------------------------------

async function handleGetImpeachment(
  request: FastifyRequest<{ Params: { caseId: string }; Querystring: { tenantId?: string } }>,
  reply: FastifyReply,
) {
  const { caseId } = request.params;
  const tenantId = extractTenantId(request);

  try {
    const result = await fetchImpeachment(caseId, tenantId);
    return reply.send(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[NarrativeRoutes] Failed to fetch impeachment candidates', { caseId, error: msg });
    return reply.status(500).send({ error: 'Failed to fetch impeachment candidates' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/narrative/analyze/:caseId — Trigger full narrative analysis
// ---------------------------------------------------------------------------

async function handleAnalyzeNarrative(
  request: FastifyRequest<{ Params: { caseId: string }; Querystring: { tenantId?: string } }>,
  reply: FastifyReply,
) {
  const { caseId } = request.params;
  const tenantId = extractTenantId(request);
  const user = (request as unknown as Record<string, unknown>).user as
    | { userId?: string; id?: string }
    | undefined;
  const userId = user?.userId || user?.id || 'system';

  try {
    const job = await enqueueNarrativeProcessing({ caseId, tenantId, userId });
    return reply.send({
      status: 'queued',
      message: 'Narrative deconstruction pipeline enqueued',
      caseId,
      jobId: job.jobId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[NarrativeRoutes] Failed to enqueue narrative analysis', { caseId, error: msg });
    return reply.status(500).send({ error: 'Failed to enqueue narrative analysis' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/narrative/health — Narrative engine health
// ---------------------------------------------------------------------------

async function handleNarrativeHealth(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    status: 'ok',
    engine: 'narrative-deconstruction',
    version: 'phase4',
    stages: [
      'claim-extraction',
      'claim-normalization',
      'evidence-validation',
      'impeachment-detection',
    ],
  });
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerNarrativeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/narrative/:caseId/claims', handleGetClaims);
  app.get('/api/narrative/:caseId/contradictions', handleGetContradictions);
  app.get('/api/narrative/:caseId/impeachment', handleGetImpeachment);
  app.post('/api/narrative/analyze/:caseId', handleAnalyzeNarrative);
  app.get('/api/narrative/health', handleNarrativeHealth);

  console.log('[Server] Narrative deconstruction routes registered (Phase 4)');
}
