// ============================================
// Court Access — Document Routes
// ============================================

import type { FastifyInstance } from 'fastify';
import { handleUploadDocument, handleListDocuments, handleGetDocument, handleGetDocumentDownloadUrl } from '../controllers/documentController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';

export async function documentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', tenantMiddleware);

  app.post('/documents/upload/:caseId', handleUploadDocument);
  app.get('/documents/list/:caseId', handleListDocuments);
  app.get('/documents/:id', handleGetDocument);
  app.get('/documents/:id/download', handleGetDocumentDownloadUrl);
}
