// ============================================
// Court Access — Stripe Billing Service
// ============================================

import Stripe from 'stripe';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../config/logger.js';

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new AppError('Stripe is not configured', 500);
    }
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
    });
  }
  return stripeClient;
}

const STRIPE_PRICES: Record<string, string> = {
  basic: env.STRIPE_PRICE_BASIC,
  pro: env.STRIPE_PRICE_PRO,
  enterprise: env.STRIPE_PRICE_ENTERPRISE,
};

export async function createCheckoutSession(
  tenantId: string,
  email: string,
  plan: string,
  successUrl: string,
  cancelUrl: string
) {
  const stripe = getStripeClient();
  const priceId = STRIPE_PRICES[plan];
  if (!priceId) {
    throw new AppError('Invalid subscription plan', 400);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tenantId },
  });

  logger.info('Checkout session created', { sessionId: session.id, tenantId, plan });
  return { sessionId: session.id, url: session.url };
}

export async function getSubscription(tenantId: string) {
  // In production, look up subscription via database
  // For now, return placeholder
  logger.info('Subscription status requested', { tenantId });
  return { plan: 'none', status: 'inactive', tenantId };
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string) {
  const stripe = getStripeClient();
  const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case 'invoice.payment_succeeded':
      logger.info('Payment succeeded', { invoiceId: (event.data.object as { id: string }).id });
      break;
    case 'invoice.payment_failed':
      logger.warn('Payment failed', { invoiceId: (event.data.object as { id: string }).id });
      break;
    case 'customer.subscription.deleted':
      logger.info('Subscription deleted', { subscriptionId: (event.data.object as { id: string }).id });
      break;
    default:
      logger.debug('Unhandled Stripe event', { type: event.type });
  }

  return { received: true };
}
