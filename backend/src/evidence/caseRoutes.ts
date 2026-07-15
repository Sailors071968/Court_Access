// ============================================================================
// Core Evidence System — Case Management API (Part 1)
// CRUD endpoints with tenant isolation enforcement.
// All queries filter by tenantId = req.user.tenantId.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import {
  buildAuthorizedCaseFilter,
  requireCaseAccess,
  sendForbidden,
} from '../membership/resourceAuthMiddleware.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateCaseBody {
  title: string;
  caseNumber: string;
  jurisdiction: string;
  caseType: string;
  clientId?: string;
  court?: string;
  judge?: string;
  department?: string;
}

interface UpdateCaseBody {
  title?: string;
  caseNumber?: string;
  jurisdiction?: string;
  caseType?: string;
  status?: string;
  phase?: string;
  court?: string;
  judge?: string;
  department?: string;
  nextHearing?: string;
  nextHearingNote?: string;
}

const VALID_CASE_TYPES = ['felony', 'misdemeanor', 'infraction', 'federal'];
const VALID_STATUSES = ['active', 'pending', 'closed', 'archived'];
const VALID_PHASES = ['intake', 'preliminary', 'pretrial', 'trial', 'sentencing', 'appeal', 'closed'];

async function buildCaseScopeFilter(user: { userId: string; tenantId: string; role: string }) {
  return buildAuthorizedCaseFilter(user);
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerCaseRoutes(app: FastifyInstance): Promise<void> {

  // POST /api/cases — Create a new case
  app.post('/api/cases', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const body = request.body as CreateCaseBody;

    // Validate required fields
    if (!body.title || !body.caseNumber || !body.jurisdiction || !body.caseType) {
      return reply.code(400).send({
        error: 'Missing required fields',
        required: ['title', 'caseNumber', 'jurisdiction', 'caseType'],
      });
    }

    if (!VALID_CASE_TYPES.includes(body.caseType)) {
      return reply.code(400).send({
        error: `Invalid caseType. Must be one of: ${VALID_CASE_TYPES.join(', ')}`,
      });
    }

    try {
      if (body.clientId) {
        const client = await prisma.client.findFirst({
          where: { clientId: body.clientId, tenantId: user.tenantId, deletedAt: null },
        });
        if (!client) {
          return reply.code(400).send({ error: 'Invalid clientId for this tenant' });
        }
      }

      const newCase = await prisma.criminalCase.create({
        data: {
          tenantId: user.tenantId,
          ownerId: user.userId,
          clientId: body.clientId ?? null,
          title: body.title,
          caseNumber: body.caseNumber,
          jurisdiction: body.jurisdiction,
          caseType: body.caseType,
          court: body.court ?? null,
          judge: body.judge ?? null,
          department: body.department ?? null,
        },
      });

      return reply.code(201).send({ case: newCase });
    } catch (err: unknown) {
      const prismaError = err as { code?: string };
      if (prismaError.code === 'P2002') {
        return reply.code(409).send({
          error: 'A case with this case number already exists for your tenant',
        });
      }
      console.error('[CaseRoutes] Failed to create case:', err);
      return reply.code(500).send({ error: 'Failed to create case' });
    }
  });

  // GET /api/cases — List all cases for the tenant
  app.get('/api/cases', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    try {
      const scope = await buildCaseScopeFilter(user);
      const cases = await prisma.criminalCase.findMany({
        where: scope,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          _count: {
            select: { evidence: true },
          },
        },
      });

      return { cases };
    } catch (err) {
      console.error('[CaseRoutes] Failed to list cases:', err);
      return reply.code(500).send({ error: 'Failed to list cases' });
    }
  });

  // GET /api/cases/:caseId — Get a single case
  app.get('/api/cases/:caseId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { caseId } = request.params as { caseId: string };

    try {
      const scope = await buildCaseScopeFilter(user);
      const foundCase = await prisma.criminalCase.findFirst({
        where: {
          caseId,
          ...scope,
        },
        include: {
          _count: {
            select: { evidence: true },
          },
        },
      });

      if (!foundCase) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      return { case: foundCase };
    } catch (err) {
      console.error('[CaseRoutes] Failed to get case:', err);
      return reply.code(500).send({ error: 'Failed to get case' });
    }
  });

  // PATCH /api/cases/:caseId — Update a case
  app.patch('/api/cases/:caseId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { caseId } = request.params as { caseId: string };
    const body = request.body as UpdateCaseBody;

    // Validate optional fields if provided
    if (body.caseType !== undefined && !VALID_CASE_TYPES.includes(body.caseType)) {
      return reply.code(400).send({
        error: `Invalid caseType. Must be one of: ${VALID_CASE_TYPES.join(', ')}`,
      });
    }
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return reply.code(400).send({
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }
    if (body.phase !== undefined && !VALID_PHASES.includes(body.phase)) {
      return reply.code(400).send({
        error: `Invalid phase. Must be one of: ${VALID_PHASES.join(', ')}`,
      });
    }

    try {
      if (!(await requireCaseAccess(user, caseId, 'edit'))) {
        return sendForbidden(reply);
      }

      const existing = await prisma.criminalCase.findFirst({
        where: {
          caseId,
          tenantId: user.tenantId,
          deletedAt: null,
        },
      });

      if (!existing) {
        return sendForbidden(reply);
      }

      const updateData: Record<string, unknown> = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.caseNumber !== undefined) updateData.caseNumber = body.caseNumber;
      if (body.jurisdiction !== undefined) updateData.jurisdiction = body.jurisdiction;
      if (body.caseType !== undefined) updateData.caseType = body.caseType;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.phase !== undefined) updateData.phase = body.phase;
      if (body.court !== undefined) updateData.court = body.court;
      if (body.judge !== undefined) updateData.judge = body.judge;
      if (body.department !== undefined) updateData.department = body.department;
      if (body.nextHearing !== undefined) updateData.nextHearing = body.nextHearing ? new Date(body.nextHearing) : null;
      if (body.nextHearingNote !== undefined) updateData.nextHearingNote = body.nextHearingNote;

      const updated = await prisma.criminalCase.update({
        where: { caseId },
        data: updateData,
      });

      return { case: updated };
    } catch (err: unknown) {
      const prismaError = err as { code?: string };
      if (prismaError.code === 'P2002') {
        return reply.code(409).send({
          error: 'A case with this case number already exists for your tenant',
        });
      }
      console.error('[CaseRoutes] Failed to update case:', err);
      return reply.code(500).send({ error: 'Failed to update case' });
    }
  });

  // DELETE /api/cases/:caseId — Soft delete a case
  app.delete('/api/cases/:caseId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { caseId } = request.params as { caseId: string };

    try {
      if (!(await requireCaseAccess(user, caseId, 'edit'))) {
        return sendForbidden(reply);
      }

      const existing = await prisma.criminalCase.findFirst({
        where: {
          caseId,
          tenantId: user.tenantId,
          deletedAt: null,
        },
      });

      if (!existing) {
        return sendForbidden(reply);
      }

      // Soft delete
      await prisma.criminalCase.update({
        where: { caseId },
        data: { deletedAt: new Date() },
      });

      return { message: 'Case deleted', caseId };
    } catch (err) {
      console.error('[CaseRoutes] Failed to delete case:', err);
      return reply.code(500).send({ error: 'Failed to delete case' });
    }
  });

  // GET /api/cases/:caseId/litigation-strategy — Repository-backed litigation
  // strategy: readiness metrics, roadmap, observations, and recommendations
  // derived deterministically from the case's actual evidence/charge/witness
  // counts. Empty case → honest empty state (no fabricated content).
  app.get('/api/cases/:caseId/litigation-strategy', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { caseId } = request.params as { caseId: string };

    if (!(await requireCaseAccess(user, caseId, 'view'))) {
      return sendForbidden(reply);
    }

    try {
      const existing = await prisma.criminalCase.findFirst({
        where: { caseId, tenantId: user.tenantId, deletedAt: null },
      });
      if (!existing) {
        return sendForbidden(reply);
      }

      const [evidenceCount, chargeCount, witnessCount] = await Promise.all([
        prisma.evidence.count({ where: { caseId, tenantId: user.tenantId } }),
        prisma.charge.count({ where: { caseId } }).catch(() => 0),
        prisma.caseWitness.count({ where: { caseId } }).catch(() => 0),
      ]);

      const readiness = [
        { label: 'Charges Mapped', score: Math.min(chargeCount, 5), maxScore: 5 },
        { label: 'Evidence Collected', score: Math.min(evidenceCount, 10), maxScore: 10 },
        { label: 'Witnesses Identified', score: Math.min(witnessCount, 5), maxScore: 5 },
        { label: 'Case Setup', score: existing.court && existing.judge ? 2 : 1, maxScore: 2 },
      ];

      const step = (n: number, description: string, category: string, done: boolean, active: boolean) => ({
        stepNumber: n,
        description,
        category,
        status: done ? 'completed' : active ? 'in_progress' : 'pending',
      });
      const roadmap = [
        step(1, 'Case intake and setup', 'INVESTIGATION', true, false),
        step(2, 'Map charges and CALCRIM elements', 'MOTION', chargeCount > 0, chargeCount === 0),
        step(3, 'Collect and process evidence', 'INVESTIGATION', evidenceCount > 0, chargeCount > 0 && evidenceCount === 0),
        step(4, 'Identify and interview witnesses', 'SUBPOENA', witnessCount > 0, evidenceCount > 0 && witnessCount === 0),
        step(5, 'Run contradiction and gap analysis', 'INVESTIGATION', false, evidenceCount > 0),
        step(6, 'Prepare motions and trial strategy', 'MOTION', false, false),
      ];

      const observations: Array<{ id: string; evidenceSource: string; observation: string; timestamp: string }> = [];
      const recommendations: Array<{ id: string; type: string; suggestedOpportunity: string; evidenceSource: string; confidenceScore: number; status: string }> = [];
      const now = new Date().toISOString();

      if (chargeCount === 0) {
        recommendations.push({ id: 'rec-charges', type: 'MOTION', suggestedOpportunity: 'No charges mapped yet — add charges to enable CALCRIM element analysis and defense mapping.', evidenceSource: 'Repository (0 charges)', confidenceScore: 100, status: 'pending' });
      }
      if (evidenceCount === 0) {
        recommendations.push({ id: 'rec-evidence', type: 'INVESTIGATION', suggestedOpportunity: 'No evidence uploaded yet — collect discovery materials to enable contradiction and gap analysis.', evidenceSource: 'Repository (0 evidence items)', confidenceScore: 100, status: 'pending' });
      } else {
        observations.push({ id: 'obs-evidence', evidenceSource: `Repository (${evidenceCount} evidence item${evidenceCount === 1 ? '' : 's'})`, observation: `${evidenceCount} evidence item${evidenceCount === 1 ? '' : 's'} available for analysis.`, timestamp: now });
      }
      if (witnessCount === 0 && evidenceCount > 0) {
        recommendations.push({ id: 'rec-witnesses', type: 'SUBPOENA', suggestedOpportunity: 'No witnesses identified — review evidence for potential witnesses and subpoena targets.', evidenceSource: 'Repository (0 witnesses)', confidenceScore: 80, status: 'pending' });
      }

      return { observations, recommendations, readiness, roadmap };
    } catch (err) {
      console.error('[CaseRoutes] Failed to build litigation strategy:', err);
      return reply.code(500).send({ error: 'Failed to build litigation strategy' });
    }
  });
}
