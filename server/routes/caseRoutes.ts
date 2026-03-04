// ============================================
// Court Access — Case Routes
// ============================================

import type { FastifyInstance } from 'fastify';
import { handleCreateCase, handleListCases, handleGetCase, handleUpdateCase } from '../controllers/caseController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';

export async function caseRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', tenantMiddleware);

  app.post('/cases/create', handleCreateCase);
  app.get('/cases/list', handleListCases);
  app.get('/cases/:id', handleGetCase);
  app.put('/cases/:id', handleUpdateCase);
}
