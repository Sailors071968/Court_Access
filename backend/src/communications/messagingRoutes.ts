// ============================================================================
// Program 13 — Secure Case Messaging
// Tenant-isolated attorney-client messaging with audit logging
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';

const MESSAGING_ROLES = new Set(['admin', 'attorney', 'investigator', 'staff', 'defendant']);

async function ensureCaseMessagingAccess(
  caseId: string,
  user: { userId: string; tenantId: string; role: string; email: string },
): Promise<{ caseId: string; clientId: string | null } | null> {
  const caseRecord = await prisma.criminalCase.findFirst({
    where: { caseId, tenantId: user.tenantId, deletedAt: null },
    select: { caseId: true, clientId: true },
  });
  if (!caseRecord) return null;

  if (user.role === 'defendant') {
    const portalUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { clientId: true },
    });
    if (!portalUser?.clientId || portalUser.clientId !== caseRecord.clientId) {
      return null;
    }
  }

  return caseRecord;
}

export async function registerMessagingRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/cases/:caseId/messages
  app.get('/api/cases/:caseId/messages', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    if (!MESSAGING_ROLES.has(user.role)) return reply.code(403).send({ error: 'Forbidden' });

    const { caseId } = request.params as { caseId: string };
    const access = await ensureCaseMessagingAccess(caseId, user);
    if (!access) return reply.code(404).send({ error: 'Case not found' });

    const messages = await prisma.caseMessage.findMany({
      where: { caseId, tenantId: user.tenantId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true, role: true, email: true } } },
    });

    return { messages: messages.map((m) => ({
      messageId: m.messageId,
      caseId: m.caseId,
      body: m.body,
      readAt: m.readAt,
      deliveredAt: m.deliveredAt,
      createdAt: m.createdAt,
      sender: { userId: m.sender.id, name: m.sender.name, role: m.sender.role },
      isOwn: m.senderId === user.userId,
    })) };
  });

  // POST /api/cases/:caseId/messages
  app.post('/api/cases/:caseId/messages', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    if (!MESSAGING_ROLES.has(user.role)) return reply.code(403).send({ error: 'Forbidden' });

    const { caseId } = request.params as { caseId: string };
    const body = request.body as { message?: string; body?: string };
    const text = (body.message ?? body.body ?? '').trim();
    if (!text) return reply.code(400).send({ error: 'Message body is required' });
    if (text.length > 10000) return reply.code(400).send({ error: 'Message too long' });

    const access = await ensureCaseMessagingAccess(caseId, user);
    if (!access) return reply.code(404).send({ error: 'Case not found' });

    const message = await prisma.caseMessage.create({
      data: {
        caseId,
        tenantId: user.tenantId,
        senderId: user.userId,
        body: text,
      },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });

    void logSecurityEvent('CASE_MESSAGE_SENT', user.userId, request.ip, `case=${caseId}`);

    return reply.code(201).send({
      message: {
        messageId: message.messageId,
        caseId: message.caseId,
        body: message.body,
        readAt: message.readAt,
        deliveredAt: message.deliveredAt,
        createdAt: message.createdAt,
        sender: { userId: message.sender.id, name: message.sender.name, role: message.sender.role },
        isOwn: true,
      },
    });
  });

  // PATCH /api/cases/:caseId/messages/:messageId/read
  app.patch('/api/cases/:caseId/messages/:messageId/read', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId, messageId } = request.params as { caseId: string; messageId: string };
    const access = await ensureCaseMessagingAccess(caseId, user);
    if (!access) return reply.code(404).send({ error: 'Case not found' });

    const existing = await prisma.caseMessage.findFirst({
      where: { messageId, caseId, tenantId: user.tenantId, senderId: { not: user.userId } },
    });
    if (!existing) return reply.code(404).send({ error: 'Message not found' });

    const updated = await prisma.caseMessage.update({
      where: { messageId },
      data: { readAt: existing.readAt ?? new Date() },
    });

    void logSecurityEvent('CASE_MESSAGE_READ', user.userId, request.ip, `message=${messageId}`);
    return { messageId: updated.messageId, readAt: updated.readAt };
  });
}
