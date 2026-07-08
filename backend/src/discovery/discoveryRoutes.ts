// ============================================================================
// Program 79 — Discovery Workspace API
// Inbound criminal discovery items: management + review + Brady/Giglio/Jencks
// candidate flags. Evidence-governed — flags are user-set, never fabricated.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import prisma from '../lib/prisma.js';
import { guardAuth, guardCaseAccess } from '../membership/resourceAuthMiddleware.js';

const REVIEW_STATUSES = new Set(['pending', 'in_review', 'completed']);

function serialize(d: Record<string, unknown>) {
  return { ...d, fileSize: d.fileSize != null ? String(d.fileSize) : null };
}

export async function registerDiscoveryRoutes(app: FastifyInstance): Promise<void> {
  // List discovery items for a case
  app.get('/api/cases/:caseId/discovery', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;
    const items = await prisma.discoveryItem.findMany({
      where: { caseId, tenantId: user!.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ caseId, total: items.length, items: items.map((i) => serialize(i as unknown as Record<string, unknown>)) });
  });

  // Create a discovery item (unlimited)
  app.post('/api/cases/:caseId/discovery', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'edit', reply))) return;
    const body = request.body as {
      title?: string; category?: string; sourceAgency?: string; originalFileName?: string;
      receivedDate?: string; producedDate?: string; hash?: string; notes?: string;
      bradyFlag?: boolean; giglioFlag?: boolean; jencksFlag?: boolean; flags?: string[];
    };
    if (!body.title?.trim()) return reply.code(400).send({ error: 'title is required' });
    if (!body.category?.trim()) return reply.code(400).send({ error: 'category is required' });
    const toDate = (s?: string) => (s ? new Date(s) : null);
    const item = await prisma.discoveryItem.create({
      data: {
        caseId,
        tenantId: user!.tenantId,
        title: body.title.trim(),
        category: body.category.trim(),
        sourceAgency: body.sourceAgency ?? null,
        originalFileName: body.originalFileName ?? null,
        receivedDate: toDate(body.receivedDate),
        producedDate: toDate(body.producedDate),
        hash: body.hash ?? null,
        bradyFlag: !!body.bradyFlag,
        giglioFlag: !!body.giglioFlag,
        jencksFlag: !!body.jencksFlag,
        flags: Array.isArray(body.flags) ? body.flags : [],
        notes: body.notes ?? null,
        createdBy: user!.userId,
      },
    });
    void logSecurityEvent('DISCOVERY_CREATED', user!.userId, request.ip, `${caseId} ${item.id}`);
    return reply.code(201).send({ item: serialize(item as unknown as Record<string, unknown>) });
  });

  // Update / review / flag a discovery item
  app.patch('/api/cases/:caseId/discovery/:itemId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { caseId, itemId } = request.params as { caseId: string; itemId: string };
    if (!(await guardCaseAccess(user!, caseId, 'edit', reply))) return;
    const existing = await prisma.discoveryItem.findFirst({ where: { id: itemId, caseId, tenantId: user!.tenantId } });
    if (!existing) return reply.code(404).send({ error: 'Discovery item not found' });

    const body = request.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const f of ['title', 'category', 'sourceAgency', 'notes', 'reviewRole'] as const) {
      if (typeof body[f] === 'string') data[f] = body[f];
    }
    for (const f of ['bradyFlag', 'giglioFlag', 'jencksFlag'] as const) {
      if (typeof body[f] === 'boolean') data[f] = body[f];
    }
    if (Array.isArray(body.flags)) data.flags = body.flags;
    if (typeof body.reviewStatus === 'string' && REVIEW_STATUSES.has(body.reviewStatus)) {
      data.reviewStatus = body.reviewStatus;
      if (body.reviewStatus === 'completed') data.reviewedBy = user!.userId;
    }
    if (Object.keys(data).length === 0) return reply.code(400).send({ error: 'No changes provided' });
    const item = await prisma.discoveryItem.update({ where: { id: itemId }, data });
    void logSecurityEvent('DISCOVERY_UPDATED', user!.userId, request.ip, `${caseId} ${itemId}`);
    return reply.send({ item: serialize(item as unknown as Record<string, unknown>) });
  });
}
