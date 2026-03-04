// ============================================
// Court Access — Billing Routes (Stripe)
// ============================================

import { Router } from 'express';
import express from 'express';
import { handleCreateCheckoutSession, handleGetSubscription, handleStripeWebhookEndpoint } from '../controllers/billingController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';

const router = Router();

// Stripe webhook needs raw body — mount before JSON parsing
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhookEndpoint);

// Authenticated billing endpoints
router.post('/checkout', authMiddleware, tenantMiddleware, handleCreateCheckoutSession);
router.get('/subscription', authMiddleware, tenantMiddleware, handleGetSubscription);

export default router;
