// ============================================================================
// Program 1 — Membership API Routes
// Account management, shared access, permissions, redaction, disclosure
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import {
  DELEGATED_USER_LIMIT,
  UNIVERSAL_PLANS,
  mapSubscriptionStatusForClient,
  normalizePlanId,
} from './universalMembership.js';
import { listAccessibleCaseIds, getEffectivePermission } from './permissionResolver.js';
import { requireCaseAccess, sendForbidden } from './resourceAuthMiddleware.js';
import { createRedactionVersion, listRedactionVersions } from './redactionService.js';
import { createDisclosurePackage, listDisclosurePackages, listSharedAccessForUser } from './disclosureService.js';
import { resolveRoleOnboarding } from './roleOnboarding.js';
import {
  createPublicationSet,
  listPublicationSets,
  publishPublicationSet,
  listDocumentCopies,
  ensureDocumentCopyChain,
  publishDisclosurePackageWithAudit,
  publishRedactionWithAudit,
} from './publicationService.js';
import { PERMISSION_LEVELS, RESOURCE_SCOPES } from './universalMembership.js';

function authCtx(request: AuthenticatedRequest) {
  const user = request.user;
  if (!user?.userId || !user?.tenantId) throw new Error('Unauthorized');
  return user;
}

export async function registerMembershipRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/membership/account
  app.get('/api/membership/account', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const [user, sub, settings, memberCount] = await Promise.all([
        prisma.user.findUnique({
          where: { id: ctx.userId },
          select: {
            id: true, email: true, name: true, role: true, defaultRole: true,
            emailVerifiedAt: true, termsAcceptedAt: true, privacyAcceptedAt: true, mfaEnabled: true,
          },
        }),
        prisma.subscription.findUnique({ where: { userId: ctx.userId } }),
        prisma.userAccountSettings.findUnique({ where: { userId: ctx.userId } }),
        prisma.organizationMember.count({
          where: { organizationId: ctx.tenantId, status: 'active', userId: { not: ctx.userId } },
        }),
      ]);

      if (!user) return reply.code(404).send({ error: 'User not found' });

      return {
        user: {
          ...user,
          emailVerified: Boolean(user.emailVerifiedAt),
        },
        subscription: sub
          ? {
              planId: normalizePlanId(sub.planId),
              status: mapSubscriptionStatusForClient(sub.subscriptionStatus),
              tier: sub.subscriptionTier,
              trialEndsAt: sub.trialEndsAt,
              billingInterval: sub.billingInterval,
              billingPeriodEnd: sub.billingPeriodEnd,
            }
          : null,
        settings,
        delegatedUsers: memberCount,
        delegatedUserLimit: DELEGATED_USER_LIMIT,
        universalCapabilities: true,
        plans: UNIVERSAL_PLANS,
      };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // PATCH /api/membership/settings
  app.patch('/api/membership/settings', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const body = request.body as Record<string, boolean | string>;
      const settings = await prisma.userAccountSettings.upsert({
        where: { userId: ctx.userId },
        create: { userId: ctx.userId, ...body },
        update: body,
      });
      return { settings };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // GET /api/membership/shared-access — "My Shared Access" dashboard
  app.get('/api/membership/shared-access', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const workspaces = await listSharedAccessForUser(ctx.userId);
      return { workspaces };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // GET /api/membership/accessible-cases
  app.get('/api/membership/accessible-cases', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const accessible = await listAccessibleCaseIds(ctx.userId, ctx.tenantId);
      if (accessible === 'all') {
        const cases = await prisma.criminalCase.findMany({
          where: { tenantId: ctx.tenantId },
          select: { caseId: true, title: true, caseNumber: true, status: true },
        });
        return { cases, access: 'full' };
      }
      const cases = await prisma.criminalCase.findMany({
        where: { caseId: { in: accessible }, tenantId: ctx.tenantId },
        select: { caseId: true, title: true, caseNumber: true, status: true },
      });
      return { cases, access: 'delegated' };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // POST /api/membership/permission-grants
  app.post('/api/membership/permission-grants', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const body = request.body as {
        userId: string;
        scope: string;
        resourceId?: string;
        permission: string;
      };
      const grant = await prisma.permissionGrant.create({
        data: {
          organizationId: ctx.tenantId,
          userId: body.userId,
          scope: body.scope,
          resourceId: body.resourceId ?? null,
          permission: body.permission,
          grantedById: ctx.userId,
        },
      });
      return reply.code(201).send({ grant });
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // GET /api/membership/permission-check
  app.get('/api/membership/permission-check', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const q = request.query as { scope?: string; resourceId?: string };
      const permission = await getEffectivePermission(
        ctx.userId,
        ctx.tenantId,
        q.scope ?? 'case',
        q.resourceId,
      );
      return { permission };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Document redaction routes
  app.get('/api/cases/:caseId/documents/:documentId/redactions', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const { caseId, documentId } = request.params as { caseId: string; documentId: string };
      if (!(await requireCaseAccess(ctx, caseId, 'view'))) return sendForbidden(reply);
      const versions = await listRedactionVersions(ctx.tenantId, caseId, documentId);
      return { versions };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  app.post('/api/cases/:caseId/documents/:documentId/redactions', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const { caseId, documentId } = request.params as { caseId: string; documentId: string };
      if (!(await requireCaseAccess(ctx, caseId, 'edit'))) return sendForbidden(reply);
      const body = request.body as { profileName: string; redactionData?: unknown[] };
      const version = await createRedactionVersion({
        tenantId: ctx.tenantId,
        caseId,
        documentId,
        profileName: body.profileName,
        createdById: ctx.userId,
        redactionData: body.redactionData ?? [],
      });
      return reply.code(201).send({ version });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Redaction failed' });
    }
  });

  // Disclosure manager routes
  app.get('/api/cases/:caseId/disclosures', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const { caseId } = request.params as { caseId: string };
      if (!(await requireCaseAccess(ctx, caseId, 'view'))) return sendForbidden(reply);
      const packages = await listDisclosurePackages(ctx.tenantId, caseId);
      return { packages };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  app.post('/api/cases/:caseId/disclosures', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const { caseId } = request.params as { caseId: string };
      if (!(await requireCaseAccess(ctx, caseId, 'approve'))) return sendForbidden(reply);
      const body = request.body as {
        documentId: string;
        redactionId?: string;
        recipientType: string;
        recipientUserId?: string;
        recipientEmail?: string;
      };
      const pkg = await createDisclosurePackage({
        tenantId: ctx.tenantId,
        caseId,
        documentId: body.documentId,
        redactionId: body.redactionId,
        recipientType: body.recipientType,
        recipientUserId: body.recipientUserId,
        recipientEmail: body.recipientEmail,
        publishedById: ctx.userId,
      });
      return reply.code(201).send({ package: pkg });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Disclosure failed' });
    }
  });

  // POST /api/cases/:caseId/disclosures/:packageId/publish
  app.post('/api/cases/:caseId/disclosures/:packageId/publish', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const { caseId, packageId } = request.params as { caseId: string; packageId: string };
      if (!(await requireCaseAccess(ctx, caseId, 'publish'))) return sendForbidden(reply);
      const pkg = await publishDisclosurePackageWithAudit(packageId, ctx.userId);
      return { package: pkg };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Publish failed' });
    }
  });

  // POST /api/cases/:caseId/documents/:documentId/redactions/:redactionId/publish
  app.post('/api/cases/:caseId/documents/:documentId/redactions/:redactionId/publish', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const { caseId } = request.params as { caseId: string; redactionId: string };
      if (!(await requireCaseAccess(ctx, caseId, 'publish'))) return sendForbidden(reply);
      const { redactionId } = request.params as { redactionId: string };
      const redaction = await publishRedactionWithAudit(redactionId, ctx.userId);
      return { redaction };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Publish failed' });
    }
  });

  // GET /api/membership/onboarding — Program 2A role-based onboarding config
  app.get('/api/membership/onboarding', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { defaultRole: true, role: true },
      });
      if (!user) return reply.code(404).send({ error: 'User not found' });
      const config = resolveRoleOnboarding(user.defaultRole ?? user.role ?? 'other');
      return {
        defaultRole: config.defaultRole,
        label: config.label,
        description: config.description,
        platformRole: config.platformRole,
        defaultDashboard: config.defaultDashboard,
        postRegistrationRoute: config.postRegistrationRoute,
        onboardingSteps: config.onboardingSteps,
        recommendedWorkflows: config.recommendedWorkflows,
        navigationHighlights: config.navigationHighlights,
        universalCapabilities: true,
      };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // GET /api/membership/permission-model — Program 5A
  app.get('/api/membership/permission-model', async () => ({
    levels: PERMISSION_LEVELS,
    scopes: RESOURCE_SCOPES,
    hierarchy: [
      'organization', 'workspace', 'case', 'folder', 'evidence', 'document',
      'page', 'ai_analysis', 'report', 'knowledge_graph', 'data_result',
    ],
  }));

  // Publication sets — Program 6A
  app.get('/api/cases/:caseId/publication-sets', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const { caseId } = request.params as { caseId: string };
      if (!(await requireCaseAccess(ctx, caseId, 'view'))) return sendForbidden(reply);
      const sets = await listPublicationSets(ctx.tenantId, caseId);
      return { sets };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  app.post('/api/cases/:caseId/publication-sets', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const { caseId } = request.params as { caseId: string };
      if (!(await requireCaseAccess(ctx, caseId, 'approve'))) return sendForbidden(reply);
      const body = request.body as {
        name: string;
        profileName: string;
        documentIds: string[];
        redactionIds?: Record<string, string>;
      };
      const set = await createPublicationSet({
        tenantId: ctx.tenantId,
        caseId,
        name: body.name,
        profileName: body.profileName,
        documentIds: body.documentIds,
        redactionIds: body.redactionIds,
        createdById: ctx.userId,
      });
      return reply.code(201).send({ set });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Publication set failed' });
    }
  });

  app.post('/api/cases/:caseId/publication-sets/:setId/publish', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const { caseId, setId } = request.params as { caseId: string; setId: string };
      if (!(await requireCaseAccess(ctx, caseId, 'publish'))) return sendForbidden(reply);
      const result = await publishPublicationSet(setId, ctx.userId);
      return result;
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Publish failed' });
    }
  });

  app.get('/api/cases/:caseId/documents/:documentId/copies', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const { caseId, documentId } = request.params as { caseId: string; documentId: string };
      if (!(await requireCaseAccess(ctx, caseId, 'view'))) return sendForbidden(reply);
      const copies = await listDocumentCopies(ctx.tenantId, caseId, documentId);
      return { copies };
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  app.post('/api/cases/:caseId/documents/:documentId/copies/original', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const ctx = authCtx(request);
      const { caseId, documentId } = request.params as { caseId: string; documentId: string };
      if (!(await requireCaseAccess(ctx, caseId, 'upload'))) return sendForbidden(reply);
      const body = request.body as { s3Key?: string };
      const evidence = await prisma.evidence.findFirst({
        where: { evidenceId: documentId, caseId, tenantId: ctx.tenantId },
      });
      const copy = await ensureDocumentCopyChain(
        ctx.tenantId,
        caseId,
        documentId,
        body.s3Key ?? evidence?.s3Key ?? null,
        ctx.userId,
      );
      return reply.code(201).send({ copy });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : 'Copy creation failed' });
    }
  });
}
