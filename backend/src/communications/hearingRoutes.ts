// ============================================================================
// Program 4/11 — Court Dates (Hearings)
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { guardAuth, guardCaseAccess } from '../membership/resourceAuthMiddleware.js';

export async function registerHearingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/cases/:caseId/hearings', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(guardAuth(user, reply))) return;

    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const hearings = await prisma.caseHearing.findMany({
      where: { caseId, tenantId: user.tenantId },
      orderBy: { hearingDate: 'asc' },
    });
    return { hearings };
  });

  // POST /api/cases/:caseId/hearings
  app.post('/api/cases/:caseId/hearings', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    if (!['admin', 'attorney', 'staff'].includes(user.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const { caseId } = request.params as { caseId: string };
    const body = request.body as {
      hearingDate?: string;
      hearingType?: string;
      location?: string;
      notes?: string;
    };
    if (!body.hearingDate) return reply.code(400).send({ error: 'hearingDate is required' });

    if (!(await guardCaseAccess(user!, caseId, 'edit', reply))) return;

    const hearing = await prisma.caseHearing.create({
      data: {
        caseId,
        tenantId: user.tenantId,
        hearingDate: new Date(body.hearingDate),
        hearingType: body.hearingType,
        location: body.location,
        notes: body.notes,
      },
    });

    void logSecurityEvent('HEARING_CREATED', user.userId, request.ip, `case=${caseId}`);
    return reply.code(201).send({ hearing });
  });

  // GET /api/portal/court-dates — defendant upcoming hearings across cases
  app.get('/api/portal/court-dates', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { clientId: true } });
    if (!dbUser?.clientId) return { hearings: [] };

    const cases = await prisma.criminalCase.findMany({
      where: { tenantId: user.tenantId, clientId: dbUser.clientId, deletedAt: null },
      select: { caseId: true, title: true, caseNumber: true },
    });
    const caseIds = cases.map((c) => c.caseId);
    if (!caseIds.length) return { hearings: [] };

    const hearings = await prisma.caseHearing.findMany({
      where: { caseId: { in: caseIds }, tenantId: user.tenantId, hearingDate: { gte: new Date() } },
      orderBy: { hearingDate: 'asc' },
    });

    const caseMap = new Map(cases.map((c) => [c.caseId, c]));
    return {
      hearings: hearings.map((h) => ({
        ...h,
        caseTitle: caseMap.get(h.caseId)?.title,
        caseNumber: caseMap.get(h.caseId)?.caseNumber,
      })),
    };
  });
}
