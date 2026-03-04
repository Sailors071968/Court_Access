// ============================================
// Court Access — Billing Controller (Stripe)
// ============================================

import type { Request, Response, NextFunction } from 'express';
import { createCheckoutSession, getSubscription, handleStripeWebhook } from '../services/stripeService.js';

export async function handleCreateCheckoutSession(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { plan, successUrl, cancelUrl } = req.body;
    if (!plan) { res.status(400).json({ error: 'plan is required' }); return; }
    const result = await createCheckoutSession(
      req.user.tenantId,
      '', // email from user profile
      plan,
      successUrl || 'https://courtaccess.net/billing/success',
      cancelUrl || 'https://courtaccess.net/billing/cancel'
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const result = await getSubscription(req.user.tenantId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleStripeWebhookEndpoint(req: Request, res: Response, next: NextFunction) {
  try {
    const sig = req.headers['stripe-signature'] as string;
    if (!sig) { res.status(400).json({ error: 'Missing stripe-signature header' }); return; }
    const result = await handleStripeWebhook(req.body as Buffer, sig);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
