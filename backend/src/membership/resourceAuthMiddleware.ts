// ============================================================================
// Sprint 1 — Resource authorization enforcement
// Non-disclosure: unauthorized resources return 403 (never leak existence via 404).
// ============================================================================

import type { FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import {
  assertResourceAccess,
  listAccessibleCaseIds,
  isOrganizationOwner,
} from './permissionResolver.js';
import type { PermissionLevel, ResourceScope } from './universalMembership.js';

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
}

export async function sendForbidden(reply: FastifyReply): Promise<FastifyReply> {
  return reply.code(403).send({ error: 'Forbidden' });
}

/** Verify user may access a case at the required permission level. */
export async function requireCaseAccess(
  user: AuthUser,
  caseId: string,
  required: PermissionLevel,
): Promise<boolean> {
  const exists = await prisma.criminalCase.findFirst({
    where: { caseId, tenantId: user.tenantId, deletedAt: null },
    select: { caseId: true },
  });
  if (!exists) return false;
  return assertResourceAccess(user.userId, user.tenantId, 'case', caseId, required);
}

/** Verify user may access a scoped resource (document, evidence, etc.). */
export async function requireResourceAccess(
  user: AuthUser,
  scope: ResourceScope,
  resourceId: string | null,
  required: PermissionLevel,
  caseId?: string,
): Promise<boolean> {
  if (caseId) {
    const caseOk = await requireCaseAccess(user, caseId, 'view');
    if (!caseOk) return false;
  }
  return assertResourceAccess(user.userId, user.tenantId, scope, resourceId, required);
}

/** Prisma where clause for listing cases with permission + defendant portal scoping. */
export async function buildAuthorizedCaseFilter(user: AuthUser): Promise<Record<string, unknown>> {
  const base: Record<string, unknown> = { tenantId: user.tenantId, deletedAt: null };

  if (user.role === 'defendant') {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { clientId: true },
    });
    if (!dbUser?.clientId) return { ...base, clientId: '__no_portal_client__' };
    base.clientId = dbUser.clientId;
  }

  const accessible = await listAccessibleCaseIds(user.userId, user.tenantId);
  if (accessible === 'all') return base;

  if (accessible.length === 0) {
    return { ...base, caseId: '__no_accessible_cases__' };
  }

  return { ...base, caseId: { in: accessible } };
}

/** Returns true when user is org owner/admin with full case visibility. */
export async function hasFullCaseAccess(user: AuthUser): Promise<boolean> {
  return isOrganizationOwner(user.userId, user.tenantId);
}
