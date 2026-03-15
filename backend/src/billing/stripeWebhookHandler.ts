// ============================================================================
// CourtAccess — Stripe Webhook Handler
// Receives Stripe webhook events, verifies HMAC-SHA256 signature,
// and persists subscription state changes to PostgreSQL via Prisma.
// ============================================================================

import crypto from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import { addPurchasedCredits } from './aiCreditService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StripeSubscriptionObject {
  id: string;
  customer: string;
  status: string;
  items?: {
    data?: Array<{
      price?: {
        lookup_key?: string;
        product?: string;
        metadata?: Record<string, string>;
      };
    }>;
  };
  current_period_start?: number;
  current_period_end?: number;
  metadata?: Record<string, string>;
}

interface StripeCheckoutSession {
  id: string;
  customer: string;
  subscription: string;
  client_reference_id?: string;
  metadata?: Record<string, string>;
}

interface StripeInvoice {
  id: string;
  customer: string;
  subscription?: string;
  status: string;
  amount_paid: number;
}

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: StripeSubscriptionObject | StripeCheckoutSession | StripeInvoice;
  };
}

// ---------------------------------------------------------------------------
// Signature Verification (HMAC-SHA256)
// ---------------------------------------------------------------------------

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

function verifyStripeSignature(payload: string | Buffer, signature: string): boolean {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.warn('[StripeWebhook] STRIPE_WEBHOOK_SECRET not set — skipping verification in dev mode');
    return process.env.NODE_ENV !== 'production';
  }

  const elements = signature.split(',');
  const timestampStr = elements.find(e => e.startsWith('t='))?.slice(2);
  // Collect ALL v1= signatures — Stripe sends multiple during secret rotation
  const signaturesV1 = elements.filter(e => e.startsWith('v1=')).map(e => e.slice(3));

  if (!timestampStr || signaturesV1.length === 0) {
    return false;
  }

  // Reject events older than 5 minutes to prevent replay attacks
  const timestamp = parseInt(timestampStr, 10);
  const tolerance = 300; // 5 minutes, same as Stripe's default
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > tolerance) {
    return false;
  }

  const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf8');
  const signedPayload = `${timestampStr}.${payloadStr}`;
  const expectedSignature = crypto
    .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('hex');

  // Check each v1= signature — accept if ANY matches (supports secret rotation)
  for (const sig of signaturesV1) {
    try {
      if (crypto.timingSafeEqual(
        Buffer.from(sig, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      )) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Tier Mapping
// ---------------------------------------------------------------------------

function mapStripePriceToTier(priceKey?: string): { planId: string; tier: string } {
  const mapping: Record<string, { planId: string; tier: string }> = {
    'starter_monthly': { planId: 'STARTER', tier: 'starter' },
    'professional_monthly': { planId: 'PROFESSIONAL', tier: 'professional' },
    'advanced_monthly': { planId: 'ADVANCED_INVESTIGATOR', tier: 'advanced' },
    'litigation_monthly': { planId: 'LITIGATION_INTELLIGENCE_PRO', tier: 'litigation' },
    'enterprise_monthly': { planId: 'ENTERPRISE_FIRM', tier: 'enterprise' },
  };
  return mapping[priceKey ?? ''] ?? { planId: 'FREE', tier: 'free' };
}

/**
 * Maps an internal plan ID (e.g. 'STARTER', 'PROFESSIONAL') to its tier string.
 * Used by handleCheckoutCompleted where session.metadata.planId contains the
 * internal plan ID — NOT a Stripe price lookup key.
 */
function mapPlanIdToTier(planId?: string): { planId: string; tier: string } {
  const mapping: Record<string, { planId: string; tier: string }> = {
    'FREE': { planId: 'FREE', tier: 'free' },
    'STARTER': { planId: 'STARTER', tier: 'starter' },
    'PROFESSIONAL': { planId: 'PROFESSIONAL', tier: 'professional' },
    'ADVANCED_INVESTIGATOR': { planId: 'ADVANCED_INVESTIGATOR', tier: 'advanced' },
    'LITIGATION_INTELLIGENCE_PRO': { planId: 'LITIGATION_INTELLIGENCE_PRO', tier: 'litigation' },
    'ENTERPRISE_FIRM': { planId: 'ENTERPRISE_FIRM', tier: 'enterprise' },
  };
  return mapping[planId ?? ''] ?? { planId: planId ?? 'FREE', tier: 'free' };
}

// ---------------------------------------------------------------------------
// Event Handlers — all persist to PostgreSQL
// ---------------------------------------------------------------------------

async function handleSubscriptionCreated(sub: StripeSubscriptionObject): Promise<void> {
  const customerId = sub.customer;
  const subscriptionId = sub.id;
  const status = sub.status;
  const priceKey = sub.items?.data?.[0]?.price?.lookup_key;
  const mapped = mapStripePriceToTier(priceKey);
  const userId = sub.metadata?.userId;

  if (!userId) {
    console.warn(`[StripeWebhook] subscription.created missing userId in metadata for ${subscriptionId}`);
    return;
  }

  if (!priceKey) {
    console.warn(`[StripeWebhook] subscription.created missing price lookup_key for ${subscriptionId}`);
  }

  const periodStart = sub.current_period_start
    ? new Date(sub.current_period_start * 1000)
    : new Date();
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // For the update path: only overwrite plan/tier if lookup_key is present,
  // otherwise preserve existing plan to avoid silent downgrade to FREE.
  // For the create path: use mapped values (FREE is acceptable as a default for new records).
  const updateData: Record<string, unknown> = {
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    subscriptionStatus: status,
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
    activatedAt: new Date(),
  };
  if (priceKey) {
    updateData.planId = mapped.planId;
    updateData.subscriptionTier = mapped.tier;
  }

  await prisma.subscription.upsert({
    where: { userId },
    update: updateData,
    create: {
      userId,
      planId: mapped.planId,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      subscriptionStatus: status,
      subscriptionTier: mapped.tier,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      activatedAt: new Date(),
    },
  });

  void logSecurityEvent(
    'STRIPE_SUBSCRIPTION_CREATED',
    userId,
    undefined,
    `Subscription ${subscriptionId} created: ${mapped.tier} (${status})`,
  );

  console.log(`[StripeWebhook] Subscription created: user=${userId} plan=${mapped.planId} status=${status}`);
}

async function handleSubscriptionUpdated(sub: StripeSubscriptionObject): Promise<void> {
  const subscriptionId = sub.id;
  const status = sub.status;
  const priceKey = sub.items?.data?.[0]?.price?.lookup_key;
  const mapped = mapStripePriceToTier(priceKey);

  // Find subscription by Stripe subscription ID
  const existing = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!existing) {
    console.warn(`[StripeWebhook] subscription.updated: no local subscription found for ${subscriptionId}`);
    return;
  }

  // Only update plan/tier if lookup_key is present — otherwise preserve existing
  // to prevent silent downgrade to FREE on events without full item data
  const planId = priceKey ? mapped.planId : existing.planId;
  const tier = priceKey ? mapped.tier : (existing.subscriptionTier ?? 'free');

  if (!priceKey) {
    console.warn(`[StripeWebhook] subscription.updated missing price lookup_key for ${subscriptionId} — preserving existing plan ${existing.planId}`);
  }

  const periodStart = sub.current_period_start
    ? new Date(sub.current_period_start * 1000)
    : existing.billingPeriodStart;
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : existing.billingPeriodEnd;

  await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      planId,
      subscriptionStatus: status,
      subscriptionTier: tier,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
    },
  });

  void logSecurityEvent(
    'STRIPE_SUBSCRIPTION_UPDATED',
    existing.userId,
    undefined,
    `Subscription ${subscriptionId} updated: ${tier} (${status})`,
  );

  console.log(`[StripeWebhook] Subscription updated: user=${existing.userId} plan=${planId} status=${status}`);
}

async function handleSubscriptionDeleted(sub: StripeSubscriptionObject): Promise<void> {
  const subscriptionId = sub.id;

  const existing = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!existing) {
    console.warn(`[StripeWebhook] subscription.deleted: no local subscription found for ${subscriptionId}`);
    return;
  }

  await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      planId: 'FREE',
      subscriptionStatus: 'canceled',
      subscriptionTier: 'free',
      stripeSubscriptionId: null,
    },
  });

  void logSecurityEvent(
    'STRIPE_SUBSCRIPTION_CANCELED',
    existing.userId,
    undefined,
    `Subscription ${subscriptionId} canceled — downgraded to FREE`,
  );

  console.log(`[StripeWebhook] Subscription canceled: user=${existing.userId} — downgraded to FREE`);
}

async function handleCheckoutCompleted(session: StripeCheckoutSession): Promise<void> {
  const userId = session.client_reference_id ?? session.metadata?.userId;
  if (!userId) {
    console.warn(`[StripeWebhook] checkout.session.completed missing userId for session ${session.id}`);
    return;
  }

  // Handle ACU credit pack purchases (payment-mode sessions, no subscription).
  // These have metadata.type === 'acu_credits' and metadata.credits set by
  // stripeCheckoutRoutes.ts when creating the checkout session.
  if (session.metadata?.type === 'acu_credits') {
    const credits = parseInt(session.metadata.credits ?? '0', 10);
    if (credits > 0) {
      await addPurchasedCredits(userId, credits);
      void logSecurityEvent(
        'STRIPE_ACU_CREDITS_PURCHASED',
        userId,
        undefined,
        `ACU credits purchased: ${credits} credits via session ${session.id}`,
      );
      console.log(`[StripeWebhook] ACU credits added: user=${userId} credits=${credits} session=${session.id}`);
    } else {
      console.warn(`[StripeWebhook] acu_credits checkout with zero/invalid credits for session ${session.id}`);
    }
    return; // Do NOT run subscription upsert for credit purchases
  }

  // Read plan from session metadata (set when creating the checkout session).
  // Falls back to STARTER only if metadata is missing — callers MUST set planId
  // in session metadata when creating checkout sessions.
  const metaPlanId = session.metadata?.planId;
  const mapped = metaPlanId
    ? mapPlanIdToTier(metaPlanId)
    : { planId: 'STARTER', tier: 'starter' };

  if (!metaPlanId) {
    console.warn(`[StripeWebhook] checkout.session.completed missing planId in metadata for session ${session.id} — defaulting to STARTER`);
  }

  // Update subscription with Stripe IDs.
  // Only overwrite plan/tier in the update path when metaPlanId is present,
  // otherwise preserve existing plan to avoid silent downgrade (matches
  // the guard pattern in handleSubscriptionCreated).
  const updateData: Record<string, unknown> = {
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
    subscriptionStatus: 'active',
  };
  if (metaPlanId) {
    updateData.planId = mapped.planId;
    updateData.subscriptionTier = mapped.tier;
  }

  await prisma.subscription.upsert({
    where: { userId },
    update: updateData,
    create: {
      userId,
      planId: mapped.planId,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      subscriptionStatus: 'active',
      subscriptionTier: mapped.tier,
      billingPeriodStart: new Date(),
      billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  void logSecurityEvent(
    'STRIPE_CHECKOUT_COMPLETED',
    userId,
    undefined,
    `Checkout session ${session.id} completed: ${mapped.tier}`,
  );

  console.log(`[StripeWebhook] Checkout completed: user=${userId} plan=${mapped.planId} session=${session.id}`);
}

async function handleInvoicePaid(invoice: StripeInvoice): Promise<void> {
  if (!invoice.subscription) return;

  const existing = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: invoice.subscription },
  });

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: { subscriptionStatus: 'active' },
    });
    console.log(`[StripeWebhook] Invoice paid: subscription=${invoice.subscription} amount=${invoice.amount_paid}`);
  }
}

async function handleInvoicePaymentFailed(invoice: StripeInvoice): Promise<void> {
  if (!invoice.subscription) return;

  const existing = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: invoice.subscription },
  });

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: { subscriptionStatus: 'past_due' },
    });

    void logSecurityEvent(
      'STRIPE_PAYMENT_FAILED',
      existing.userId,
      undefined,
      `Invoice ${invoice.id} payment failed — subscription marked past_due`,
    );

    console.log(`[StripeWebhook] Payment failed: subscription=${invoice.subscription} — marked past_due`);
  }
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerStripeWebhookRoutes(app: FastifyInstance): Promise<void> {
  // Encapsulate webhook route in a plugin so the custom content-type parser
  // only applies to routes registered inside this scope.
  await app.register(async (webhookScope) => {
    // Custom JSON parser that captures raw body for signature verification
    webhookScope.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_req: FastifyRequest, body: Buffer, done: (err: Error | null, result?: unknown) => void) => {
        try {
          (_req as unknown as { rawBody?: Buffer }).rawBody = body;
          done(null, JSON.parse(body.toString()));
        } catch (err) {
          done(err as Error);
        }
      },
    );

    // POST /api/billing/webhook — Stripe webhook endpoint
    webhookScope.post('/api/billing/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers['stripe-signature'] as string;
    const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody;

    // Always verify signature — verifyStripeSignature handles missing secret
    // (allows in dev, rejects in production)
    if (!signature || !rawBody) {
      void logSecurityEvent('STRIPE_WEBHOOK_INVALID_SIGNATURE', undefined, request.ip, 'Missing stripe-signature header');
      return reply.code(400).send({ error: 'Missing stripe-signature header' });
    }
    const isValid = verifyStripeSignature(rawBody, signature);
    if (!isValid) {
      void logSecurityEvent('STRIPE_WEBHOOK_INVALID_SIGNATURE', undefined, request.ip, 'Invalid webhook signature');
      return reply.code(400).send({ error: 'Invalid webhook signature' });
    }

    const event = request.body as StripeEvent;

    if (!event || !event.type) {
      return reply.code(400).send({ error: 'Invalid event payload' });
    }

    console.log(`[StripeWebhook] Received event: ${event.type} (${event.id})`);

    // -----------------------------------------------------------------------
    // Idempotency guard — Stripe may retry webhook events multiple times.
    // Check if we've already processed this event ID; if so, return 200
    // immediately to prevent duplicate credit grants and other side effects.
    // -----------------------------------------------------------------------
    const alreadyProcessed = await prisma.stripeWebhookEvent.findUnique({
      where: { eventId: event.id },
    });

    if (alreadyProcessed) {
      console.log(`[StripeWebhook] Duplicate event ignored: ${event.type} (${event.id})`);
      return reply.send({ received: true, duplicate: true });
    }

    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await handleSubscriptionCreated(event.data.object as StripeSubscriptionObject);
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as StripeSubscriptionObject);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as StripeSubscriptionObject);
          break;
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object as StripeCheckoutSession);
          break;
        case 'invoice.paid':
          await handleInvoicePaid(event.data.object as StripeInvoice);
          break;
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object as StripeInvoice);
          break;
        default:
          console.log(`[StripeWebhook] Unhandled event type: ${event.type}`);
      }

      // Record this event as processed for idempotency
      await prisma.stripeWebhookEvent.create({
        data: {
          eventId: event.id,
          eventType: event.type,
        },
      });

      return reply.send({ received: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[StripeWebhook] Error handling ${event.type}:`, message);
      void logSecurityEvent('STRIPE_WEBHOOK_ERROR', undefined, request.ip, `${event.type}: ${message}`);
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });

  }); // end webhook plugin scope
}
