// ============================================================================
// Program 92 — Canonical Voir Dire Intelligence Center API
//
// Method:        GET
// Route:         /api/cases/:caseId/voir-dire
// Authentication: Bearer JWT (global authenticationHook)
// Authorization:  guardCaseAccess(user, caseId, 'view')
// Controller:     this file
// Service:        buildVoirDireCenter (voirDireService.ts)
// Repository:     buildAttorneyWorkbench + buildAttorneyReport + KG + Prisma
// DB tables:      criminal_cases, Charge, evidence, case_witnesses,
//                 discovery_items, timeline_events (+ CALCRIM repository)
// Output schema:  { voirDire: VoirDireCenter }
// Note: juror-specific evaluations and challenge selections are attorney-
// entered on the client and are intentionally NOT inferred server-side.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import { guardAuth, guardCaseAccess } from '../membership/resourceAuthMiddleware.js';
import { buildVoirDireCenter } from './voirDireService.js';

export async function registerVoirDireRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/cases/:caseId/voir-dire', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const voirDire = await buildVoirDireCenter(caseId, user!.tenantId, user!.userId);
    if (!voirDire) return reply.code(404).send({ error: 'Case not found' });

    void logSecurityEvent('VOIR_DIRE_GENERATED', user!.userId, request.ip, `${caseId} ${voirDire.reproducibilityHash.slice(0, 12)}`);
    return reply.send({ voirDire });
  });
}
