// ============================================================================
// Program 88 — Canonical Attorney Report API
//
// Method:        GET
// Route:         /api/cases/:caseId/attorney-report
// Authentication: Bearer JWT (global authenticationHook)
// Authorization:  guardCaseAccess(user, caseId, 'view')
// Controller:     this file
// Service:        buildAttorneyReport (attorneyReportService.ts)
// Repository:     buildAttorneyWorkbench + buildCaseKnowledgeGraph + Prisma
// DB tables:      criminal_cases, charges, evidence, case_witnesses,
//                 discovery_items, timeline_events (+ intelligence sources)
// Output schema:  AttorneyReport (attorneyReportService.ts)
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import { guardAuth, guardCaseAccess } from '../membership/resourceAuthMiddleware.js';
import { buildAttorneyReport } from './attorneyReportService.js';

export async function registerAttorneyReportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/cases/:caseId/attorney-report', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const report = await buildAttorneyReport(caseId, user!.tenantId, user!.userId);
    if (!report) return reply.code(404).send({ error: 'Case not found' });

    void logSecurityEvent('ATTORNEY_REPORT_GENERATED', user!.userId, request.ip, `${caseId} ${report.reproducibilityHash.slice(0, 12)}`);
    return reply.send({ report });
  });
}
