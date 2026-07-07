// ============================================================================
// Program 2 — Organization API Routes
// Multi-tenant law firm platform with tenant isolation
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import {
  type AuthenticatedRequest,
  extractBearerToken,
  generateAccessToken,
  generateRefreshToken,
  logSecurityEvent,
  verifyAccessToken,
  type UserRole,
} from '../security/authMiddleware.js';
import {
  acceptInvitation,
  advanceOnboarding,
  createInvitation,
  createOffice,
  createPracticeGroup,
  ensureMembership,
  firmWideSearch,
  getFirmAnalytics,
  getInvitationByToken,
  getOrganizationAuditLogs,
  getOrganizationForUser,
  listCollaborators,
  listMembers,
  updateCollaborator,
  listOffices,
  listPracticeGroups,
  updateOrganization,
  verifyTenantAccess,
} from './organizationService.js';
import { isOrgAdmin } from './organizationTypes.js';

const ORG_ADMIN_ROLES = new Set(['admin', 'attorney']);

async function requireOrgContext(request: AuthenticatedRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) {
    reply.code(401).send({ error: 'Authentication required' });
    return null;
  }
  const member = await ensureMembership(user.userId, user.tenantId);
  if (!member) {
    reply.code(403).send({ error: 'Organization membership not found' });
    return null;
  }
  return { user, member };
}

async function requireOrgAdmin(request: AuthenticatedRequest, reply: FastifyReply) {
  const ctx = await requireOrgContext(request, reply);
  if (!ctx) return null;
  if (!isOrgAdmin(ctx.user.role, ctx.member.role)) {
    reply.code(403).send({ error: 'Organization admin access required' });
    return null;
  }
  return ctx;
}

export async function registerOrganizationRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/organizations/current
  app.get('/api/organizations/current', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const org = await getOrganizationForUser(ctx.user.tenantId);
    if (!org) return reply.code(404).send({ error: 'Organization not found' });
    return { organization: org, membership: ctx.member };
  });

  // PATCH /api/organizations/current
  app.patch('/api/organizations/current', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    const org = await updateOrganization(ctx.user.tenantId, request.body as Record<string, unknown>);
    void logSecurityEvent('ORG_UPDATED', ctx.user.userId, request.ip, ctx.user.tenantId);
    return { organization: org };
  });

  // POST /api/organizations/onboarding
  app.post('/api/organizations/onboarding', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    try {
      const org = await advanceOnboarding(ctx.user.tenantId, request.body as Parameters<typeof advanceOnboarding>[1]);
      void logSecurityEvent('ORG_ONBOARDING', ctx.user.userId, request.ip, `step=${(request.body as { step?: string }).step}`);
      return { organization: org };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Onboarding failed' });
    }
  });

  // GET /api/organizations/offices
  app.get('/api/organizations/offices', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    return { offices: await listOffices(ctx.user.tenantId) };
  });

  // POST /api/organizations/offices
  app.post('/api/organizations/offices', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    const office = await createOffice(ctx.user.tenantId, request.body as Parameters<typeof createOffice>[1]);
    void logSecurityEvent('ORG_OFFICE_CREATED', ctx.user.userId, request.ip, office.officeId);
    return reply.code(201).send({ office });
  });

  // GET /api/organizations/practice-groups
  app.get('/api/organizations/practice-groups', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    return { practiceGroups: await listPracticeGroups(ctx.user.tenantId) };
  });

  // POST /api/organizations/practice-groups
  app.post('/api/organizations/practice-groups', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    try {
      const group = await createPracticeGroup(ctx.user.tenantId, request.body as Parameters<typeof createPracticeGroup>[1]);
      void logSecurityEvent('ORG_PRACTICE_GROUP_CREATED', ctx.user.userId, request.ip, group.practiceGroupId);
      return reply.code(201).send({ practiceGroup: group });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed to create practice group' });
    }
  });

  // GET /api/organizations/members?scope=all
  app.get('/api/organizations/members', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const { scope } = request.query as { scope?: string };
    if (scope === 'all') {
      return { members: await listCollaborators(ctx.user.tenantId) };
    }
    return { members: await listMembers(ctx.user.tenantId) };
  });

  // GET /api/organizations/collaborators — active + suspended, for management page
  app.get('/api/organizations/collaborators', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    return { collaborators: await listCollaborators(ctx.user.tenantId) };
  });

  // PATCH /api/organizations/members/:memberId — suspend / reactivate / role change
  app.patch('/api/organizations/members/:memberId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    const { memberId } = request.params as { memberId: string };
    const body = request.body as { status?: string; role?: string; caseRole?: string | null };
    try {
      const member = await updateCollaborator(ctx.user.tenantId, memberId, ctx.user.userId, body);
      return { member };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed to update collaborator' });
    }
  });

  // DELETE /api/organizations/members/:memberId — remove collaborator (soft)
  app.delete('/api/organizations/members/:memberId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    const { memberId } = request.params as { memberId: string };
    try {
      const member = await updateCollaborator(ctx.user.tenantId, memberId, ctx.user.userId, { status: 'removed' });
      return { member };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed to remove collaborator' });
    }
  });

  // GET /api/organizations/invitations
  app.get('/api/organizations/invitations', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    const invitations = await prisma.organizationInvitation.findMany({
      where: { organizationId: ctx.user.tenantId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    return { invitations };
  });

  // POST /api/organizations/invitations
  app.post('/api/organizations/invitations', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    try {
      const result = await createInvitation(ctx.user.tenantId, ctx.user.userId, request.body as Parameters<typeof createInvitation>[2]);
      void logSecurityEvent('ORG_INVITATION_SENT', ctx.user.userId, request.ip, result.invitation.email);
      return reply.code(201).send({
        invitation: {
          invitationId: result.invitation.invitationId,
          email: result.invitation.email,
          role: result.invitation.role,
          status: result.invitation.status,
          expiresAt: result.invitation.expiresAt,
        },
        inviteUrl: result.inviteUrl,
      });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Invitation failed' });
    }
  });

  // GET /api/organizations/analytics
  app.get('/api/organizations/analytics', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    return { analytics: await getFirmAnalytics(ctx.user.tenantId) };
  });

  // GET /api/organizations/search?q=
  app.get('/api/organizations/search', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const { q } = request.query as { q?: string };
    return await firmWideSearch(ctx.user.tenantId, q ?? '');
  });

  // GET /api/organizations/audit-logs
  app.get('/api/organizations/audit-logs', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    const { limit } = request.query as { limit?: string };
    const logs = await getOrganizationAuditLogs(ctx.user.tenantId, limit ? parseInt(limit, 10) : 100);
    return { logs };
  });

  // GET /api/organizations/invitations/preview?token=
  app.get('/api/organizations/invitations/preview', async (request, reply: FastifyReply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.code(400).send({ error: 'Token is required' });
    const invitation = await getInvitationByToken(token);
    if (!invitation) return reply.code(404).send({ error: 'Invalid or expired invitation' });
    return {
      email: invitation.email,
      role: invitation.role,
      organization: invitation.organization,
      expiresAt: invitation.expiresAt,
    };
  });

  // POST /api/auth/accept-invitation (public)
  app.post('/api/auth/accept-invitation', async (request, reply: FastifyReply) => {
    const body = request.body as { token?: string; name?: string; password?: string };
    if (!body.token || !body.name || !body.password) {
      return reply.code(400).send({ error: 'Token, name, and password are required' });
    }
    if (body.password.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });
    }
    try {
      const user = await acceptInvitation(body.token, body.name, body.password, request.ip);
      const tokenPayload = {
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role as UserRole,
      };
      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = await generateRefreshToken(tokenPayload);
      return {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
        user: {
          userId: user.id,
          tenantId: user.tenantId,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Accept invitation failed' });
    }
  });

  // GET /api/organizations/tenant-verify — cross-tenant isolation check (admin diagnostic)
  app.get('/api/organizations/tenant-verify', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const { targetTenantId } = request.query as { targetTenantId?: string };
    if (!targetTenantId) return reply.code(400).send({ error: 'targetTenantId required' });
    const allowed = await verifyTenantAccess(ctx.user.tenantId, targetTenantId);
    return {
      userTenantId: ctx.user.tenantId,
      targetTenantId,
      accessAllowed: allowed,
      isolated: !allowed || ctx.user.tenantId === targetTenantId,
    };
  });
}
