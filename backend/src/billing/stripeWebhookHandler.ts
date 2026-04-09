// ============================================================================
// CourtAccess — Stripe Webhook Handler
// Receives Stripe webhook events, verifies HMAC-SHA256 signature,
// and persists subscription state changes to PostgreSQL via Prisma.
// ============================================================================

import crypto from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { logSecurityEvent } from '../security/authMiddleware.js';

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

  const metaPlanId = session.metadata?.planId;

  // Credit pack purchases — add credits without touching subscription
  if (metaPlanId && metaPlanId.startsWith('CREDIT_PACK_')) {
    const CREDIT_AMOUNTS: Record<string, number> = {
      CREDIT_PACK_50: 50,
      CREDIT_PACK_150: 150,
      CREDIT_PACK_500: 500,
      CREDIT_PACK_1500: 1500,
    };
    const credits = CREDIT_AMOUNTS[metaPlanId] || 0;
    if (credits > 0) {
      // Atomic idempotency guard using StripeWebhookEvent unique constraint.
      // If this session was already processed, the create will throw a unique
      // constraint violation and we skip the duplicate — no TOCTOU race.
      try {
        await prisma.stripeWebhookEvent.create({
          data: {
            eventId: `credit_pack_${session.id}`,
            eventType: 'checkout.session.completed.credit_pack',
          },
        });
      } catch {
        console.log(`[StripeWebhook] Credit pack session ${session.id} already processed — skipping duplicate`);
        return;
      }

      await prisma.aiCreditBalance.upsert({
        where: { userId },
        update: { purchasedCredits: { increment: credits } },
        create: {
          userId,
          purchasedCredits: credits,
          monthlyCredits: 0,
          creditsUsed: 0,
          billingPeriodStart: new Date(),
          billingPeriodEnd: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      });
    }

    void logSecurityEvent(
      'STRIPE_CREDIT_PACK_PURCHASED',
      userId,
      undefined,
      `Credit pack ${metaPlanId} (${credits} credits) purchased via session ${session.id}`,
    );
    console.log(`[StripeWebhook] Credit pack purchased: user=${userId} pack=${metaPlanId} credits=${credits} session=${session.id}`);
    return;
  }

  // Subscription checkout — update subscription record
  const mapped = metaPlanId
    ? mapPlanIdToTier(metaPlanId)
    : { planId: 'STARTER', tier: 'starter' };

  if (!metaPlanId) {
    console.warn(`[StripeWebhook] checkout.session.completed missing planId in metadata for session ${session.id} — defaulting to STARTER`);
  }

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

      return reply.send({ received: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[StripeWebhook] Error handling ${event.type}:`, message);
      void logSecurityEvent('STRIPE_WEBHOOK_ERROR', undefined, request.ip, `${event.type}: ${message}`);
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });

  }); // end webhook plugin scope

  // POST /api/billing/create-checkout-session — Create Stripe checkout session
  app.post('/api/billing/create-checkout-session', async (request: FastifyRequest, reply: FastifyReply) => {
    // Always read userId from authenticated JWT — never trust client-supplied userId
    const userId = ((request as unknown as { user?: { userId: string } }).user)?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return reply.send({
        message: 'Stripe checkout session creation requires STRIPE_SECRET_KEY to be configured',
        note: 'Configure STRIPE_SECRET_KEY env var to enable real Stripe checkout',
      });
    }

    const { planId } = request.body as { planId: string };
    if (!planId || typeof planId !== 'string') {
      return reply.code(400).send({ error: 'Missing or invalid planId' });
    }

    // Map plan IDs to Stripe price IDs
    const SUBSCRIPTION_PRICES: Record<string, string> = {
      STARTER: process.env.STRIPE_PRICE_STARTER || '',
      PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL || '',
      ADVANCED_INVESTIGATOR: process.env.STRIPE_PRICE_ADVANCED || '',
      LITIGATION_INTELLIGENCE_PRO: process.env.STRIPE_PRICE_LITIGATION || '',
      ENTERPRISE_FIRM: process.env.STRIPE_PRICE_ENTERPRISE || '',
    };

    const CREDIT_PACK_PRICES: Record<string, string> = {
      CREDIT_PACK_50: process.env.STRIPE_PRICE_CREDIT_50 || '',
      CREDIT_PACK_150: process.env.STRIPE_PRICE_CREDIT_150 || '',
      CREDIT_PACK_500: process.env.STRIPE_PRICE_CREDIT_500 || '',
      CREDIT_PACK_1500: process.env.STRIPE_PRICE_CREDIT_1500 || '',
    };

    const isCreditPack = planId.startsWith('CREDIT_PACK_');
    const priceId = isCreditPack ? CREDIT_PACK_PRICES[planId] : SUBSCRIPTION_PRICES[planId];
    if (!priceId) {
      return reply.code(400).send({ error: `No Stripe price configured for plan: ${planId}` });
    }

    // Look up user email for Stripe checkout
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

    // Create Stripe Checkout Session via REST API
    const params = new URLSearchParams();
    params.append('mode', isCreditPack ? 'payment' : 'subscription');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${process.env.FRONTEND_URL || 'https://courtaccess.net'}/dashboard?checkout=success`);
    params.append('cancel_url', `${process.env.FRONTEND_URL || 'https://courtaccess.net'}/pricing?checkout=canceled`);
    params.append('client_reference_id', userId);
    params.append('metadata[userId]', userId);
    params.append('metadata[planId]', planId);
    if (user?.email) {
      params.append('customer_email', user.email);
    }

    try {
      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const session = await stripeRes.json() as { id?: string; url?: string; error?: { message?: string } };

      if (!stripeRes.ok || session.error) {
        console.error('[Stripe] Checkout session creation failed:', session.error?.message);
        return reply.code(500).send({ error: 'Stripe checkout failed' });
      }

      return reply.send({ url: session.url, sessionId: session.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Stripe] Checkout session error:', message);
      return reply.code(500).send({ error: 'Failed to create checkout session' });
    }
  });

  // GET /api/billing/checkout-status/:sessionId — Check checkout status
  app.get('/api/billing/checkout-status/:sessionId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { sessionId } = request.params as { sessionId: string };

    // Validate sessionId format to prevent SSRF via path traversal
    if (!/^cs_(test|live)_[a-zA-Z0-9]+$/.test(sessionId)) {
      return reply.code(400).send({ error: 'Invalid session ID format' });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return reply.send({ sessionId, status: 'pending', note: 'Configure STRIPE_SECRET_KEY env var' });
    }

    try {
      const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${stripeKey}` },
      });
      const session = await stripeRes.json() as { id?: string; status?: string; payment_status?: string; error?: { message?: string } };

      if (!stripeRes.ok || session.error) {
        console.error('[Stripe] Checkout status retrieval failed:', session.error?.message);
        return reply.code(404).send({ error: 'Session not found' });
      }

      return reply.send({
        sessionId: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Stripe] Checkout status error:', message);
      return reply.code(500).send({ error: 'Failed to retrieve checkout status' });
    }
  });
}
