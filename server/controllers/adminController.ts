// ============================================
// Court Access — Admin Controller
// ============================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { listTenantUsers } from '../services/userService.js';
import { db } from '../config/database.js';
import { tenants, auditLogs } from '../models/schema.js';
import { eq, desc } from 'drizzle-orm';
import { AppError } from '../middleware/errorHandler.js';

export async function handleListUsers(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);
  const result = await listTenantUsers(request.user.tenantId);
  return reply.send(result);
}

export async function handleListTenants(_request: FastifyRequest, reply: FastifyReply) {
  const result = await db.select().from(tenants);
  return reply.send(result);
}

export async function handleGetAuditLogs(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) throw new AppError('Authentication required', 401);
  const result = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.tenantId, request.user.tenantId))
    .orderBy(desc(auditLogs.timestamp))
    .limit(100);
  return reply.send(result);
}

/**
 * Write an audit log entry.
 */
export async function writeAuditLog(
  tenantId: string,
  userId: string | null,
  eventType: string,
  eventData: Record<string, unknown>
) {
  await db.insert(auditLogs).values({
    tenantId,
    userId,
    eventType,
    eventDataJson: eventData,
  });
}
