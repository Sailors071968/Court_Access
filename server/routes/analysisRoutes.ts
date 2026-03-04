// ============================================
// Court Access — Analysis Routes
// ============================================

import type { FastifyInstance } from 'fastify';
import { handleRunAnalysis, handleGetAnalysisResult } from '../controllers/analysisController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';

export async function analysisRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', tenantMiddleware);

  app.post('/analysis/run', handleRunAnalysis);
  app.get('/analysis/result/:id', handleGetAnalysisResult);
}
