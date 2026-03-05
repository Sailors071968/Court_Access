// ============================================
// Court Access — Stripe Webhook Handlers
// Phase 32: Real Stripe Webhooks
//
// Handles:
// - checkout.session.completed
// - invoice.payment_succeeded
// - invoice.payment_failed
// - customer.subscription.deleted
// - customer.subscription.updated
// ============================================

import express from 'express';
import Stripe from 'stripe';
import { config } from '../config/index.js';
import { captureException, captureMessage } from '../services/errorMonitoring.js';
import { notifyNewSubscription, notifyPaymentReceived, notifyPaymentFailed, notifySubscriptionCancelled } from '../services/smsNotification.js';

let stripe = null;

function getStripe() {
  if (stripe) return stripe;
  if (!config.stripeSecretKey) throw new Error('STRIPE_SECRET_KEY not configured');
  stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
  return stripe;
}

// In-memory subscription store (replace with database in production)
const subscriptions = new Map();

/**
 * Register Stripe webhook routes on an Express app.
 *
 * IMPORTANT: The webhook endpoint must use express.raw() for body parsing,
 * NOT express.json(). This is required for Stripe signature verification.
 */
export function registerWebhookRoutes(app) {
  // Webhook endpoint — uses express.raw() for Stripe signature verification
  // express.raw() parses the body as a Buffer, which Stripe needs for signature check
  app.post(
    '/api/stripe/webhooks',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const sig = req.headers['stripe-signature'];

      if (!sig) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }

      let event;

      try {
        const stripeClient = getStripe();

        if (config.stripeWebhookSecret) {
          // Verify webhook signature — req.body is a raw Buffer from express.raw()
          event = stripeClient.webhooks.constructEvent(
            req.body,
            sig,
            config.stripeWebhookSecret
          );
        } else {
          // Development mode — parse without verification
          console.warn('[Stripe Webhook] No webhook secret configured — skipping signature verification');
          const bodyStr = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
          event = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;
        }
      } catch (err) {
        console.error(`[Stripe Webhook] Signature verification failed: ${err.message}`);
        return res.status(400).json({ error: 'Webhook signature verification failed' });
      }

      // Process the event
      try {
        await handleWebhookEvent(event);
        res.json({ received: true });
      } catch (err) {
        console.error(`[Stripe Webhook] Event processing failed: ${err.message}`);
        captureException(err, { eventType: event.type, eventId: event.id });
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  );

  // Admin endpoint to check subscription status
  app.get('/api/stripe/subscription/:customerId', async (req, res) => {
    const { customerId } = req.params;

    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const subscription = subscriptions.get(customerId);
    if (!subscription) {
      return res.json({ status: 'none', plan: 'free' });
    }

    res.json(subscription);
  });

  console.log('[Stripe Webhook] Routes registered');
}

/**
 * Route webhook events to their handlers.
 */
async function handleWebhookEvent(event) {
  console.log(`[Stripe Webhook] Received: ${event.type} (${event.id})`);

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;

    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }
}

/**
 * Handle checkout.session.completed
 * Fired when a customer completes the Stripe Checkout flow.
 */
async function handleCheckoutCompleted(session) {
  const customerId = session.customer;
  const subscriptionId = session.subscription;
  const plan = session.metadata?.plan || 'professional';
  const email = session.customer_details?.email || session.customer_email;

  const customerName = session.customer_details?.name || '';

  console.log(`[Stripe Webhook] Checkout completed: customer=${customerId}, plan=${plan}, email=${email}`);

  // Store subscription data
  subscriptions.set(customerId, {
    customerId,
    subscriptionId,
    plan,
    email,
    status: 'active',
    startedAt: new Date().toISOString(),
    lastPaymentAt: new Date().toISOString(),
  });

  captureMessage('New subscription created', 'info', { customerId, plan, email });

  // SMS alert to admin
  const amount = session.amount_total ? (session.amount_total / 100).toFixed(2) : '0.00';
  await notifyNewSubscription({
    customerName,
    customerEmail: email,
    planName: plan,
    amount,
  });

  // In production: Update user record in database
  // await db.users.update({ stripeCustomerId: customerId }, { plan, subscriptionStatus: 'active' });
}

/**
 * Handle invoice.payment_succeeded
 * Fired when a subscription renewal payment succeeds.
 */
async function handlePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  const amountPaid = invoice.amount_paid;
  const currency = invoice.currency;

  console.log(`[Stripe Webhook] Payment succeeded: customer=${customerId}, amount=${amountPaid} ${currency}`);

  const existing = subscriptions.get(customerId);
  if (existing) {
    existing.status = 'active';
    existing.lastPaymentAt = new Date().toISOString();
    existing.lastAmountPaid = amountPaid;
    subscriptions.set(customerId, existing);
  }

  // SMS alert to admin
  await notifyPaymentReceived({
    customerEmail: existing?.email || invoice.customer_email || '',
    amount: (amountPaid / 100).toFixed(2),
    currency,
  });

  // In production: Update payment record, send receipt email
}

/**
 * Handle invoice.payment_failed
 * Fired when a subscription renewal payment fails.
 */
async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;
  const attemptCount = invoice.attempt_count;

  console.log(`[Stripe Webhook] Payment failed: customer=${customerId}, attempt=${attemptCount}`);

  const existing = subscriptions.get(customerId);
  if (existing) {
    existing.status = 'past_due';
    existing.lastFailedAt = new Date().toISOString();
    existing.failedAttempts = attemptCount;
    subscriptions.set(customerId, existing);
  }

  captureMessage('Subscription payment failed', 'warning', { customerId, attemptCount });

  // SMS alert to admin
  await notifyPaymentFailed({
    customerEmail: existing?.email || '',
    attemptCount,
  });

  // In production:
  // - Update user subscription status to 'past_due'
  // - Send dunning email to customer
  // - If attemptCount >= 3, consider downgrading to free tier
}

/**
 * Handle customer.subscription.deleted
 * Fired when a subscription is cancelled (end of billing period).
 */
async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;

  console.log(`[Stripe Webhook] Subscription deleted: customer=${customerId}`);

  const existing = subscriptions.get(customerId);
  if (existing) {
    existing.status = 'cancelled';
    existing.cancelledAt = new Date().toISOString();
    existing.plan = 'free'; // Downgrade to free
    subscriptions.set(customerId, existing);
  }

  captureMessage('Subscription cancelled', 'info', { customerId });

  // SMS alert to admin
  await notifySubscriptionCancelled({
    customerEmail: existing?.email || '',
  });

  // In production:
  // - Downgrade user to free plan
  // - Restrict access based on free tier limits
  // - Send cancellation confirmation email
}

/**
 * Handle customer.subscription.updated
 * Fired when subscription is changed (upgrade, downgrade, etc.)
 */
async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  const status = subscription.status;

  console.log(`[Stripe Webhook] Subscription updated: customer=${customerId}, status=${status}`);

  const existing = subscriptions.get(customerId);
  if (existing) {
    existing.status = status;
    existing.updatedAt = new Date().toISOString();
    subscriptions.set(customerId, existing);
  }

  // In production: Sync subscription changes to user record
}

/**
 * Get all subscriptions (admin use).
 */
export function getAllSubscriptions() {
  return Array.from(subscriptions.values());
}
