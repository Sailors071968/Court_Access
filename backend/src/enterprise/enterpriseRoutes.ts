// ============================================================================
// Program 141 — Enterprise permission/ownership overview (Principal/Admin only)
// Read-oriented aggregation of the permission matrix, organization members,
// principal (billing owner) designation, per-member case-assignment summary,
// redaction modes, and recent audit history. All data is real (members,
// grants, audit) or the deterministic policy matrix — never fabricated. Every
// access is authorization-checked and audit-logged.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import prisma from '../lib/prisma.js';
import { isOrganizationOwner, listAccessibleCaseIds } from '../membership/permissionResolver.js';
import {
  PERMISSIONS, ROLES, fullMatrix, toEnterpriseRole, REDACTION_MODES, BILLING_OWNED_ITEMS,
} from './permissionMatrix.js';

function requirePrincipal(request: AuthenticatedRequest, reply: FastifyReply): boolean {
  const user = request.user;
  if (!user?.userId) { void reply.code(401).send({ error: 'Authentication required' }); return false; }
  if (user.role !== 'admin') {
    void logSecurityEvent('ENTERPRISE_SETTINGS_ACCESS_DENIED', user.userId, request.ip, `role=${user.role}`);
    void reply.code(403).send({ error: 'Forbidden — Principal/Administrator access required' });
    return false;
  }
  return true;
}

export async function registerEnterpriseRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/enterprise/overview', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requirePrincipal(request, reply)) return;
    const user = request.user!;
    void logSecurityEvent('ENTERPRISE_SETTINGS_ACCESS', user.userId, request.ip);

    // Members of the organization (real).
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: user.tenantId },
      orderBy: { joinedAt: 'asc' },
    }).catch(() => []);
    const userIds = members.map((m) => m.userId);
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, name: true, role: true } }).catch(() => []);
    const userById = new Map(users.map((u) => [u.id, u]));

    // Principal = organization owner.
    let principal: { userId: string; email: string; name: string } | null = null;
    const memberViews = [];
    for (const m of members) {
      const u = userById.get(m.userId);
      const owner = await isOrganizationOwner(m.userId, user.tenantId).catch(() => false);
      const accessible = await listAccessibleCaseIds(m.userId, user.tenantId).catch(() => [] as string[]);
      const caseAssignment = accessible === 'all' ? 'All Cases' : Array.isArray(accessible) && accessible.length > 0 ? `${accessible.length} Case(s)` : 'No Cases';
      const enterpriseRole = toEnterpriseRole(m.role, owner);
      if (owner && !principal && u) principal = { userId: u.id, email: u.email, name: u.name };
      memberViews.push({
        userId: m.userId,
        email: u?.email ?? 'UNKNOWN',
        name: u?.name ?? 'UNKNOWN',
        memberRole: m.role,
        enterpriseRole,
        status: m.status,
        isPrincipal: owner,
        caseAssignment,
      });
    }

    // Recent audit history for this tenant's users (real SecurityLog rows).
    const audit = userIds.length
      ? await prisma.securityLog.findMany({
          where: { userId: { in: userIds } },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { event: true, userId: true, ip: true, details: true, createdAt: true },
        }).catch(() => [])
      : [];

    return {
      generatedAt: new Date().toISOString(),
      accessedBy: { userId: user.userId, role: user.role },
      principal,
      billingOwnership: {
        ownerUserId: principal?.userId ?? null,
        ownerEmail: principal?.email ?? 'UNKNOWN',
        note: 'All processing/subscription charges are assigned ONLY to the Principal Account — never to designees.',
        ownedItems: BILLING_OWNED_ITEMS,
      },
      permissions: PERMISSIONS,
      roles: ROLES,
      permissionMatrix: fullMatrix(),
      members: memberViews,
      redactionModes: REDACTION_MODES,
      audit: audit.map((a) => ({ event: a.event, userId: a.userId, ip: a.ip, details: a.details, at: a.createdAt })),
      auditedEvents: [
        'CASE_CREATED', 'CASE_DELETED', 'EVIDENCE_UPLOADED', 'PERMISSION_GRANTED',
        'ROLE_ASSIGNED', 'INVITATION_SENT', 'LOGIN_SUCCESS', 'LOGIN_FAILED',
        'COMMAND_CENTER_ACCESS', 'ENTERPRISE_SETTINGS_ACCESS',
      ],
    };
  });
}
