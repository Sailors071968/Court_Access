// ============================================
// Court Access — Auth Routes
// ============================================

import type { FastifyInstance } from 'fastify';
import { handleRegister, handleLogin, handleLogout, handleMe } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', handleRegister);
  app.post('/auth/login', handleLogin);
  app.post('/auth/logout', { preHandler: [authMiddleware] }, handleLogout);
  app.get('/auth/me', { preHandler: [authMiddleware] }, handleMe);
}
