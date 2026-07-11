// ============================================================================
// Program 91 — Canonical CALCRIM Intelligence Center API
//
// Method:        GET
// Route:         /api/cases/:caseId/calcrim-center
// Authentication: Bearer JWT (global authenticationHook)
// Authorization:  guardCaseAccess(user, caseId, 'view')
// Controller:     this file
// Service:        buildCalcrimCenter (calcrimCenterService.ts)
// Repository:     buildAttorneyWorkbench + buildAttorneyReport + KG + Prisma
// DB tables:      criminal_cases, Charge, evidence, case_witnesses,
//                 discovery_items, timeline_events (+ CALCRIM repository jsonl)
// Output schema:  { calcrim: CalcrimCenter }
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import { guardAuth, guardCaseAccess } from '../membership/resourceAuthMiddleware.js';
import { buildCalcrimCenter } from './calcrimCenterService.js';

export async function registerCalcrimCenterRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/cases/:caseId/calcrim-center', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const calcrim = await buildCalcrimCenter(caseId, user!.tenantId, user!.userId);
    if (!calcrim) return reply.code(404).send({ error: 'Case not found' });

    void logSecurityEvent('CALCRIM_CENTER_GENERATED', user!.userId, request.ip, `${caseId} ${calcrim.reproducibilityHash.slice(0, 12)}`);
    return reply.send({ calcrim });
  });
}
