// ============================================================================
// Program 89 — Canonical Motion Builder API
//
// Method:        GET
// Routes:        /api/cases/:caseId/motion-types
//                /api/cases/:caseId/motion-builder/:motionType
// Authentication: Bearer JWT (global authenticationHook)
// Authorization:  guardCaseAccess(user, caseId, 'view')
// Controller:     this file
// Service:        buildMotionTypeCatalog, buildMotionDraft (motionBuilderService.ts)
// Repository:     buildAttorneyReport → buildAttorneyWorkbench + KG + Prisma
// DB tables:      criminal_cases, Charge, evidence, case_witnesses,
//                 discovery_items, timeline_events
// Output schema:  { motionTypes: MotionTypeMeta[] } | { draft: MotionDraft }
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import { guardAuth, guardCaseAccess } from '../membership/resourceAuthMiddleware.js';
import { buildMotionTypeCatalog, buildMotionDraft, type MotionTypeId } from './motionBuilderService.js';

const VALID_TYPES = new Set<MotionTypeId>([
  'suppress', 'dismiss', 'in_limine', 'pitchess', 'brady', 'discovery',
  'continuance', 'severance', 'protective_order', 'expert', 'preservation',
  'research_memo', 'custom',
]);

export async function registerMotionBuilderRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/cases/:caseId/motion-types', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const catalog = await buildMotionTypeCatalog(caseId, user!.tenantId, user!.userId);
    if (!catalog) return reply.code(404).send({ error: 'Case not found' });
    return reply.send(catalog);
  });

  app.get('/api/cases/:caseId/motion-builder/:motionType', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { caseId, motionType } = request.params as { caseId: string; motionType: string };
    if (!VALID_TYPES.has(motionType as MotionTypeId)) return reply.code(400).send({ error: 'Unknown motion type' });
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const draft = await buildMotionDraft(caseId, user!.tenantId, user!.userId, motionType as MotionTypeId);
    if (!draft) return reply.code(404).send({ error: 'Case not found' });

    void logSecurityEvent('MOTION_DRAFT_GENERATED', user!.userId, request.ip, `${caseId} ${motionType} ${draft.reproducibilityHash.slice(0, 12)}`);
    return reply.send({ draft });
  });
}
