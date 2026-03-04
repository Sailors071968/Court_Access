// ============================================
// Court Access — Rate Limit Configuration
// ============================================

import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

/**
 * Register global rate limiting.
 * Per-IP default limits. Specific routes can override.
 */
export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Use authenticated user's tenantId if available, else IP
      if (request.user?.tenantId) {
        return request.user.tenantId;
      }
      return request.ip;
    },
  });
}
