// ============================================================================
// Master Program 8 — Case Knowledge Graph API
//   GET /api/cases/:caseId/knowledge-graph
// Returns the unified typed graph + citation/evidence/timeline/authority
// sub-graphs, assembled from real case records. Auth + case-access guarded.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { guardAuth, guardCaseAccess } from '../membership/resourceAuthMiddleware.js';
import { buildCaseKnowledgeGraph } from './caseKnowledgeGraph.js';

export async function registerKnowledgeGraphRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/cases/:caseId/knowledge-graph', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;
    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    const graph = await buildCaseKnowledgeGraph(caseId, user!.tenantId, user!.userId);
    if (!graph) return reply.code(404).send({ error: 'Case not found' });
    return reply.send(graph);
  });
}
