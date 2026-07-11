// ============================================================================
// Program 93 — Canonical Sentencing / Enhancement / Exposure API
//
// Method:        GET
// Route:         /api/cases/:caseId/sentencing
// Authentication: Bearer JWT (global authenticationHook)
// Authorization:  guardCaseAccess(user, caseId, 'view')
// Controller:     this file
// Service:        buildSentencingCenter (sentencingService.ts)
// Repository:     buildAttorneyWorkbench + buildAttorneyReport + statute
//                 intelligence (classification, penalty) + KG
// DB tables:      criminal_cases, Charge, evidence, case_witnesses,
//                 discovery_items, timeline_events (+ legislative repository)
// Output schema:  { sentencing: SentencingCenter }
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import { guardAuth, guardCaseAccess } from '../membership/resourceAuthMiddleware.js';
import { buildSentencingCenter } from './sentencingService.js';

export async function registerSentencingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/cases/:caseId/sentencing', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const sentencing = await buildSentencingCenter(caseId, user!.tenantId, user!.userId);
    if (!sentencing) return reply.code(404).send({ error: 'Case not found' });

    void logSecurityEvent('SENTENCING_CENTER_GENERATED', user!.userId, request.ip, `${caseId} ${sentencing.reproducibilityHash.slice(0, 12)}`);
    return reply.send({ sentencing });
  });
}
