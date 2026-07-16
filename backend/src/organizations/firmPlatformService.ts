// ============================================================================
// Program 2 — Law Firm Operating Platform Service
// Personnel, collaboration, knowledge, conflicts, permissions, analytics
// ============================================================================

import prisma from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { logSecurityEvent } from '../security/authMiddleware.js';

export const PERSONNEL_TYPES = [
  'attorney', 'investigator', 'paralegal', 'legal_assistant',
  'office_admin', 'receptionist', 'expert_witness', 'contract_investigator',
] as const;

export const KNOWLEDGE_TYPES = ['internal_note', 'research', 'motion', 'template', 'procedure', 'policy'] as const;

export async function createDepartment(tenantId: string, data: { name: string; description?: string; officeId?: string }) {
  return prisma.organizationDepartment.create({
    data: { organizationId: tenantId, name: data.name, description: data.description, officeId: data.officeId },
  });
}

export async function listDepartments(tenantId: string, officeId?: string) {
  return prisma.organizationDepartment.findMany({
    where: { organizationId: tenantId, ...(officeId ? { officeId } : {}) },
    include: { office: { select: { officeId: true, name: true } }, _count: { select: { members: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function upsertPersonnelProfile(
  tenantId: string,
  userId: string,
  data: {
    personnelType: string;
    jobTitle?: string;
    barNumber?: string;
    phone?: string;
    bio?: string;
    certifications?: Prisma.InputJsonValue;
    licenses?: Prisma.InputJsonValue;
    permissions?: Prisma.InputJsonValue;
    calendarSettings?: Prisma.InputJsonValue;
  },
) {
  await prisma.organizationMember.updateMany({
    where: { userId, organizationId: tenantId },
    data: { personnelType: data.personnelType },
  });

  return prisma.personnelProfile.upsert({
    where: { userId },
    create: { organizationId: tenantId, userId, ...data },
    update: data,
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
}

export async function listPersonnel(tenantId: string, filters?: { personnelType?: string; officeId?: string }) {
  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId: tenantId,
      status: 'active',
      ...(filters?.officeId ? { officeId: filters.officeId } : {}),
      ...(filters?.personnelType ? { personnelType: filters.personnelType } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      office: { select: { officeId: true, name: true } },
      department: { select: { departmentId: true, name: true } },
      practiceGroup: { select: { practiceGroupId: true, name: true } },
    },
  });

  const profiles = await prisma.personnelProfile.findMany({
    where: { organizationId: tenantId, userId: { in: members.map((m) => m.userId) } },
  });
  const profileMap = new Map(profiles.map((p) => [p.userId, p]));

  const caseloads = await prisma.criminalCase.groupBy({
    by: ['ownerId'],
    where: { tenantId, deletedAt: null, status: 'active' },
    _count: { caseId: true },
  });
  const caseloadMap = new Map(caseloads.map((c) => [c.ownerId, c._count.caseId]));

  return members.map((m) => ({
    ...m,
    profile: profileMap.get(m.userId) ?? null,
    activeCases: caseloadMap.get(m.userId) ?? 0,
  }));
}

export async function assignClientTeam(
  tenantId: string,
  clientId: string,
  data: {
    primaryAttorneyId?: string;
    secondaryAttorneyId?: string;
    investigatorId?: string;
    paralegalId?: string;
    legalAssistantId?: string;
    officeId?: string;
  },
) {
  const client = await prisma.client.findFirst({ where: { clientId, tenantId, deletedAt: null } });
  if (!client) throw new Error('Client not found');

  return prisma.clientTeamAssignment.upsert({
    where: { clientId },
    create: { clientId, tenantId, ...data },
    update: data,
  });
}

export async function getClientTeamAssignment(tenantId: string, clientId: string) {
  return prisma.clientTeamAssignment.findFirst({
    where: { clientId, tenantId },
  });
}

export async function sendInternalMessage(
  tenantId: string,
  senderId: string,
  data: { body: string; recipientId?: string; channel?: string; channelRef?: string },
) {
  return prisma.orgInternalMessage.create({
    data: {
      organizationId: tenantId,
      senderId,
      recipientId: data.recipientId,
      channel: data.channel ?? 'direct',
      channelRef: data.channelRef,
      body: data.body,
    },
    include: { sender: { select: { id: true, name: true } } },
  });
}

export async function listInternalMessages(tenantId: string, userId: string, limit = 50) {
  return prisma.orgInternalMessage.findMany({
    where: {
      organizationId: tenantId,
      OR: [{ recipientId: userId }, { recipientId: null }, { senderId: userId }],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { sender: { select: { id: true, name: true } } },
  });
}

export async function createOrgTask(
  tenantId: string,
  assignerId: string,
  data: {
    title: string;
    description?: string;
    taskType?: string;
    caseId?: string;
    assigneeId?: string;
    dueDate?: string;
  },
) {
  return prisma.orgTask.create({
    data: {
      organizationId: tenantId,
      tenantId,
      assignerId,
      title: data.title,
      description: data.description,
      taskType: data.taskType ?? 'general',
      caseId: data.caseId,
      assigneeId: data.assigneeId,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    },
  });
}

export async function listOrgTasks(tenantId: string, filters?: { assigneeId?: string; status?: string }) {
  return prisma.orgTask.findMany({
    where: {
      tenantId,
      ...(filters?.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateOrgTaskStatus(tenantId: string, taskId: string, status: string) {
  return prisma.orgTask.updateMany({
    where: { taskId, tenantId },
    data: { status, completedAt: status === 'complete' ? new Date() : null },
  });
}

export async function createKnowledgeAsset(
  tenantId: string,
  createdById: string,
  data: { assetType: string; title: string; body: string; tags?: string },
) {
  return prisma.knowledgeAsset.create({
    data: { organizationId: tenantId, tenantId, createdById, ...data },
  });
}

export async function listKnowledgeAssets(tenantId: string, assetType?: string) {
  return prisma.knowledgeAsset.findMany({
    where: { tenantId, ...(assetType ? { assetType } : {}), isPublished: true },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function runConflictCheck(tenantId: string, query: { name: string; type?: string }) {
  const name = query.name.trim();
  if (name.length < 2) return { conflicts: [], query: name };

  const [clients, cases] = await Promise.all([
    prisma.client.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { firstName: { contains: name, mode: 'insensitive' } },
          { lastName: { contains: name, mode: 'insensitive' } },
        ],
      },
      take: 10,
    }),
    prisma.criminalCase.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { title: { contains: name, mode: 'insensitive' } },
          { caseNumber: { contains: name, mode: 'insensitive' } },
        ],
      },
      take: 10,
      include: { client: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const conflicts: Array<{ conflictType: string; entityA: string; entityB: string; severity: string; details: string }> = [];

  for (const c of clients) {
    conflicts.push({
      conflictType: 'client',
      entityA: name,
      entityB: `${c.firstName} ${c.lastName}`,
      severity: 'review',
      details: `Existing client ${c.clientId} (${c.status})`,
    });
  }

  for (const c of cases) {
    conflicts.push({
      conflictType: 'related_case',
      entityA: name,
      entityB: c.title,
      severity: 'review',
      details: `Related case ${c.caseNumber}`,
    });
  }

  const records = [];
  for (const conflict of conflicts) {
    const record = await prisma.conflictRecord.create({
      data: { organizationId: tenantId, tenantId, ...conflict, status: 'open' },
    });
    records.push(record);
  }

  return { conflicts: records, query: name, clientMatches: clients.length, caseMatches: cases.length };
}

export async function listConflictRecords(tenantId: string, status?: string) {
  return prisma.conflictRecord.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    orderBy: { detectedAt: 'desc' },
  });
}

export async function grantPermission(
  tenantId: string,
  grantedById: string,
  data: { userId: string; scope: string; permission: string; resourceId?: string; departmentId?: string },
) {
  return prisma.permissionGrant.create({
    data: { organizationId: tenantId, grantedById, ...data },
  });
}

export async function listPermissionGrants(tenantId: string, userId?: string) {
  return prisma.permissionGrant.findMany({
    where: { organizationId: tenantId, ...(userId ? { userId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createApprovalRequest(
  tenantId: string,
  requestedById: string,
  data: { requestType: string; resourceType: string; resourceId: string; approverId?: string; notes?: string },
) {
  return prisma.approvalRequest.create({
    data: { organizationId: tenantId, tenantId, requestedById, ...data },
  });
}

export async function decideApprovalRequest(
  tenantId: string,
  requestId: string,
  approverId: string,
  status: 'approved' | 'denied',
  notes?: string,
) {
  return prisma.approvalRequest.updateMany({
    where: { requestId, tenantId, status: 'pending' },
    data: { status, approverId, notes, decidedAt: new Date() },
  });
}

export async function getExpandedFirmAnalytics(tenantId: string, officeId?: string) {
  const caseFilter = { tenantId, deletedAt: null, ...(officeId ? { officeId } : {}) };

  const [
    activeCases, closedCases, newClientsMonth, evidenceCount,
    members, tasksPending, conflictsOpen, knowledgeCount,
  ] = await Promise.all([
    prisma.criminalCase.count({ where: { ...caseFilter, status: 'active' } }),
    prisma.criminalCase.count({ where: { ...caseFilter, status: { in: ['closed', 'archived'] } } }),
    prisma.client.count({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        ...(officeId ? { teamAssignment: { officeId } } : {}),
      },
    }),
    prisma.evidence.count({ where: { tenantId } }),
    prisma.organizationMember.count({ where: { organizationId: tenantId, status: 'active', ...(officeId ? { officeId } : {}) } }),
    prisma.orgTask.count({ where: { tenantId, status: 'pending' } }),
    prisma.conflictRecord.count({ where: { tenantId, status: 'open' } }),
    prisma.knowledgeAsset.count({ where: { tenantId } }),
  ]);

  const attorneyMembers = await prisma.organizationMember.findMany({
    where: { organizationId: tenantId, role: 'attorney', status: 'active' },
    select: { userId: true },
  });
  const investigatorMembers = await prisma.organizationMember.findMany({
    where: { organizationId: tenantId, role: 'investigator', status: 'active' },
    select: { userId: true },
  });

  const attorneyIds = attorneyMembers.map((m) => m.userId);
  const investigatorIds = investigatorMembers.map((m) => m.userId);

  const [attorneyCases, investigatorTasks] = await Promise.all([
    attorneyIds.length
      ? prisma.criminalCase.groupBy({ by: ['ownerId'], where: { tenantId, ownerId: { in: attorneyIds }, deletedAt: null }, _count: { caseId: true } })
      : Promise.resolve([]),
    investigatorIds.length
      ? prisma.orgTask.groupBy({ by: ['assigneeId'], where: { tenantId, assigneeId: { in: investigatorIds } }, _count: { taskId: true } })
      : Promise.resolve([]),
  ]);

  const offices = await prisma.organizationOffice.findMany({
    where: { organizationId: tenantId },
    include: {
      _count: { select: { members: true } },
    },
  });

  const officeStats = await Promise.all(offices.map(async (office) => ({
    officeId: office.officeId,
    name: office.name,
    city: office.city,
    staff: office._count.members,
    activeCases: await prisma.criminalCase.count({ where: { tenantId, officeId: office.officeId, status: 'active', deletedAt: null } }),
  })));

  return {
    activeCases,
    closedCases,
    newClientsMonth,
    evidenceProcessed: evidenceCount,
    staffCount: members,
    pendingTasks: tasksPending,
    openConflicts: conflictsOpen,
    knowledgeAssets: knowledgeCount,
    attorneyProductivity: attorneyCases.map((a) => ({ userId: a.ownerId, activeCases: a._count.caseId })),
    investigatorProductivity: investigatorTasks.map((t) => ({ userId: t.assigneeId, assignedTasks: t._count.taskId })),
    officeStats,
    generatedAt: new Date().toISOString(),
  };
}

export async function updateOrganizationTheme(tenantId: string, themeSettings: Record<string, unknown>, branding?: {
  logoUrl?: string; primaryColor?: string; secondaryColor?: string;
}) {
  return prisma.organization.update({
    where: { id: tenantId },
    data: {
      themeSettings: themeSettings as Prisma.InputJsonValue,
      logoUrl: branding?.logoUrl,
      primaryColor: branding?.primaryColor,
      secondaryColor: branding?.secondaryColor,
    },
  });
}

export async function seedCaliforniaOffices(tenantId: string) {
  const existing = await prisma.organizationOffice.count({ where: { organizationId: tenantId } });
  if (existing >= 4) return listOffices(tenantId);

  const offices = [
    { name: 'Sacramento Office', city: 'Sacramento', state: 'CA', isBranch: true },
    { name: 'Los Angeles Office', city: 'Los Angeles', state: 'CA', isBranch: true, isPrimary: true },
    { name: 'San Diego Office', city: 'San Diego', state: 'CA', isBranch: true },
    { name: 'San Francisco Office', city: 'San Francisco', state: 'CA', isBranch: true },
  ];

  for (const o of offices) {
    const found = await prisma.organizationOffice.findFirst({
      where: { organizationId: tenantId, city: o.city },
    });
    if (!found) {
      await prisma.organizationOffice.create({
        data: { organizationId: tenantId, name: o.name, city: o.city, state: o.state, isBranch: o.isBranch, isPrimary: o.isPrimary ?? false },
      });
    }
  }
  return listOffices(tenantId);
}

async function listOffices(tenantId: string) {
  return prisma.organizationOffice.findMany({ where: { organizationId: tenantId }, orderBy: { name: 'asc' } });
}

export async function logFirmAudit(event: string, userId: string, tenantId: string, ip?: string, details?: string) {
  void logSecurityEvent(event, userId, ip, details ?? tenantId);
}
