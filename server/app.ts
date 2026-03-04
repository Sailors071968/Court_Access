// ============================================
// Court Access — Fastify Application
// ============================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { registerRateLimit } from './middleware/rateLimitMiddleware.js';
import { authRoutes } from './routes/authRoutes.js';
import { userRoutes } from './routes/userRoutes.js';
import { caseRoutes } from './routes/caseRoutes.js';
import { documentRoutes } from './routes/documentRoutes.js';
import { analysisRoutes } from './routes/analysisRoutes.js';
import { notificationRoutes } from './routes/notificationRoutes.js';
import { subscriptionRoutes } from './routes/subscriptionRoutes.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { logger } from './utils/loggingUtils.js';

export async function buildApp() {
  const app = Fastify({
    logger: false, // We use Winston
  });

  // --- Security ---
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  });

  // --- Rate Limiting ---
  await registerRateLimit(app);

  // --- Multipart (file upload) ---
  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
    },
  });

  // --- Error Handler ---
  app.setErrorHandler(errorHandler);

  // --- Health Check ---
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // --- API Routes ---
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(caseRoutes);
  await app.register(documentRoutes);
  await app.register(analysisRoutes);
  await app.register(notificationRoutes);
  await app.register(subscriptionRoutes);
  await app.register(adminRoutes);

  logger.info('Court Access API routes registered');

  return app;
}
