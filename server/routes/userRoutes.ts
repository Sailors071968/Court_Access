// ============================================
// Court Access — User Routes
// ============================================

import type { FastifyInstance } from 'fastify';
import { handleGetProfile, handleUpdateProfile } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', tenantMiddleware);

  app.get('/users/profile', handleGetProfile);
  app.put('/users/update', handleUpdateProfile);
}
