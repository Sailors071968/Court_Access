// ============================================================================
// CourtAccess — Charge Routes (Wave 1 resource authorization)
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import {
  guardAuth,
  guardCaseAccess,
  sendForbidden,
} from '../membership/resourceAuthMiddleware.js';

export async function registerChargeRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/charges', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(guardAuth(user, reply))) return;

    const { caseId, code, section, title, victim, dateOfOffense } = request.body as {
      caseId?: string;
      code?: string;
      section?: string;
      title?: string;
      victim?: string;
      dateOfOffense?: string;
    };

    if (!caseId || !code || !section || !victim) {
      return reply.code(400).send({
        error: 'Missing required fields',
        required: ['caseId', 'code', 'section', 'victim'],
      });
    }

    if (!(await guardCaseAccess(user!, caseId, 'edit', reply))) return;

    try {
      const charge = await prisma.charge.create({
        data: {
          caseId,
          code,
          section,
          title: title ?? null,
          victim,
          dateOfOffense: dateOfOffense ? new Date(dateOfOffense) : null,
        },
      });
      return reply.code(201).send({ success: true, charge });
    } catch (err) {
      console.error('CREATE CHARGE ERROR:', err);
      return reply.code(500).send({ error: 'Failed to create charge' });
    }
  });

  app.get('/api/charges/:caseId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(guardAuth(user, reply))) return;

    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    try {
      const charges = await prisma.charge.findMany({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
      });
      return { success: true, charges };
    } catch (err) {
      console.error('GET CHARGES ERROR:', err);
      return reply.code(500).send({ error: 'Failed to fetch charges' });
    }
  });

  app.delete('/api/charges/:id', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(guardAuth(user, reply))) return;

    const { id } = request.params as { id: string };

    try {
      const existing = await prisma.charge.findUnique({ where: { id }, select: { caseId: true } });
      if (!existing) return sendForbidden(reply);
      if (!(await guardCaseAccess(user!, existing.caseId, 'edit', reply))) return;

      await prisma.charge.delete({ where: { id } });
      return { success: true };
    } catch (err) {
      console.error('DELETE CHARGE ERROR:', err);
      return reply.code(500).send({ error: 'Failed to delete charge' });
    }
  });
}
