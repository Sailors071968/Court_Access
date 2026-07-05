// ============================================================================
// Release Wave 1 — Expanded resource authorization enforcement
// 7-level permission model applied across all resource scopes.
// Non-disclosure: 403 Forbidden — no hidden counts, names, or metadata leaks.
// ============================================================================

import type { FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import {
  assertResourceAccess,
  listAccessibleCaseIds,
  isOrganizationOwner,
  filterByAccessibleCases,
} from './permissionResolver.js';
import type { PermissionLevel, ResourceScope } from './universalMembership.js';
import { LEVEL_RANK } from './universalMembership.js';

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
}

export type { ResourceScope };

/** Resource scopes enforced on case-nested routes (inherit case access). */
export const CASE_NESTED_SCOPES: Record<string, ResourceScope> = {
  charges: 'charge',
  documents: 'document',
  ocr: 'ocr',
  evidence: 'evidence',
  timeline: 'timeline',
  witnesses: 'witness',
  leads: 'lead',
  reports: 'report',
  authorities: 'authority',
  calcrim: 'calcrim',
  communications: 'communications',
  notes: 'notes',
};

export async function sendForbidden(reply: FastifyReply): Promise<FastifyReply> {
  return reply.code(403).send({ error: 'Forbidden' });
}

export async function sendUnauthorized(reply: FastifyReply): Promise<FastifyReply> {
  return reply.code(401).send({ error: 'Authentication required' });
}

/** Guard helper for route handlers — returns false if response already sent. */
export async function guardAuth(
  user: AuthUser | undefined,
  reply: FastifyReply,
): Promise<user is AuthUser> {
  if (!user?.userId || !user?.tenantId) {
    await sendUnauthorized(reply);
    return false;
  }
  return true;
}

/** Guard case access at required permission level. */
export async function guardCaseAccess(
  user: AuthUser,
  caseId: string,
  required: PermissionLevel,
  reply: FastifyReply,
): Promise<boolean> {
  if (!(await requireCaseAccess(user, caseId, required))) {
    await sendForbidden(reply);
    return false;
  }
  return true;
}

/** Guard scope access (organization, billing, dashboard, etc.). */
export async function guardScopeAccess(
  user: AuthUser,
  scope: ResourceScope,
  resourceId: string | null,
  required: PermissionLevel,
  reply: FastifyReply,
  caseId?: string,
): Promise<boolean> {
  if (!(await requireScopeAccess(user, scope, resourceId, required, caseId))) {
    await sendForbidden(reply);
    return false;
  }
  return true;
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

/**
 * Verify scope access. Case-nested scopes require case permission first.
 * When no scope-specific grants exist, case permission is inherited.
 */
export async function requireScopeAccess(
  user: AuthUser,
  scope: ResourceScope,
  resourceId: string | null,
  required: PermissionLevel,
  caseId?: string,
): Promise<boolean> {
  if (caseId) {
    const caseOk = await requireCaseAccess(user, caseId, minLevel(required, 'view'));
    if (!caseOk) return false;
  }

  const scopeGrantCount = await prisma.permissionGrant.count({
    where: { organizationId: user.tenantId, userId: user.userId, scope },
  });

  if (scopeGrantCount === 0) {
    if (caseId) return requireCaseAccess(user, caseId, required);
    if (scope === 'organization' || scope === 'office') {
      const member = await prisma.organizationMember.findFirst({
        where: { organizationId: user.tenantId, userId: user.userId, status: 'active' },
      });
      return Boolean(member);
    }
    if (scope === 'dashboard') return isOrganizationOwner(user.userId, user.tenantId);
    if (scope === 'billing') {
      return assertResourceAccess(user.userId, user.tenantId, 'billing', null, 'view');
    }
    return true;
  }

  return assertResourceAccess(user.userId, user.tenantId, scope, resourceId ?? caseId ?? null, required);
}

function minLevel(a: PermissionLevel, b: PermissionLevel): PermissionLevel {
  return (LEVEL_RANK[a] ?? 0) <= (LEVEL_RANK[b] ?? 0) ? a : b;
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

/** Filter a list of case-scoped items — unauthorized items omitted (non-disclosure). */
export async function filterAuthorizedCaseItems<T extends { caseId: string }>(
  user: AuthUser,
  items: T[],
): Promise<T[]> {
  const accessible = await listAccessibleCaseIds(user.userId, user.tenantId);
  return filterByAccessibleCases(items, accessible);
}

/** Strip nested case data from client records — only authorized cases visible. */
export async function sanitizeClientCases<T extends { cases?: Array<{ caseId: string }> }>(
  user: AuthUser,
  client: T,
): Promise<T> {
  if (!client.cases?.length) return client;
  const accessible = await listAccessibleCaseIds(user.userId, user.tenantId);
  return {
    ...client,
    cases: filterByAccessibleCases(client.cases, accessible),
  };
}

/** List response without aggregate counts that leak unauthorized resource totals. */
export function safeListMeta<T>(items: T[]): { items: T[]; count: number } {
  return { items, count: items.length };
}

/** Returns true when user is org owner/admin with full case visibility. */
export async function hasFullCaseAccess(user: AuthUser): Promise<boolean> {
  return isOrganizationOwner(user.userId, user.tenantId);
}

/** Dashboard access — engineering, operations, repository, legislative. */
export async function requireDashboardAccess(
  user: AuthUser,
  _dashboard: 'admin' | 'engineering' | 'operations' | 'repository' | 'legislative',
): Promise<boolean> {
  return assertResourceAccess(user.userId, user.tenantId, 'dashboard', null, 'view')
    || isOrganizationOwner(user.userId, user.tenantId);
}

/** @deprecated Use requireScopeAccess */
export async function requireResourceAccess(
  user: AuthUser,
  scope: ResourceScope,
  resourceId: string | null,
  required: PermissionLevel,
  caseId?: string,
): Promise<boolean> {
  return requireScopeAccess(user, scope, resourceId, required, caseId);
}
