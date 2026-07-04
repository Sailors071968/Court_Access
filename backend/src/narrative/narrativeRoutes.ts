// ============================================================================
// Narrative Deconstruction Engine — API Routes
// Serves claims, contradictions, and impeachment data from Prisma.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { enqueueNarrativeProcessing } from '../workers/pipelineJobService.js';

async function verifyCaseAccess(caseId: string, tenantId: string): Promise<boolean> {
  const caseRecord = await prisma.criminalCase.findFirst({
    where: { caseId, tenantId, deletedAt: null },
  });
  return !!caseRecord;
}

export async function registerNarrativeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/narrative/:caseId/claims', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };
    if (!(await verifyCaseAccess(caseId, user.tenantId))) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const limit = Math.min(parseInt((request.query as { limit?: string }).limit ?? '100', 10), 500);
    const offset = parseInt((request.query as { offset?: string }).offset ?? '0', 10);

    const [claims, total] = await Promise.all([
      prisma.narrativeClaim.findMany({
        where: { caseId, tenantId: user.tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.narrativeClaim.count({ where: { caseId, tenantId: user.tenantId } }),
    ]);

    return {
      claims,
      total,
      limit,
      offset,
      graph: { nodes: [], edges: [] },
    };
  });

  app.get('/api/narrative/:caseId/contradictions', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };
    if (!(await verifyCaseAccess(caseId, user.tenantId))) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const contradictions = await prisma.claimValidation.findMany({
      where: { caseId, tenantId: user.tenantId, status: 'contradicted' },
      orderBy: { createdAt: 'desc' },
    });

    return { contradictions, count: contradictions.length };
  });

  app.get('/api/narrative/:caseId/impeachment', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };
    if (!(await verifyCaseAccess(caseId, user.tenantId))) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const candidates = await prisma.impeachmentCandidate.findMany({
      where: { caseId, tenantId: user.tenantId },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    });

    const severityCounts = {
      high: candidates.filter((c) => c.severity === 'high').length,
      medium: candidates.filter((c) => c.severity === 'medium').length,
      low: candidates.filter((c) => c.severity === 'low').length,
    };

    return { candidates, total: candidates.length, severityCounts };
  });

  app.post('/api/narrative/analyze/:caseId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };
    if (!(await verifyCaseAccess(caseId, user.tenantId))) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const evidenceCount = await prisma.evidence.count({
      where: { caseId, tenantId: user.tenantId },
    });

    try {
      const job = await enqueueNarrativeProcessing({
        userId: user.userId,
        tenantId: user.tenantId,
        caseId,
      });

      return reply.code(202).send({
        status: 'queued',
        caseId,
        evidenceCount,
        jobId: job.jobId,
        processingJobId: job.processingJobId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enqueue narrative analysis';
      return reply.code(500).send({ error: message });
    }
  });

  app.get('/api/narrative/health', async (_request: AuthenticatedRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      engine: 'narrative-deconstruction',
      workers: 4,
      message: 'Narrative pipeline operational',
    });
  });

  console.log('[Server] Narrative routes registered');
}
