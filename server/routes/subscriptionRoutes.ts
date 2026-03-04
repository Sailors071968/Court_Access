// ============================================
// Court Access — Subscription Routes
// ============================================

import type { FastifyInstance } from 'fastify';
import { handleCreateSubscription, handleCancelSubscription, handleGetSubscriptionStatus, handleStripeWebhookEndpoint } from '../controllers/subscriptionController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';

export async function subscriptionRoutes(app: FastifyInstance) {
  // Stripe webhook — no auth (verified via stripe signature)
  app.post('/stripe/webhook', handleStripeWebhookEndpoint);

  // Authenticated subscription management
  app.post('/subscriptions/create', { preHandler: [authMiddleware, tenantMiddleware] }, handleCreateSubscription);
  app.post('/subscriptions/cancel', { preHandler: [authMiddleware, tenantMiddleware] }, handleCancelSubscription);
  app.get('/subscriptions/status', { preHandler: [authMiddleware, tenantMiddleware] }, handleGetSubscriptionStatus);
}
