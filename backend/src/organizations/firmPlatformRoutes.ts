// ============================================================================
// Program 2 — Law Firm Operating Platform Routes
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import { ensureMembership } from './organizationService.js';
import { isOrgAdmin } from './organizationTypes.js';
import {
  assignClientTeam,
  createApprovalRequest,
  createDepartment,
  createKnowledgeAsset,
  createOrgTask,
  decideApprovalRequest,
  getClientTeamAssignment,
  getExpandedFirmAnalytics,
  grantPermission,
  listConflictRecords,
  listDepartments,
  listInternalMessages,
  listKnowledgeAssets,
  listOrgTasks,
  listPermissionGrants,
  listPersonnel,
  runConflictCheck,
  seedCaliforniaOffices,
  sendInternalMessage,
  updateOrgTaskStatus,
  updateOrganizationTheme,
  upsertPersonnelProfile,
} from './firmPlatformService.js';

async function requireOrgContext(request: AuthenticatedRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) { reply.code(401).send({ error: 'Authentication required' }); return null; }
  const member = await ensureMembership(user.userId, user.tenantId);
  if (!member) { reply.code(403).send({ error: 'Organization membership not found' }); return null; }
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

export async function registerFirmPlatformRoutes(app: FastifyInstance): Promise<void> {
  // --- Departments ---
  app.get('/api/firm/departments', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const { officeId } = request.query as { officeId?: string };
    return { departments: await listDepartments(ctx.user.tenantId, officeId) };
  });

  app.post('/api/firm/departments', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    const dept = await createDepartment(ctx.user.tenantId, request.body as Parameters<typeof createDepartment>[1]);
    void logSecurityEvent('FIRM_DEPARTMENT_CREATED', ctx.user.userId, request.ip, dept.departmentId);
    return reply.code(201).send({ department: dept });
  });

  // --- Personnel ---
  app.get('/api/firm/personnel', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const { personnelType, officeId } = request.query as { personnelType?: string; officeId?: string };
    return { personnel: await listPersonnel(ctx.user.tenantId, { personnelType, officeId }) };
  });

  app.put('/api/firm/personnel/:userId', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    const { userId } = request.params as { userId: string };
    const profile = await upsertPersonnelProfile(ctx.user.tenantId, userId, request.body as Parameters<typeof upsertPersonnelProfile>[2]);
    return { profile };
  });

  // --- Client assignments ---
  app.get('/api/firm/clients/:clientId/team', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const { clientId } = request.params as { clientId: string };
    return { assignment: await getClientTeamAssignment(ctx.user.tenantId, clientId) };
  });

  app.put('/api/firm/clients/:clientId/team', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    const { clientId } = request.params as { clientId: string };
    const assignment = await assignClientTeam(ctx.user.tenantId, clientId, request.body as Parameters<typeof assignClientTeam>[2]);
    void logSecurityEvent('CLIENT_TEAM_ASSIGNED', ctx.user.userId, request.ip, clientId);
    return { assignment };
  });

  // --- Internal messaging ---
  app.get('/api/firm/messages', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    return { messages: await listInternalMessages(ctx.user.tenantId, ctx.user.userId) };
  });

  app.post('/api/firm/messages', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const body = request.body as { body: string; recipientId?: string; channel?: string; channelRef?: string };
    const message = await sendInternalMessage(ctx.user.tenantId, ctx.user.userId, body);
    return reply.code(201).send({ message });
  });

  // --- Tasks ---
  app.get('/api/firm/tasks', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const { assigneeId, status } = request.query as { assigneeId?: string; status?: string };
    return { tasks: await listOrgTasks(ctx.user.tenantId, { assigneeId, status }) };
  });

  app.post('/api/firm/tasks', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const task = await createOrgTask(ctx.user.tenantId, ctx.user.userId, request.body as Parameters<typeof createOrgTask>[2]);
    return reply.code(201).send({ task });
  });

  app.patch('/api/firm/tasks/:taskId', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const { taskId } = request.params as { taskId: string };
    const { status } = request.body as { status: string };
    await updateOrgTaskStatus(ctx.user.tenantId, taskId, status);
    return { message: 'Task updated' };
  });

  // --- Knowledge ---
  app.get('/api/firm/knowledge', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const { type } = request.query as { type?: string };
    return { assets: await listKnowledgeAssets(ctx.user.tenantId, type) };
  });

  app.post('/api/firm/knowledge', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const asset = await createKnowledgeAsset(ctx.user.tenantId, ctx.user.userId, request.body as Parameters<typeof createKnowledgeAsset>[2]);
    return reply.code(201).send({ asset });
  });

  // --- Conflicts ---
  app.post('/api/firm/conflicts/check', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const result = await runConflictCheck(ctx.user.tenantId, request.body as { name: string });
    return result;
  });

  app.get('/api/firm/conflicts', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const { status } = request.query as { status?: string };
    return { conflicts: await listConflictRecords(ctx.user.tenantId, status) };
  });

  // --- Permissions ---
  app.get('/api/firm/permissions', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    const { userId } = request.query as { userId?: string };
    return { grants: await listPermissionGrants(ctx.user.tenantId, userId) };
  });

  app.post('/api/firm/permissions', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    const grant = await grantPermission(ctx.user.tenantId, ctx.user.userId, request.body as Parameters<typeof grantPermission>[2]);
    return reply.code(201).send({ grant });
  });

  // --- Approvals ---
  app.post('/api/firm/approvals', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const approval = await createApprovalRequest(ctx.user.tenantId, ctx.user.userId, request.body as Parameters<typeof createApprovalRequest>[2]);
    return reply.code(201).send({ approval });
  });

  app.patch('/api/firm/approvals/:requestId', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    const { requestId } = request.params as { requestId: string };
    const { status, notes } = request.body as { status: 'approved' | 'denied'; notes?: string };
    await decideApprovalRequest(ctx.user.tenantId, requestId, ctx.user.userId, status, notes);
    return { message: `Request ${status}` };
  });

  // --- Analytics (expanded) ---
  app.get('/api/firm/analytics', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgContext(request, reply);
    if (!ctx) return;
    const { officeId } = request.query as { officeId?: string };
    return { analytics: await getExpandedFirmAnalytics(ctx.user.tenantId, officeId) };
  });

  // --- Theme / branding ---
  app.patch('/api/firm/theme', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    const body = request.body as { themeSettings: Record<string, unknown>; logoUrl?: string; primaryColor?: string; secondaryColor?: string };
    const org = await updateOrganizationTheme(ctx.user.tenantId, body.themeSettings, body);
    return { organization: org };
  });

  // --- Multi-office seed (California branch offices) ---
  app.post('/api/firm/offices/seed-california', async (request: AuthenticatedRequest, reply) => {
    const ctx = await requireOrgAdmin(request, reply);
    if (!ctx) return;
    const offices = await seedCaliforniaOffices(ctx.user.tenantId);
    return { offices };
  });
}
