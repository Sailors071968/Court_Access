// ============================================================================
// Domain U — Attorney Intelligence API Routes
// Replaces narrative stub with evidence-governed intelligence
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import { buildCaseIntelligence } from './caseIntelligenceOrchestrator.js';
import { generateAttorneyReport } from './reportGenerator.js';
import { INTELLIGENCE_VERSION } from './types.js';
import prisma from '../lib/prisma.js';
import { guardAuth, guardCaseAccess } from '../membership/resourceAuthMiddleware.js';

export async function registerIntelligenceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/cases/:caseId/intelligence', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;

    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const intelligence = await buildCaseIntelligence(caseId, user.tenantId);
    if (!intelligence) return reply.code(404).send({ error: 'Case not found' });

    return reply.send(intelligence);
  });

  // Rendered report from structured intelligence
  app.get('/api/cases/:caseId/intelligence/report', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const intelligence = await buildCaseIntelligence(caseId, user.tenantId);
    if (!intelligence) return reply.code(404).send({ error: 'Case not found' });

    const report = generateAttorneyReport(intelligence);
    return reply.send({ intelligence, report });
  });

  // Trigger analysis (records audit event)
  app.post('/api/cases/:caseId/intelligence/analyze', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const intelligence = await buildCaseIntelligence(caseId, user.tenantId);
    if (!intelligence) return reply.code(404).send({ error: 'Case not found' });

    void logSecurityEvent('ATTORNEY_INTELLIGENCE_GENERATED', user.userId, request.ip, `caseId=${caseId}`);

    return reply.send({
      status: 'complete',
      caseId,
      intelligenceVersion: INTELLIGENCE_VERSION,
      unknownCount: intelligence.unknowns.all.length,
      riskCount: intelligence.riskFactors.length,
      intelligence,
    });
  });

  console.log('[Intelligence] Attorney Intelligence routes registered');
}

// Backward-compatible narrative endpoints — delegate to intelligence engine
export async function registerNarrativeIntelligenceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/narrative/:caseId/claims', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };

    const claims = await prisma.narrativeClaim.findMany({
      where: { caseId, tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const intelligence = await buildCaseIntelligence(caseId, user.tenantId);
    return reply.send({
      claims,
      total: claims.length,
      limit: 100,
      offset: 0,
      intelligenceVersion: INTELLIGENCE_VERSION,
      unknowns: intelligence?.unknowns.all ?? [],
      graph: { nodes: claims.map((c) => ({ id: c.claimId, label: c.claimText })), edges: [] },
    });
  });

  app.get('/api/narrative/:caseId/contradictions', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };

    const intelligence = await buildCaseIntelligence(caseId, user.tenantId);
    const contradictions = intelligence?.contradictionAnalysis ?? [];
    return reply.send({ contradictions, count: contradictions.length });
  });

  app.get('/api/narrative/:caseId/impeachment', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };

    const candidates = await prisma.impeachmentCandidate.findMany({
      where: { caseId, tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    const severityCounts = {
      high: candidates.filter((c) => c.severity === 'high').length,
      medium: candidates.filter((c) => c.severity === 'medium').length,
      low: candidates.filter((c) => c.severity === 'low').length,
    };
    return reply.send({ candidates, total: candidates.length, severityCounts });
  });

  app.post('/api/narrative/analyze/:caseId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    const { caseId } = request.params as { caseId: string };

    const intelligence = await buildCaseIntelligence(caseId, user.tenantId);
    if (!intelligence) return reply.code(404).send({ error: 'Case not found' });

    void logSecurityEvent('ATTORNEY_INTELLIGENCE_GENERATED', user.userId, request.ip, `caseId=${caseId} via narrative/analyze`);

    return reply.send({
      status: 'complete',
      engine: 'attorney-intelligence',
      intelligenceVersion: INTELLIGENCE_VERSION,
      caseId,
      evidenceCount: intelligence.evidenceSummary.total,
      unknownCount: intelligence.unknowns.all.length,
    });
  });

  app.get('/api/narrative/health', async (_request, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      engine: 'attorney-intelligence',
      version: INTELLIGENCE_VERSION,
      message: 'Evidence-governed Attorney Intelligence Engine operational',
    });
  });

  console.log('[Intelligence] Narrative compatibility routes registered (intelligence-backed)');
}
