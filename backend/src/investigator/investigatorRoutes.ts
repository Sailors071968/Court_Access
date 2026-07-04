// ============================================================================
// Program 12 — Investigator Workbench API Routes
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import prisma from '../lib/prisma.js';
import { buildInvestigatorWorkbench } from './investigatorWorkbenchService.js';
import { INVESTIGATOR_WORKBENCH_VERSION } from './types.js';

async function ensureCaseAccess(caseId: string, tenantId: string): Promise<boolean> {
  const found = await prisma.criminalCase.findFirst({
    where: { caseId, tenantId, deletedAt: null },
    select: { caseId: true },
  });
  return Boolean(found);
}

function requireInvestigatorRole(user: { role: string } | undefined): boolean {
  return user?.role === 'investigator' || user?.role === 'attorney' || user?.role === 'admin' || user?.role === 'staff';
}

export async function registerInvestigatorRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/cases/:caseId/investigator-workbench', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    if (!requireInvestigatorRole(user)) return reply.code(403).send({ error: 'Investigator access required' });

    const { caseId } = request.params as { caseId: string };
    if (!(await ensureCaseAccess(caseId, user.tenantId))) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const workbench = await buildInvestigatorWorkbench(caseId, user.tenantId);
    if (!workbench) return reply.code(404).send({ error: 'Case not found' });
    return reply.send(workbench);
  });

  // Witnesses
  app.post('/api/cases/:caseId/investigator/witnesses', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || !requireInvestigatorRole(user)) return reply.code(403).send({ error: 'Forbidden' });

    const { caseId } = request.params as { caseId: string };
    const body = request.body as { name?: string; role?: string; contactPhone?: string; notes?: string };
    if (!body.name?.trim()) return reply.code(400).send({ error: 'name is required' });
    if (!(await ensureCaseAccess(caseId, user.tenantId))) return reply.code(403).send({ error: 'Forbidden' });

    const witness = await prisma.caseWitness.create({
      data: {
        caseId,
        tenantId: user.tenantId,
        name: body.name.trim(),
        role: body.role ?? null,
        contactPhone: body.contactPhone ?? null,
        notes: body.notes ?? null,
        createdBy: user.userId,
        sourceType: 'manual',
      },
    });
    return reply.code(201).send({ witness });
  });

  // Leads
  app.post('/api/cases/:caseId/investigator/leads', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || !requireInvestigatorRole(user)) return reply.code(403).send({ error: 'Forbidden' });

    const { caseId } = request.params as { caseId: string };
    const body = request.body as { title?: string; description?: string; priority?: string; assignedTo?: string };
    if (!body.title?.trim()) return reply.code(400).send({ error: 'title is required' });
    if (!(await ensureCaseAccess(caseId, user.tenantId))) return reply.code(403).send({ error: 'Forbidden' });

    const lead = await prisma.investigationLead.create({
      data: {
        caseId,
        tenantId: user.tenantId,
        title: body.title.trim(),
        description: body.description ?? null,
        priority: body.priority ?? 'medium',
        assignedTo: body.assignedTo ?? user.userId,
        createdBy: user.userId,
      },
    });
    return reply.code(201).send({ lead });
  });

  // Field notes
  app.post('/api/cases/:caseId/investigator/field-notes', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || !requireInvestigatorRole(user)) return reply.code(403).send({ error: 'Forbidden' });

    const { caseId } = request.params as { caseId: string };
    const body = request.body as {
      content?: string;
      title?: string;
      noteType?: string;
      latitude?: number;
      longitude?: number;
      evidenceId?: string;
      witnessId?: string;
    };
    if (!body.content?.trim()) return reply.code(400).send({ error: 'content is required' });
    if (!(await ensureCaseAccess(caseId, user.tenantId))) return reply.code(403).send({ error: 'Forbidden' });

    const note = await prisma.fieldNote.create({
      data: {
        caseId,
        tenantId: user.tenantId,
        userId: user.userId,
        content: body.content.trim(),
        title: body.title ?? null,
        noteType: body.noteType ?? 'general',
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        evidenceId: body.evidenceId ?? null,
        witnessId: body.witnessId ?? null,
      },
    });
    void logSecurityEvent('FIELD_NOTE_CREATED', user.userId, request.ip, `caseId=${caseId}`);
    return reply.code(201).send({ note });
  });

  // Assignments
  app.post('/api/cases/:caseId/investigator/assignments', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || !requireInvestigatorRole(user)) return reply.code(403).send({ error: 'Forbidden' });

    const { caseId } = request.params as { caseId: string };
    const body = request.body as { investigatorId?: string; role?: string };
    if (!body.investigatorId) return reply.code(400).send({ error: 'investigatorId is required' });
    if (!(await ensureCaseAccess(caseId, user.tenantId))) return reply.code(403).send({ error: 'Forbidden' });

    const assignment = await prisma.investigationAssignment.upsert({
      where: {
        caseId_tenantId_investigatorId: {
          caseId,
          tenantId: user.tenantId,
          investigatorId: body.investigatorId,
        },
      },
      create: {
        caseId,
        tenantId: user.tenantId,
        investigatorId: body.investigatorId,
        role: body.role ?? 'lead',
        assignedBy: user.userId,
      },
      update: { role: body.role ?? 'lead', status: 'active' },
    });
    return reply.code(201).send({ assignment });
  });

  app.get('/api/investigator/health', async (_request, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      engine: 'investigator-workbench',
      version: INVESTIGATOR_WORKBENCH_VERSION,
    });
  });

  console.log('[Investigator] Workbench routes registered');
}
