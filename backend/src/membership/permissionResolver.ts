// ============================================================================
// Program 1 — Permission Resolver + Non-Disclosure Enforcement
// ============================================================================

import prisma from '../lib/prisma.js';
import { permissionSatisfies, type PermissionLevel } from './universalMembership.js';

export async function isOrganizationOwner(userId: string, tenantId: string): Promise<boolean> {
  const member = await prisma.organizationMember.findFirst({
    where: { organizationId: tenantId, userId, status: 'active' },
  });
  if (!member) return false;
  return ['owner', 'admin', 'attorney'].includes(member.role);
}

export async function getEffectivePermission(
  userId: string,
  tenantId: string,
  scope: string,
  resourceId?: string | null,
): Promise<PermissionLevel> {
  if (await isOrganizationOwner(userId, tenantId)) return 'admin';

  const grants = await prisma.permissionGrant.findMany({
    where: {
      organizationId: tenantId,
      userId,
      OR: [
        { scope, resourceId: resourceId ?? undefined },
        { scope, resourceId: null },
        { scope: 'admin' },
      ],
    },
  });

  if (grants.length === 0) {
    const member = await prisma.organizationMember.findFirst({
      where: { organizationId: tenantId, userId, status: 'active' },
    });
    return member ? 'view' : 'none';
  }

  let highest: PermissionLevel = 'none';
  for (const g of grants) {
    const level = g.permission as PermissionLevel;
    if (permissionSatisfies(level, highest === 'none' ? 'view' : highest)) {
      highest = level;
    }
  }
  return highest;
}

export async function assertResourceAccess(
  userId: string,
  tenantId: string,
  scope: string,
  resourceId: string | null,
  required: PermissionLevel,
): Promise<boolean> {
  const effective = await getEffectivePermission(userId, tenantId, scope, resourceId);
  return permissionSatisfies(effective, required);
}

/** Returns case IDs the user may know exist. Non-disclosure: unauthorized cases omitted entirely. */
export async function listAccessibleCaseIds(userId: string, tenantId: string): Promise<string[] | 'all'> {
  if (await isOrganizationOwner(userId, tenantId)) return 'all';

  const caseGrants = await prisma.permissionGrant.findMany({
    where: { organizationId: tenantId, userId, scope: 'case', resourceId: { not: null } },
    select: { resourceId: true, permission: true },
  });

  if (caseGrants.length === 0) {
    const cases = await prisma.criminalCase.findMany({
      where: { tenantId },
      select: { caseId: true },
    });
    return cases.map((c) => c.caseId);
  }

  return caseGrants
    .filter((g) => g.permission !== 'none' && g.resourceId)
    .map((g) => g.resourceId as string);
}

export function filterByAccessibleCases<T extends { caseId: string }>(
  items: T[],
  accessible: string[] | 'all',
): T[] {
  if (accessible === 'all') return items;
  const set = new Set(accessible);
  return items.filter((i) => set.has(i.caseId));
}
