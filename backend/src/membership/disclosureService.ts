// ============================================================================
// Program 1 — Disclosure Manager Service
// Controlled publication to authorized recipients only.
// ============================================================================

import prisma from '../lib/prisma.js';

export interface CreateDisclosureInput {
  tenantId: string;
  caseId: string;
  documentId: string;
  redactionId?: string;
  recipientType: string;
  recipientUserId?: string;
  recipientEmail?: string;
  publishedById: string;
}

export async function createDisclosurePackage(input: CreateDisclosureInput) {
  return prisma.disclosurePackage.create({
    data: {
      tenantId: input.tenantId,
      caseId: input.caseId,
      documentId: input.documentId,
      redactionId: input.redactionId ?? null,
      recipientType: input.recipientType,
      recipientUserId: input.recipientUserId ?? null,
      recipientEmail: input.recipientEmail ?? null,
      publishedById: input.publishedById,
      status: 'draft',
    },
  });
}

export async function publishDisclosurePackage(packageId: string) {
  return prisma.disclosurePackage.update({
    where: { packageId },
    data: { status: 'published', publishedAt: new Date() },
  });
}

export async function listDisclosurePackages(tenantId: string, caseId: string) {
  return prisma.disclosurePackage.findMany({
    where: { tenantId, caseId },
    orderBy: { createdAt: 'desc' },
  });
}

/** My Shared Access — workspaces visible to delegated users. */
export async function listSharedAccessForUser(userId: string) {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId, status: 'active' },
    include: {
      organization: { select: { id: true, name: true, orgType: true } },
    },
  });

  const workspaces = [];
  for (const m of memberships) {
    const grants = await prisma.permissionGrant.findMany({
      where: { organizationId: m.organizationId, userId },
    });

    const accessible = await prisma.criminalCase.findMany({
      where: grants.some((g) => g.scope === 'case' && g.resourceId)
        ? { caseId: { in: grants.map((g) => g.resourceId).filter(Boolean) as string[] } }
        : { tenantId: m.organizationId },
      select: { caseId: true, title: true, caseNumber: true },
      take: 20,
    });

    const disclosures = await prisma.disclosurePackage.findMany({
      where: {
        tenantId: m.organizationId,
        OR: [{ recipientUserId: userId }, { status: 'published' }],
      },
      select: {
        packageId: true,
        caseId: true,
        documentId: true,
        recipientType: true,
        status: true,
        publishedAt: true,
      },
      take: 50,
    });

    workspaces.push({
      sharedBy: m.organization.name,
      organizationId: m.organizationId,
      role: m.role,
      cases: accessible,
      disclosures,
      permissions: grants.map((g) => ({
        scope: g.scope,
        resourceId: g.resourceId,
        permission: g.permission,
      })),
    });
  }

  return workspaces;
}
