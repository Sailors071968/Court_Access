// ============================================================================
// Program 13 — Secure Case Messaging (Wave 1 non-disclosure)
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { guardAuth, guardCaseAccess, sendForbidden } from '../membership/resourceAuthMiddleware.js';

const MESSAGING_ROLES = new Set(['admin', 'attorney', 'investigator', 'staff', 'defendant']);

async function guardMessagingAccess(
  user: { userId: string; tenantId: string; role: string },
  caseId: string,
  reply: FastifyReply,
  required: 'view' | 'comment' = 'view',
): Promise<boolean> {
  if (!MESSAGING_ROLES.has(user.role)) {
    await sendForbidden(reply);
    return false;
  }
  if (!(await guardCaseAccess(user, caseId, required, reply))) return false;

  if (user.role === 'defendant') {
    const [caseRecord, portalUser] = await Promise.all([
      prisma.criminalCase.findFirst({
        where: { caseId, tenantId: user.tenantId, deletedAt: null },
        select: { clientId: true },
      }),
      prisma.user.findUnique({ where: { id: user.userId }, select: { clientId: true } }),
    ]);
    if (!caseRecord?.clientId || portalUser?.clientId !== caseRecord.clientId) {
      await sendForbidden(reply);
      return false;
    }
  }
  return true;
}

export async function registerMessagingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/cases/:caseId/messages', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(guardAuth(user, reply))) return;

    const { caseId } = request.params as { caseId: string };
    if (!(await guardMessagingAccess(user!, caseId, reply, 'view'))) return;

    const messages = await prisma.caseMessage.findMany({
      where: { caseId, tenantId: user!.tenantId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true, role: true, email: true } } },
    });

    return {
      messages: messages.map((m) => ({
        messageId: m.messageId,
        caseId: m.caseId,
        body: m.body,
        readAt: m.readAt,
        deliveredAt: m.deliveredAt,
        createdAt: m.createdAt,
        sender: { userId: m.sender.id, name: m.sender.name, role: m.sender.role },
        isOwn: m.senderId === user!.userId,
      })),
    };
  });

  app.post('/api/cases/:caseId/messages', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(guardAuth(user, reply))) return;

    const { caseId } = request.params as { caseId: string };
    const body = request.body as { message?: string; body?: string };
    const text = (body.message ?? body.body ?? '').trim();
    if (!text) return reply.code(400).send({ error: 'Message body is required' });
    if (text.length > 10000) return reply.code(400).send({ error: 'Message too long' });

    if (!(await guardMessagingAccess(user!, caseId, reply, 'comment'))) return;

    const message = await prisma.caseMessage.create({
      data: {
        caseId,
        tenantId: user!.tenantId,
        senderId: user!.userId,
        body: text,
      },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });

    void logSecurityEvent('CASE_MESSAGE_SENT', user!.userId, request.ip, `case=${caseId}`);

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

  app.patch('/api/cases/:caseId/messages/:messageId/read', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(guardAuth(user, reply))) return;

    const { caseId, messageId } = request.params as { caseId: string; messageId: string };
    if (!(await guardMessagingAccess(user!, caseId, reply, 'view'))) return;

    const existing = await prisma.caseMessage.findFirst({
      where: { messageId, caseId, tenantId: user!.tenantId, senderId: { not: user!.userId } },
    });
    if (!existing) return sendForbidden(reply);

    const updated = await prisma.caseMessage.update({
      where: { messageId },
      data: { readAt: existing.readAt ?? new Date() },
    });

    void logSecurityEvent('CASE_MESSAGE_READ', user!.userId, request.ip, `message=${messageId}`);
    return { messageId: updated.messageId, readAt: updated.readAt };
  });
}
