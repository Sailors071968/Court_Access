// ============================================================================
// Program 2 — Organization Service
// Business logic for multi-tenant law firm platform
// ============================================================================

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma.js';
import { DELEGATED_USER_LIMIT } from '../membership/universalMembership.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import type { UserRole } from '../security/authMiddleware.js';
import {
  type CreateInvitationBody,
  type CreateOfficeBody,
  type CreatePracticeGroupBody,
  type OnboardingBody,
  type UpdateOrganizationBody,
  isOrgAdmin,
  validateMemberRole,
  validateOnboardingStep,
} from './organizationTypes.js';

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;

export async function ensureMembership(userId: string, tenantId: string) {
  // userId alone is not unique on OrganizationMember — the unique key is the
  // (organizationId, userId) pair — so findUnique rejected the call and every
  // organisation route answered 500.
  const existing = await prisma.organizationMember.findFirst({ where: { userId } });
  if (existing) return existing;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.tenantId !== tenantId) return null;

  return prisma.organizationMember.create({
    data: {
      organizationId: tenantId,
      userId,
      role: user.role,
      status: 'active',
    },
  });
}

export async function getOrganizationForUser(tenantId: string) {
  return prisma.organization.findUnique({
    where: { id: tenantId },
    include: {
      offices: { orderBy: { isPrimary: 'desc' } },
      practiceGroups: { orderBy: { name: 'asc' } },
      _count: { select: { members: true, invitations: { where: { status: 'pending' } } } },
    },
  });
}

export async function updateOrganization(tenantId: string, body: UpdateOrganizationBody) {
  return prisma.organization.update({
    where: { id: tenantId },
    data: {
      name: body.name,
      orgType: body.orgType,
      settings: body.settings ?? undefined,
      logoUrl: body.logoUrl,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      tagline: body.tagline,
      website: body.website,
      billingEmail: body.billingEmail,
    },
  });
}

export async function advanceOnboarding(tenantId: string, body: OnboardingBody) {
  if (!validateOnboardingStep(body.step)) {
    throw new Error('Invalid onboarding step');
  }

  if (body.profile) {
    await updateOrganization(tenantId, body.profile);
  }

  if (body.step === 'offices' && body.primaryOffice) {
    await createOffice(tenantId, { ...body.primaryOffice, isPrimary: true });
  }

  const data: { onboardingStep: string; onboardingCompletedAt?: Date } = { onboardingStep: body.step };
  if (body.step === 'complete') {
    data.onboardingCompletedAt = new Date();
  }

  return prisma.organization.update({ where: { id: tenantId }, data });
}

export async function createOffice(tenantId: string, body: CreateOfficeBody) {
  if (body.isPrimary) {
    await prisma.organizationOffice.updateMany({
      where: { organizationId: tenantId, isPrimary: true },
      data: { isPrimary: false },
    });
  }
  return prisma.organizationOffice.create({
    data: {
      organizationId: tenantId,
      name: body.name,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      state: body.state ?? 'CA',
      zip: body.zip,
      phone: body.phone,
      isPrimary: body.isPrimary ?? false,
    },
  });
}

export async function listOffices(tenantId: string) {
  return prisma.organizationOffice.findMany({
    where: { organizationId: tenantId },
    orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
  });
}

export async function createPracticeGroup(tenantId: string, body: CreatePracticeGroupBody) {
  if (body.officeId) {
    const office = await prisma.organizationOffice.findFirst({
      where: { officeId: body.officeId, organizationId: tenantId },
    });
    if (!office) throw new Error('Office not found in organization');
  }
  return prisma.practiceGroup.create({
    data: {
      organizationId: tenantId,
      officeId: body.officeId,
      name: body.name,
      description: body.description,
      practiceArea: body.practiceArea,
    },
  });
}

export async function listPracticeGroups(tenantId: string) {
  return prisma.practiceGroup.findMany({
    where: { organizationId: tenantId },
    include: { office: { select: { officeId: true, name: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function listMembers(tenantId: string) {
  return prisma.organizationMember.findMany({
    where: { organizationId: tenantId, status: 'active' },
    include: {
      user: { select: { id: true, email: true, name: true, role: true, createdAt: true } },
      office: { select: { officeId: true, name: true } },
      practiceGroup: { select: { practiceGroupId: true, name: true } },
    },
    orderBy: { joinedAt: 'asc' },
  });
}

export async function createInvitation(
  tenantId: string,
  invitedById: string,
  body: CreateInvitationBody,
) {
  if (!validateMemberRole(body.role)) throw new Error('Invalid invitation role');

  const memberCount = await prisma.organizationMember.count({
    where: { organizationId: tenantId, status: 'active' },
  });
  const pendingInvites = await prisma.organizationInvitation.count({
    where: { organizationId: tenantId, status: 'pending' },
  });
  if (DELEGATED_USER_LIMIT !== null) {
    const additionalMembers = Math.max(0, memberCount - 1);
    if (additionalMembers + pendingInvites >= DELEGATED_USER_LIMIT) {
      throw new Error(`Delegated user limit reached (${DELEGATED_USER_LIMIT} additional users)`);
    }
  }

  const email = body.email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMember = await prisma.organizationMember.findFirst({
      where: { organizationId: tenantId, userId: existingUser.id, status: 'active' },
    });
    if (existingMember) {
      throw new Error('User is already a member of this organization');
    }
  }

  await prisma.organizationInvitation.updateMany({
    where: { organizationId: tenantId, email, status: 'pending' },
    data: { status: 'revoked' },
  });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const invitation = await prisma.organizationInvitation.create({
    data: {
      organizationId: tenantId,
      email,
      role: body.role,
      officeId: body.officeId,
      practiceGroupId: body.practiceGroupId,
      tokenHash,
      invitedById,
      expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS),
    },
    include: { organization: { select: { name: true } } },
  });

  const frontendUrl = process.env.FRONTEND_URL || 'https://courtaccess.net';
  const inviteUrl = `${frontendUrl}/accept-invitation?token=${rawToken}`;

  try {
    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
    const ses = new SESClient({
      region: process.env.AWS_REGION ?? 'us-west-2',
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '' }
        : undefined,
    });
    await ses.send(new SendEmailCommand({
      Source: process.env.PASSWORD_RESET_FROM_EMAIL || 'noreply@courtaccess.net',
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: `Invitation to join ${invitation.organization.name} on Court Access`, Charset: 'UTF-8' },
        Body: {
          Html: {
            Data: `<p>You have been invited to join <strong>${invitation.organization.name}</strong> as <strong>${body.role}</strong>.</p><p><a href="${inviteUrl}">Accept invitation</a> (expires in 7 days).</p>`,
            Charset: 'UTF-8',
          },
        },
      },
    }));
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Org] INVITE URL for ${email}: ${inviteUrl}`);
    }
  }

  return { invitation, inviteUrl: process.env.NODE_ENV !== 'production' ? inviteUrl : undefined };
}

export async function getInvitationByToken(rawToken: string) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const invitation = await prisma.organizationInvitation.findFirst({
    where: { tokenHash, status: 'pending', expiresAt: { gt: new Date() } },
    include: { organization: { select: { id: true, name: true, orgType: true } } },
  });
  return invitation;
}

export async function acceptInvitation(
  rawToken: string,
  name: string,
  password: string,
  ip?: string,
) {
  const invitation = await getInvitationByToken(rawToken);
  if (!invitation) throw new Error('Invalid or expired invitation');

  const email = invitation.email;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('An account with this email already exists. Sign in instead.');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: invitation.role,
        tenantId: invitation.organizationId,
        officeId: invitation.officeId,
        practiceGroupId: invitation.practiceGroupId,
      },
    });

    await tx.organizationMember.create({
      data: {
        organizationId: invitation.organizationId,
        userId: created.id,
        role: invitation.role,
        officeId: invitation.officeId,
        practiceGroupId: invitation.practiceGroupId,
        invitedById: invitation.invitedById,
        status: 'active',
      },
    });

    await tx.subscription.create({
      data: {
        userId: created.id,
        planId: 'FREE',
        activatedAt: now,
        billingPeriodStart: now,
        billingPeriodEnd: new Date(now.getFullYear() + 100, 0, 1),
        subscriptionStatus: 'active',
        subscriptionTier: 'free',
      },
    });

    await tx.aiCreditBalance.create({
      data: {
        userId: created.id,
        monthlyCredits: 0,
        purchasedCredits: 0,
        creditsUsed: 0,
        billingPeriodStart: now,
        billingPeriodEnd: endOfMonth,
      },
    });

    await tx.organizationInvitation.update({
      where: { invitationId: invitation.invitationId },
      data: { status: 'accepted', acceptedAt: now },
    });

    return created;
  });

  void logSecurityEvent('ORG_INVITATION_ACCEPTED', user.id, ip, `org=${invitation.organizationId} role=${invitation.role}`);
  return user;
}

export async function getFirmAnalytics(tenantId: string) {
  const [members, clients, cases, evidence, pendingInvites] = await Promise.all([
    prisma.organizationMember.count({ where: { organizationId: tenantId, status: 'active' } }),
    prisma.client.count({ where: { tenantId, deletedAt: null } }),
    prisma.criminalCase.count({ where: { tenantId, deletedAt: null } }),
    prisma.evidence.count({ where: { tenantId } }),
    prisma.organizationInvitation.count({ where: { organizationId: tenantId, status: 'pending' } }),
  ]);

  const membersByRole = await prisma.organizationMember.groupBy({
    by: ['role'],
    where: { organizationId: tenantId, status: 'active' },
    _count: { role: true },
  });

  return {
    members,
    clients,
    cases,
    evidence,
    pendingInvites,
    membersByRole: Object.fromEntries(membersByRole.map((r) => [r.role, r._count.role])),
    generatedAt: new Date().toISOString(),
  };
}

export async function firmWideSearch(tenantId: string, query: string) {
  const q = query.trim();
  if (!q || q.length < 2) return { clients: [], cases: [] };

  const [clients, cases] = await Promise.all([
    prisma.client.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 20,
      select: { clientId: true, firstName: true, lastName: true, email: true, status: true },
    }),
    prisma.criminalCase.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { caseNumber: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 20,
      select: { caseId: true, title: true, caseNumber: true, status: true, clientId: true },
    }),
  ]);

  return { clients, cases, query: q };
}

export async function getOrganizationAuditLogs(tenantId: string, limit = 100) {
  const userIds = (await prisma.user.findMany({
    where: { tenantId },
    select: { id: true },
  })).map((u) => u.id);

  return prisma.securityLog.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function verifyTenantAccess(
  userTenantId: string,
  resourceTenantId: string,
): Promise<boolean> {
  return userTenantId === resourceTenantId;
}

export async function createOrganizationMemberOnRegister(
  userId: string,
  tenantId: string,
  role: UserRole,
) {
  return prisma.organizationMember.create({
    data: { organizationId: tenantId, userId, role, status: 'active' },
  });
}
