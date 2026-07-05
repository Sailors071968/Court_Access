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
import { createRedactionVersion, listRedactionVersions } from './redactionService.js';
import { createDisclosurePackage, listDisclosurePackages, listSharedAccessForUser } from './disclosureService.js';

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
            id: true, email: true, name: true, role: true,
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
}
