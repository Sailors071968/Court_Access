// ============================================================================
// Domain V — Attorney Workbench API Routes
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import prisma from '../lib/prisma.js';
import { buildAttorneyWorkbench } from './workbenchService.js';
import { generateWorkbenchExport } from './exportService.js';
import type { ExportPackageType } from './types.js';
import { WORKBENCH_VERSION } from './types.js';
import { guardAuth, guardCaseAccess } from '../membership/resourceAuthMiddleware.js';

const EXPORT_TYPES: ExportPackageType[] = [
  'attorney_report',
  'trial_notebook',
  'evidence_package',
  'witness_binder',
  'authority_binder',
  'motion_package',
  'discovery_package',
  'investigation_package',
  'chronology',
];

export async function registerWorkbenchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/cases/:caseId/workbench', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;

    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const workbench = await buildAttorneyWorkbench(caseId, user.tenantId, user.userId);
    if (!workbench) return reply.code(404).send({ error: 'Case not found' });

    return reply.send(workbench);
  });

  app.get('/api/cases/:caseId/workbench/command-center', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const workbench = await buildAttorneyWorkbench(caseId, user.tenantId, user.userId);
    if (!workbench) return reply.code(404).send({ error: 'Case not found' });

    return reply.send(workbench.commandCenter);
  });

  app.get('/api/cases/:caseId/workbench/trial-prep', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const workbench = await buildAttorneyWorkbench(caseId, user.tenantId, user.userId);
    if (!workbench) return reply.code(404).send({ error: 'Case not found' });

    return reply.send(workbench.trialPreparation);
  });

  app.get('/api/cases/:caseId/workbench/export/:packageType', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId, packageType } = request.params as { caseId: string; packageType: string };
    if (!EXPORT_TYPES.includes(packageType as ExportPackageType)) {
      return reply.code(400).send({ error: 'Invalid export type', validTypes: EXPORT_TYPES });
    }

    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const workbench = await buildAttorneyWorkbench(caseId, user.tenantId, user.userId);
    if (!workbench) return reply.code(404).send({ error: 'Case not found' });

    const exportPackage = generateWorkbenchExport(workbench, packageType as ExportPackageType);
    void logSecurityEvent('WORKBENCH_EXPORT', user.userId, request.ip, `caseId=${caseId} type=${packageType}`);

    return reply.send(exportPackage);
  });

  // Notes CRUD
  app.get('/api/cases/:caseId/workbench/notes', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const notes = await prisma.attorneyNote.findMany({
      where: { caseId, tenantId: user.tenantId, userId: user.userId },
      orderBy: { updatedAt: 'desc' },
    });
    return reply.send({ notes });
  });

  app.post('/api/cases/:caseId/workbench/notes', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };
    const body = request.body as { content?: string; title?: string; entityType?: string; entityId?: string };

    if (!body.content?.trim()) {
      return reply.code(400).send({ error: 'content is required' });
    }
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const note = await prisma.attorneyNote.create({
      data: {
        caseId,
        tenantId: user.tenantId,
        userId: user.userId,
        title: body.title?.trim() ?? null,
        content: body.content.trim(),
        entityType: body.entityType ?? null,
        entityId: body.entityId ?? null,
      },
    });

    void logSecurityEvent('WORKBENCH_NOTE_CREATED', user.userId, request.ip, `caseId=${caseId} noteId=${note.id}`);
    return reply.code(201).send({ note });
  });

  app.patch('/api/cases/:caseId/workbench/notes/:noteId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId, noteId } = request.params as { caseId: string; noteId: string };
    const body = request.body as { content?: string; title?: string };

    const existing = await prisma.attorneyNote.findFirst({
      where: { id: noteId, caseId, tenantId: user.tenantId, userId: user.userId },
    });
    if (!existing) return reply.code(404).send({ error: 'Note not found' });

    const note = await prisma.attorneyNote.update({
      where: { id: noteId },
      data: {
        title: body.title !== undefined ? body.title?.trim() ?? null : undefined,
        content: body.content?.trim() ?? undefined,
      },
    });
    return reply.send({ note });
  });

  app.delete('/api/cases/:caseId/workbench/notes/:noteId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId, noteId } = request.params as { caseId: string; noteId: string };
    const existing = await prisma.attorneyNote.findFirst({
      where: { id: noteId, caseId, tenantId: user.tenantId, userId: user.userId },
    });
    if (!existing) return reply.code(404).send({ error: 'Note not found' });

    await prisma.attorneyNote.delete({ where: { id: noteId } });
    return reply.send({ status: 'deleted' });
  });

  // Pins
  app.get('/api/cases/:caseId/workbench/pins', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const pins = await prisma.workbenchPin.findMany({
      where: { caseId, tenantId: user.tenantId, userId: user.userId },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ pins });
  });

  app.post('/api/cases/:caseId/workbench/pins', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };
    const body = request.body as { pinType?: string; entityId?: string; label?: string };

    if (!body.pinType || !body.entityId) {
      return reply.code(400).send({ error: 'pinType and entityId are required' });
    }
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const pin = await prisma.workbenchPin.upsert({
      where: {
        caseId_tenantId_userId_pinType_entityId: {
          caseId,
          tenantId: user.tenantId,
          userId: user.userId,
          pinType: body.pinType,
          entityId: body.entityId,
        },
      },
      create: {
        caseId,
        tenantId: user.tenantId,
        userId: user.userId,
        pinType: body.pinType,
        entityId: body.entityId,
        label: body.label ?? null,
      },
      update: { label: body.label ?? null },
    });

    return reply.code(201).send({ pin });
  });

  app.delete('/api/cases/:caseId/workbench/pins/:pinId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId, pinId } = request.params as { caseId: string; pinId: string };
    const existing = await prisma.workbenchPin.findFirst({
      where: { id: pinId, caseId, tenantId: user.tenantId, userId: user.userId },
    });
    if (!existing) return reply.code(404).send({ error: 'Pin not found' });

    await prisma.workbenchPin.delete({ where: { id: pinId } });
    return reply.send({ status: 'deleted' });
  });

  // Investigation tasks
  app.get('/api/cases/:caseId/workbench/tasks', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const tasks = await prisma.investigationTask.findMany({
      where: { caseId, tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ tasks });
  });

  app.post('/api/cases/:caseId/workbench/tasks', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId } = request.params as { caseId: string };
    const body = request.body as {
      title?: string;
      description?: string;
      priority?: string;
      assignedTo?: string;
      dueDate?: string;
      sourceType?: string;
      sourceId?: string;
    };

    if (!body.title?.trim()) {
      return reply.code(400).send({ error: 'title is required' });
    }
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const task = await prisma.investigationTask.create({
      data: {
        caseId,
        tenantId: user.tenantId,
        title: body.title.trim(),
        description: body.description?.trim() ?? null,
        priority: body.priority ?? 'medium',
        assignedTo: body.assignedTo ?? null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        sourceType: body.sourceType ?? null,
        sourceId: body.sourceId ?? null,
        createdBy: user.userId,
      },
    });

    void logSecurityEvent('WORKBENCH_TASK_CREATED', user.userId, request.ip, `caseId=${caseId} taskId=${task.id}`);
    return reply.code(201).send({ task });
  });

  app.patch('/api/cases/:caseId/workbench/tasks/:taskId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId, taskId } = request.params as { caseId: string; taskId: string };
    const body = request.body as {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      assignedTo?: string;
      dueDate?: string;
    };

    const existing = await prisma.investigationTask.findFirst({
      where: { id: taskId, caseId, tenantId: user.tenantId },
    });
    if (!existing) return reply.code(404).send({ error: 'Task not found' });

    const task = await prisma.investigationTask.update({
      where: { id: taskId },
      data: {
        title: body.title?.trim(),
        description: body.description !== undefined ? body.description?.trim() ?? null : undefined,
        status: body.status,
        priority: body.priority,
        assignedTo: body.assignedTo,
        dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
      },
    });
    return reply.send({ task });
  });

  app.delete('/api/cases/:caseId/workbench/tasks/:taskId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });

    const { caseId, taskId } = request.params as { caseId: string; taskId: string };
    const existing = await prisma.investigationTask.findFirst({
      where: { id: taskId, caseId, tenantId: user.tenantId },
    });
    if (!existing) return reply.code(404).send({ error: 'Task not found' });

    await prisma.investigationTask.delete({ where: { id: taskId } });
    return reply.send({ status: 'deleted' });
  });

  app.get('/api/workbench/health', async (_request, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      engine: 'attorney-workbench',
      version: WORKBENCH_VERSION,
      message: 'Attorney Workbench operational',
    });
  });

  console.log('[Workbench] Attorney Workbench routes registered');
}
