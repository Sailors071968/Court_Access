// ============================================================================
// Core Evidence System — Case Management API (Part 1)
// CRUD endpoints with tenant isolation enforcement.
// All queries filter by tenantId = req.user.tenantId.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateCaseBody {
  title: string;
  caseNumber: string;
  jurisdiction: string;
  caseType: string;
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
      const newCase = await prisma.criminalCase.create({
        data: {
          tenantId: user.tenantId,
          ownerId: user.userId,
          title: body.title,
          caseNumber: body.caseNumber,
          jurisdiction: body.jurisdiction,
          caseType: body.caseType,
          court: body.court ?? null,
          judge: body.judge ?? null,
          department: body.department ?? null,
        },
      });

      return reply.code(201).send(newCase);
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
      const cases = await prisma.criminalCase.findMany({
        where: {
          tenantId: user.tenantId,
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          _count: {
            select: { evidence: true },
          },
        },
      });

      return cases;
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
      const foundCase = await prisma.criminalCase.findFirst({
        where: {
          caseId,
          tenantId: user.tenantId,
          deletedAt: null,
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

      return foundCase;
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
    if (body.caseType && !VALID_CASE_TYPES.includes(body.caseType)) {
      return reply.code(400).send({
        error: `Invalid caseType. Must be one of: ${VALID_CASE_TYPES.join(', ')}`,
      });
    }
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return reply.code(400).send({
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }
    if (body.phase && !VALID_PHASES.includes(body.phase)) {
      return reply.code(400).send({
        error: `Invalid phase. Must be one of: ${VALID_PHASES.join(', ')}`,
      });
    }

    try {
      // Verify ownership via tenant
      const existing = await prisma.criminalCase.findFirst({
        where: {
          caseId,
          tenantId: user.tenantId,
          deletedAt: null,
        },
      });

      if (!existing) {
        return reply.code(403).send({ error: 'Forbidden' });
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

      return updated;
    } catch (err) {
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
      // Verify ownership via tenant
      const existing = await prisma.criminalCase.findFirst({
        where: {
          caseId,
          tenantId: user.tenantId,
          deletedAt: null,
        },
      });

      if (!existing) {
        return reply.code(403).send({ error: 'Forbidden' });
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
}
