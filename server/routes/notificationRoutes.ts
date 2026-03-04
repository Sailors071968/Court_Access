// ============================================
// Court Access — Notification Routes
// ============================================

import type { FastifyInstance } from 'fastify';
import { handleSendSms, handleSendEmail, handleListNotifications } from '../controllers/notificationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', tenantMiddleware);

  app.post('/notifications/sms', handleSendSms);
  app.post('/notifications/email', handleSendEmail);
  app.get('/notifications/list', handleListNotifications);
}
