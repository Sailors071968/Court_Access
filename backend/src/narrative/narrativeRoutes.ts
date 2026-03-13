// ============================================================================
// Narrative Deconstruction Engine — API Routes
// GET  /api/narrative/:caseId/claims         — all claims with validation status
// GET  /api/narrative/:caseId/contradictions  — contradicted claims
// GET  /api/narrative/:caseId/impeachment     — impeachment candidates
// POST /api/narrative/analyze/:caseId         — trigger full analysis
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { enqueueClaimExtraction } from './narrativeProcessingPipeline.js';
import { buildNarrativeGraph } from './narrativeGraphIntegration.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Tenant extraction helper
// ---------------------------------------------------------------------------

function getTenantId(request: FastifyRequest): string | null {
  const user = (request as unknown as { user?: { tenantId?: string } }).user;
  return user?.tenantId ?? null;
}

// ---------------------------------------------------------------------------
// GET /api/narrative/:caseId/claims — All claims with validation status
// ---------------------------------------------------------------------------

async function getNarrativeClaims(
  request: FastifyRequest<{
    Params: { caseId: string };
    Querystring: {
      evidenceId?: string;
      status?: string;
      minConfidence?: string;
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
  const minConfidence = query.minConfidence ? parseFloat(query.minConfidence) : undefined;
  const limit = query.limit ? parseInt(query.limit, 10) : 100;
  const offset = query.offset ? parseInt(query.offset, 10) : 0;

  const where: Record<string, unknown> = { caseId, tenantId };
  if (query.evidenceId) where.evidenceId = query.evidenceId;
  if (minConfidence !== undefined) where.confidence = { gte: minConfidence };

  const [claims, total] = await Promise.all([
    prisma.narrativeClaim.findMany({
      where,
      orderBy: { sentenceIndex: 'asc' },
      take: limit,
      skip: offset,
    }),
    prisma.narrativeClaim.count({ where }),
  ]);

  // Fetch validations for these claims
  const claimIds = claims.map((c) => c.claimId);
  const validations = claimIds.length > 0
    ? await prisma.claimValidation.findMany({
        where: { claimId: { in: claimIds }, tenantId },
      })
    : [];
  const validationMap = new Map(validations.map((v) => [v.claimId, v]));

  // Fetch normalized events
  const normalizedEvents = claimIds.length > 0
    ? await prisma.normalizedClaimEvent.findMany({
        where: { claimId: { in: claimIds }, tenantId },
      })
    : [];
  const normalizedMap = new Map(normalizedEvents.map((e) => [e.claimId, e]));

  // Filter by validation status if requested
  let filteredClaims = claims;
  if (query.status) {
    const statusFilter = query.status;
    filteredClaims = claims.filter((c) => {
      const v = validationMap.get(c.claimId);
      return v?.status === statusFilter;
    });
  }

  // Build graph
  const graph = buildNarrativeGraph({
    caseId,
    claims: filteredClaims.map((c) => {
      const v = validationMap.get(c.claimId);
      return {
        claimId: c.claimId,
        claimText: c.claimText,
        subject: c.subject,
        action: c.action,
        confidence: c.confidence,
        evidenceId: c.evidenceId,
        validationStatus: v?.status,
        supportingEvidenceIds: (v?.supportingEvidenceIds as string[]) ?? [],
        contradictingEvidenceIds: (v?.contradictingEvidenceIds as string[]) ?? [],
      };
    }),
  });

  return reply.send({
    claims: filteredClaims.map((c) => {
      const v = validationMap.get(c.claimId);
      const n = normalizedMap.get(c.claimId);
      return {
        claimId: c.claimId,
        evidenceId: c.evidenceId,
        claimText: c.claimText,
        subject: c.subject,
        action: c.action,
        object: c.object,
        target: c.target,
        timestampReference: c.timestampReference,
        confidence: c.confidence,
        sentenceIndex: c.sentenceIndex,
        validation: v
          ? {
              status: v.status,
              confidence: v.confidence,
              reasoning: v.reasoning,
              supportingEvidenceIds: v.supportingEvidenceIds,
              contradictingEvidenceIds: v.contradictingEvidenceIds,
            }
          : null,
        normalizedEvent: n
          ? {
              eventType: n.eventType,
              actor: n.actor,
              actionNorm: n.actionNorm,
              object: n.object,
              target: n.target,
            }
          : null,
      };
    }),
    total,
    limit,
    offset,
    graph,
  });
}

// ---------------------------------------------------------------------------
// GET /api/narrative/:caseId/contradictions — Contradicted claims
// ---------------------------------------------------------------------------

async function getNarrativeContradictions(
  request: FastifyRequest<{ Params: { caseId: string } }>,
  reply: FastifyReply,
) {
  const { caseId } = request.params;
  const tenantId = getTenantId(request);

  if (!tenantId) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  // Fetch contradicted validations
  const contradictions = await prisma.claimValidation.findMany({
    where: { caseId, tenantId, status: 'contradicted' },
  });

  if (contradictions.length === 0) {
    return reply.send({ contradictions: [], count: 0 });
  }

  // Fetch corresponding claims
  const claimIds = contradictions.map((c) => c.claimId);
  const claims = await prisma.narrativeClaim.findMany({
    where: { claimId: { in: claimIds }, tenantId },
  });
  const claimMap = new Map(claims.map((c) => [c.claimId, c]));

  return reply.send({
    contradictions: contradictions.map((v) => {
      const claim = claimMap.get(v.claimId);
      return {
        validationId: v.validationId,
        claimId: v.claimId,
        claim: claim
          ? {
              claimText: claim.claimText,
              subject: claim.subject,
              action: claim.action,
              object: claim.object,
              target: claim.target,
              evidenceId: claim.evidenceId,
            }
          : null,
        confidence: v.confidence,
        reasoning: v.reasoning,
        supportingEvidenceIds: v.supportingEvidenceIds,
        contradictingEvidenceIds: v.contradictingEvidenceIds,
      };
    }),
    count: contradictions.length,
  });
}

// ---------------------------------------------------------------------------
// GET /api/narrative/:caseId/impeachment — Impeachment candidates
// ---------------------------------------------------------------------------

async function getNarrativeImpeachment(
  request: FastifyRequest<{
    Params: { caseId: string };
    Querystring: { severity?: string };
  }>,
  reply: FastifyReply,
) {
  const { caseId } = request.params;
  const tenantId = getTenantId(request);

  if (!tenantId) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  const where: Record<string, unknown> = { caseId, tenantId };
  if (request.query.severity) {
    where.severity = request.query.severity;
  }

  const candidates = await prisma.impeachmentCandidate.findMany({
    where,
    orderBy: [{ severity: 'asc' }, { confidence: 'desc' }],
  });

  // Count by severity
  const severityCounts = { high: 0, medium: 0, low: 0 };
  for (const c of candidates) {
    if (c.severity === 'high') severityCounts.high++;
    else if (c.severity === 'medium') severityCounts.medium++;
    else severityCounts.low++;
  }

  return reply.send({
    candidates: candidates.map((c) => ({
      impeachmentId: c.impeachmentId,
      claimId: c.claimId,
      severity: c.severity,
      contradictionType: c.contradictionType,
      claimText: c.claimText,
      contradictingEvidence: c.contradictingEvidence,
      suggestedQuestion: c.suggestedQuestion,
      confidence: c.confidence,
    })),
    total: candidates.length,
    severityCounts,
  });
}

// ---------------------------------------------------------------------------
// POST /api/narrative/analyze/:caseId — Trigger full analysis
// ---------------------------------------------------------------------------

async function analyzeNarrative(
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
    where: { caseId, tenantId },
  });

  if (!caseRecord) {
    return reply.status(404).send({ error: 'Case not found' });
  }

  // Find all narrative-type evidence for this case
  const narrativeEvidence = await prisma.evidence.findMany({
    where: {
      caseId,
      tenantId,
      evidenceType: {
        in: [
          'police_report',
          'transcript',
          'other_document',
          'forensic_report',
        ],
      },
    },
  });

  if (narrativeEvidence.length === 0) {
    return reply.status(400).send({
      error: 'No narrative evidence found for this case',
      message: 'Upload police reports, transcripts, or other narrative documents first',
    });
  }

  // Enqueue claim extraction for each narrative evidence
  let queued = 0;
  for (const ev of narrativeEvidence) {
    try {
      await enqueueClaimExtraction({
        evidenceId: ev.evidenceId,
        caseId: ev.caseId,
        tenantId,
        fileName: ev.fileName,
        evidenceType: ev.evidenceType,
        s3Key: ev.s3Key || '',
      });
      queued++;
    } catch (err) {
      console.error(`[NarrativeRoutes] Failed to enqueue extraction for ${ev.evidenceId}:`, err);
    }
  }

  return reply.send({
    status: 'queued',
    message: `Narrative analysis queued for ${queued} evidence items`,
    caseId,
    evidenceCount: queued,
  });
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerNarrativeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/narrative/:caseId/claims', getNarrativeClaims);
  app.get('/api/narrative/:caseId/contradictions', getNarrativeContradictions);
  app.get('/api/narrative/:caseId/impeachment', getNarrativeImpeachment);
  app.post('/api/narrative/analyze/:caseId', analyzeNarrative);
}
