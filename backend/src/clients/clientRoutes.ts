// ============================================================================
// Domain C — Client Management API
// Tenant-isolated CRUD with audit logging
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import {
  type CreateClientBody,
  type UpdateClientBody,
  validateClientStatus,
  validateRetentionStatus,
  validateCommunicationPreference,
  CLIENT_STATUSES,
  RETENTION_STATUSES,
} from './clientTypes.js';
import { guardAuth, guardScopeAccess, sanitizeClientCases } from '../membership/resourceAuthMiddleware.js';

async function ensureClientAccess(
  clientId: string,
  tenantId: string,
): Promise<{ clientId: string } | null> {
  return prisma.client.findFirst({
    where: { clientId, tenantId, deletedAt: null },
    select: { clientId: true },
  });
}

export async function registerClientRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/clients
  app.post('/api/clients', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    if (!(await guardScopeAccess(user!, 'organization', null, 'edit', reply))) return;

    const body = request.body as CreateClientBody;
    if (!body.firstName?.trim() || !body.lastName?.trim()) {
      return reply.code(400).send({ error: 'Missing required fields', required: ['firstName', 'lastName'] });
    }

    if (body.status && !validateClientStatus(body.status)) {
      return reply.code(400).send({ error: `Invalid status. Must be one of: ${CLIENT_STATUSES.join(', ')}` });
    }
    if (body.retentionStatus && !validateRetentionStatus(body.retentionStatus)) {
      return reply.code(400).send({ error: `Invalid retentionStatus. Must be one of: ${RETENTION_STATUSES.join(', ')}` });
    }
    if (body.communicationPreference && !validateCommunicationPreference(body.communicationPreference)) {
      return reply.code(400).send({ error: 'Invalid communicationPreference' });
    }

    try {
      const client = await prisma.client.create({
        data: {
          tenantId: user.tenantId,
          ownerId: user.userId,
          firstName: body.firstName.trim(),
          lastName: body.lastName.trim(),
          middleName: body.middleName?.trim() ?? null,
          dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
          status: body.status ?? 'prospect',
          email: body.email?.trim() ?? null,
          phone: body.phone?.trim() ?? null,
          phoneAlt: body.phoneAlt?.trim() ?? null,
          alternateContacts: body.alternateContacts ?? undefined,
          emergencyContacts: body.emergencyContacts ?? undefined,
          addressHistory: body.addressHistory ?? undefined,
          communicationPreference: body.communicationPreference ?? 'email',
          language: body.language ?? 'en',
          notes: body.notes ?? null,
          intakeDate: body.intakeDate ? new Date(body.intakeDate) : null,
          retentionStatus: body.retentionStatus ?? 'pending',
          retainedAt: body.retentionStatus === 'retained' ? new Date() : null,
        },
      });

      void logSecurityEvent('CLIENT_CREATED', user.userId, request.ip, `clientId=${client.clientId}`);
      return reply.code(201).send({ client });
    } catch (err) {
      console.error('[ClientRoutes] Failed to create client:', err);
      return reply.code(500).send({ error: 'Failed to create client' });
    }
  });

  // GET /api/clients
  app.get('/api/clients', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    if (!(await guardScopeAccess(user!, 'organization', null, 'view', reply))) return;

    const { status, search } = request.query as { status?: string; search?: string };

    try {
      const clients = await prisma.client.findMany({
        where: {
          tenantId: user.tenantId,
          deletedAt: null,
          ...(status ? { status } : {}),
          ...(search
            ? {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });

      return { clients };
    } catch (err) {
      console.error('[ClientRoutes] Failed to list clients:', err);
      return reply.code(500).send({ error: 'Failed to list clients' });
    }
  });

  // GET /api/clients/:clientId
  app.get('/api/clients/:clientId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { clientId } = request.params as { clientId: string };

    try {
      const client = await prisma.client.findFirst({
        where: { clientId, tenantId: user.tenantId, deletedAt: null },
        include: {
          cases: {
            where: { deletedAt: null },
            select: {
              caseId: true,
              title: true,
              caseNumber: true,
              status: true,
              phase: true,
            },
          },
        },
      });

      if (!client) return reply.code(403).send({ error: 'Forbidden' });
      const sanitized = await sanitizeClientCases(user!, client);
      return { client: sanitized };
    } catch (err) {
      console.error('[ClientRoutes] Failed to get client:', err);
      return reply.code(500).send({ error: 'Failed to get client' });
    }
  });

  // PATCH /api/clients/:clientId
  app.patch('/api/clients/:clientId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { clientId } = request.params as { clientId: string };
    const body = request.body as UpdateClientBody;

    if (body.status && !validateClientStatus(body.status)) {
      return reply.code(400).send({ error: `Invalid status. Must be one of: ${CLIENT_STATUSES.join(', ')}` });
    }
    if (body.retentionStatus && !validateRetentionStatus(body.retentionStatus)) {
      return reply.code(400).send({ error: `Invalid retentionStatus` });
    }

    try {
      const existing = await ensureClientAccess(clientId, user.tenantId);
      if (!existing) return reply.code(403).send({ error: 'Forbidden' });

      const updateData: Record<string, unknown> = {};
      if (body.firstName !== undefined) updateData.firstName = body.firstName.trim();
      if (body.lastName !== undefined) updateData.lastName = body.lastName.trim();
      if (body.middleName !== undefined) updateData.middleName = body.middleName?.trim() ?? null;
      if (body.dateOfBirth !== undefined) updateData.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.email !== undefined) updateData.email = body.email?.trim() ?? null;
      if (body.phone !== undefined) updateData.phone = body.phone?.trim() ?? null;
      if (body.phoneAlt !== undefined) updateData.phoneAlt = body.phoneAlt?.trim() ?? null;
      if (body.alternateContacts !== undefined) updateData.alternateContacts = body.alternateContacts;
      if (body.emergencyContacts !== undefined) updateData.emergencyContacts = body.emergencyContacts;
      if (body.addressHistory !== undefined) updateData.addressHistory = body.addressHistory;
      if (body.communicationPreference !== undefined) updateData.communicationPreference = body.communicationPreference;
      if (body.language !== undefined) updateData.language = body.language;
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.intakeDate !== undefined) updateData.intakeDate = body.intakeDate ? new Date(body.intakeDate) : null;
      if (body.retentionStatus !== undefined) {
        updateData.retentionStatus = body.retentionStatus;
        if (body.retentionStatus === 'retained' && !body.retainedAt) {
          updateData.retainedAt = new Date();
        }
      }
      if (body.retainedAt !== undefined) updateData.retainedAt = body.retainedAt ? new Date(body.retainedAt) : null;

      const client = await prisma.client.update({ where: { clientId }, data: updateData });
      void logSecurityEvent('CLIENT_UPDATED', user.userId, request.ip, `clientId=${clientId}`);
      return { client };
    } catch (err) {
      console.error('[ClientRoutes] Failed to update client:', err);
      return reply.code(500).send({ error: 'Failed to update client' });
    }
  });

  // DELETE /api/clients/:clientId — soft delete
  app.delete('/api/clients/:clientId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { clientId } = request.params as { clientId: string };

    try {
      const existing = await ensureClientAccess(clientId, user.tenantId);
      if (!existing) return reply.code(403).send({ error: 'Forbidden' });

      await prisma.client.update({ where: { clientId }, data: { deletedAt: new Date(), status: 'closed' } });
      void logSecurityEvent('CLIENT_DELETED', user.userId, request.ip, `clientId=${clientId}`);
      return { message: 'Client deleted', clientId };
    } catch (err) {
      console.error('[ClientRoutes] Failed to delete client:', err);
      return reply.code(500).send({ error: 'Failed to delete client' });
    }
  });
}
