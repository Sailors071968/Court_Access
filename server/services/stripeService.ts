// ============================================
// Court Access — Stripe Service
// ============================================

import { eq, and } from 'drizzle-orm';
import { db } from '../config/database.js';
import { subscriptions, tenants } from '../models/schema.js';
import { getStripeClient, STRIPE_PRICES } from '../config/stripe.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/loggingUtils.js';

/**
 * Create a Stripe subscription for a tenant.
 */
export async function createSubscription(
  tenantId: string,
  email: string,
  plan: 'basic' | 'pro' | 'enterprise'
) {
  const stripe = getStripeClient();
  const priceId = STRIPE_PRICES[plan];
  if (!priceId) {
    throw new AppError('Invalid subscription plan', 400);
  }

  // Create or retrieve Stripe customer
  const customers = await stripe.customers.list({ email, limit: 1 });
  let customerId: string;
  if (customers.data.length > 0) {
    customerId = customers.data[0].id;
  } else {
    const customer = await stripe.customers.create({
      email,
      metadata: { tenantId },
    });
    customerId = customer.id;
  }

  // Create subscription
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata: { tenantId },
  });

  // Store in database
  const [sub] = await db
    .insert(subscriptions)
    .values({
      tenantId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      plan,
      status: subscription.status,
    })
    .returning();

  // Update tenant tier
  await db
    .update(tenants)
    .set({ subscriptionTier: plan })
    .where(eq(tenants.id, tenantId));

  logger.info('Subscription created', {
    subscriptionId: sub.id,
    tenantId,
    plan,
  });

  return sub;
}

/**
 * Cancel a subscription.
 */
export async function cancelSubscription(tenantId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, 'active')))
    .limit(1);

  if (!sub || !sub.stripeSubscriptionId) {
    throw new AppError('No active subscription found', 404);
  }

  const stripe = getStripeClient();
  await stripe.subscriptions.cancel(sub.stripeSubscriptionId);

  await db
    .update(subscriptions)
    .set({ status: 'canceled', updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id));

  logger.info('Subscription canceled', { tenantId });

  return { status: 'canceled' };
}

/**
 * Get subscription status for a tenant.
 */
export async function getSubscriptionStatus(tenantId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  if (!sub) {
    return { plan: 'none', status: 'inactive' };
  }

  return {
    id: sub.id,
    plan: sub.plan,
    status: sub.status,
    stripeSubscriptionId: sub.stripeSubscriptionId,
    createdAt: sub.createdAt,
  };
}

/**
 * Handle Stripe webhook events.
 */
export async function handleStripeWebhook(event: {
  type: string;
  data: { object: Record<string, unknown> };
}) {
  switch (event.type) {
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      logger.info('Payment succeeded', { invoiceId: invoice.id });
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      logger.warn('Payment failed', { invoiceId: invoice.id });
      const subId = invoice.subscription as string;
      if (subId) {
        await db
          .update(subscriptions)
          .set({ status: 'past_due', updatedAt: new Date() })
          .where(eq(subscriptions.stripeSubscriptionId, subId));
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const subId = subscription.id as string;
      if (subId) {
        await db
          .update(subscriptions)
          .set({ status: 'canceled', updatedAt: new Date() })
          .where(eq(subscriptions.stripeSubscriptionId, subId));
      }
      logger.info('Subscription deleted via webhook', { subscriptionId: subId });
      break;
    }
    default:
      logger.debug('Unhandled webhook event', { type: event.type });
  }
}
