import type { FastifyInstance, FastifyReply } from 'fastify';
import { analyzeCase } from '../services/calcrimEngine.js';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { guardAuth, guardCaseAccess } from '../membership/resourceAuthMiddleware.js';

export async function registerCalcrimRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/calcrim/analyze/:caseId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!(await guardAuth(user, reply))) return;

    const { caseId } = request.params as { caseId: string };
    if (!(await guardCaseAccess(user!, caseId, 'view', reply))) return;

    try {
      const result = await analyzeCase(caseId);
      return result;
    } catch (err: unknown) {
      reply.code(500).send({
        error: err instanceof Error ? err.message : 'CALCRIM analysis failed',
      });
    }
  });
}
