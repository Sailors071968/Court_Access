// ============================================================================
// Production Gates API — GET /api/admin/production-gates
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { runProductionGates } from './runProductionGates.js';

export async function registerProductionGatesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/production-gates', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: 'Authentication required' });
    if (user.role !== 'admin' && user.role !== 'staff') {
      return reply.code(403).send({ error: 'Admin or staff access required' });
    }

    try {
      const report = await runProductionGates();
      return reply.send(report);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: 'Failed to run production gates', message });
    }
  });
}
