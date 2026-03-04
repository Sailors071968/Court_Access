// ============================================
// Court Access — Admin Routes
// ============================================

import type { FastifyInstance } from 'fastify';
import { handleListUsers, handleListTenants, handleGetAuditLogs } from '../controllers/adminController.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', tenantMiddleware);
  app.addHook('preHandler', requireRole('admin'));

  app.get('/admin/users', handleListUsers);
  app.get('/admin/tenants', handleListTenants);
  app.get('/admin/audit-logs', handleGetAuditLogs);
}
