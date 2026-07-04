// ============================================================================
// CourtAccess — Charge Routes
// Tenant-isolated charge CRUD for case management.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';

interface CreateChargeBody {
  caseId: string;
  code: string;
  section: string;
  title?: string;
  victim: string;
  dateOfOffense?: string;
}

async function verifyCaseAccess(
  caseId: string,
  tenantId: string,
): Promise<boolean> {
  const caseRecord = await prisma.criminalCase.findFirst({
    where: { caseId, tenantId, deletedAt: null },
  });
  return !!caseRecord;
}

export async function registerChargeRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/charges', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const body = request.body as CreateChargeBody;

    if (!body.caseId || !body.code || !body.section || !body.victim) {
      return reply.code(400).send({
        error: 'Missing required fields',
        required: ['caseId', 'code', 'section', 'victim'],
      });
    }

    if (!(await verifyCaseAccess(body.caseId, user.tenantId))) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      const charge = await prisma.charge.create({
        data: {
          caseId: body.caseId,
          code: body.code,
          section: body.section,
          title: body.title ?? null,
          victim: body.victim,
          dateOfOffense: body.dateOfOffense ? new Date(body.dateOfOffense) : null,
        },
      });

      return { success: true, charge };
    } catch (err) {
      console.error('[ChargeRoutes] CREATE CHARGE ERROR:', err);
      return reply.code(500).send({ error: 'Failed to create charge' });
    }
  });

  fastify.get('/api/charges/:caseId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { caseId } = request.params as { caseId: string };

    if (!(await verifyCaseAccess(caseId, user.tenantId))) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      const charges = await prisma.charge.findMany({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
      });

      return { success: true, charges };
    } catch (err) {
      console.error('[ChargeRoutes] GET CHARGES ERROR:', err);
      return reply.code(500).send({ error: 'Failed to fetch charges' });
    }
  });

  fastify.delete('/api/charges/:id', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const { id } = request.params as { id: string };

    try {
      const existing = await prisma.charge.findUnique({ where: { id } });
      if (!existing || !(await verifyCaseAccess(existing.caseId, user.tenantId))) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      await prisma.charge.delete({ where: { id } });
      return { success: true };
    } catch (err) {
      console.error('[ChargeRoutes] DELETE CHARGE ERROR:', err);
      return reply.code(500).send({ error: 'Failed to delete charge' });
    }
  });
}
