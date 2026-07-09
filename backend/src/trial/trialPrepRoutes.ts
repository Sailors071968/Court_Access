// ============================================================================
// Program 90 — Canonical Trial Preparation API
//
// Method:        GET
// Route:         /api/cases/:caseId/trial-prep
// Authentication: Bearer JWT (global authenticationHook)
// Authorization:  guardCaseAccess(user, caseId, 'view')
// Controller:     this file
// Service:        buildTrialPrep (trialPrepService.ts)
// Repository:     buildAttorneyWorkbench + buildAttorneyReport + KG + Prisma
// DB tables:      criminal_cases, Charge, evidence, case_witnesses,
//                 discovery_items, timeline_events
// Output schema:  { trialPrep: TrialPrepReport }
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import { guardAuth, guardCaseAccess } from '../membership/resourceAuthMiddleware.js';
import { buildTrialPrep } from './trialPrepService.js';

export async function registerTrialPrepRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/cases/:caseId/trial-prep', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const trialPrep = await buildTrialPrep(caseId, user!.tenantId, user!.userId);
    if (!trialPrep) return reply.code(404).send({ error: 'Case not found' });

    void logSecurityEvent('TRIAL_PREP_GENERATED', user!.userId, request.ip, `${caseId} ${trialPrep.reproducibilityHash.slice(0, 12)}`);
    return reply.send({ trialPrep });
  });
}
