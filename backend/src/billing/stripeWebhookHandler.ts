// ============================================================================
// CourtAccess — Stripe Webhook Handler + Checkout/Portal Routes
// ============================================================================

import crypto from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import { dispatchStripeWebhookEvent, type StripeEvent } from './stripeWebhookProcessor.js';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

function verifyStripeSignature(payload: string | Buffer, signature: string): boolean {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.warn('[StripeWebhook] STRIPE_WEBHOOK_SECRET not set — skipping verification in dev mode');
    return process.env.NODE_ENV !== 'production';
  }

  const elements = signature.split(',');
  const timestampStr = elements.find((e) => e.startsWith('t='))?.slice(2);
  const signaturesV1 = elements.filter((e) => e.startsWith('v1=')).map((e) => e.slice(3));

  if (!timestampStr || signaturesV1.length === 0) return false;

  const timestamp = parseInt(timestampStr, 10);
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;

  const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf8');
  const signedPayload = `${timestampStr}.${payloadStr}`;
  const expectedSignature = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(signedPayload).digest('hex');

  for (const sig of signaturesV1) {
    try {
      if (crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

export async function registerStripeWebhookRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (webhookScope) => {
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

    webhookScope.post('/api/billing/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['stripe-signature'] as string;
      const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody;

      if (!signature || !rawBody) {
        void logSecurityEvent('STRIPE_WEBHOOK_INVALID_SIGNATURE', undefined, request.ip, 'Missing stripe-signature header');
        return reply.code(400).send({ error: 'Missing stripe-signature header' });
      }
      if (!verifyStripeSignature(rawBody, signature)) {
        void logSecurityEvent('STRIPE_WEBHOOK_INVALID_SIGNATURE', undefined, request.ip, 'Invalid webhook signature');
        return reply.code(400).send({ error: 'Invalid webhook signature' });
      }

      const event = request.body as StripeEvent;
      if (!event?.type) return reply.code(400).send({ error: 'Invalid event payload' });

      console.log(`[StripeWebhook] Received event: ${event.type} (${event.id})`);

      try {
        const result = await dispatchStripeWebhookEvent(event);
        return reply.send({ received: true, duplicate: result === 'duplicate' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[StripeWebhook] Error handling ${event.type}:`, message);
        void logSecurityEvent('STRIPE_WEBHOOK_ERROR', undefined, request.ip, `${event.type}: ${message}`);
        return reply.code(500).send({ error: 'Webhook processing failed' });
      }
    });
  });

  app.post('/api/billing/create-checkout-session', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as unknown as { user?: { userId: string } }).user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Authentication required' });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return reply.code(503).send({
        error: 'Stripe not configured',
        message: 'Configure STRIPE_SECRET_KEY to enable checkout',
      });
    }

    const { planId, billingInterval } = request.body as { planId: string; billingInterval?: 'month' | 'year' };
    if (!planId) return reply.code(400).send({ error: 'Missing planId' });

    const interval = billingInterval === 'year' ? 'year' : 'month';

    const SUBSCRIPTION_PRICES: Record<string, string> = {
      INDIVIDUAL: interval === 'year'
        ? (process.env.STRIPE_PRICE_INDIVIDUAL_ANNUAL || process.env.STRIPE_PRICE_INDIVIDUAL || '')
        : (process.env.STRIPE_PRICE_INDIVIDUAL_MONTHLY || process.env.STRIPE_PRICE_STARTER || ''),
      STANDARD: interval === 'year'
        ? (process.env.STRIPE_PRICE_STANDARD_ANNUAL || process.env.STRIPE_PRICE_STANDARD || '')
        : (process.env.STRIPE_PRICE_STANDARD_MONTHLY || process.env.STRIPE_PRICE_PROFESSIONAL || ''),
      COMPLEX_CASE: interval === 'year'
        ? (process.env.STRIPE_PRICE_COMPLEX_ANNUAL || process.env.STRIPE_PRICE_COMPLEX || '')
        : (process.env.STRIPE_PRICE_COMPLEX_MONTHLY || process.env.STRIPE_PRICE_ADVANCED || ''),
      PROFESSIONAL: interval === 'year'
        ? (process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL || process.env.STRIPE_PRICE_PROFESSIONAL_PLAN || '')
        : (process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || process.env.STRIPE_PRICE_LITIGATION || ''),
      // Legacy plan IDs
      STARTER: process.env.STRIPE_PRICE_STARTER || '',
      PROFESSIONAL_LEGACY: process.env.STRIPE_PRICE_PROFESSIONAL || '',
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
    if (!priceId) return reply.code(400).send({ error: `No Stripe price configured for plan: ${planId}` });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const params = new URLSearchParams();
    params.append('mode', isCreditPack ? 'payment' : 'subscription');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${process.env.FRONTEND_URL || 'https://courtaccess.net'}/dashboard/usage?checkout=success`);
    params.append('cancel_url', `${process.env.FRONTEND_URL || 'https://courtaccess.net'}/pricing?checkout=canceled`);
    params.append('client_reference_id', userId);
    params.append('metadata[userId]', userId);
    params.append('metadata[planId]', planId);
    params.append('metadata[billingInterval]', interval);
    if (!isCreditPack) {
      params.append('subscription_data[metadata][userId]', userId);
      params.append('subscription_data[metadata][planId]', planId);
    }
    if (user?.email) params.append('customer_email', user.email);

    try {
      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const session = (await stripeRes.json()) as { id?: string; url?: string; error?: { message?: string } };
      if (!stripeRes.ok || session.error) {
        return reply.code(500).send({ error: 'Stripe checkout failed' });
      }
      return reply.send({ url: session.url, sessionId: session.id });
    } catch (err) {
      return reply.code(500).send({ error: 'Failed to create checkout session' });
    }
  });

  app.get('/api/billing/checkout-status/:sessionId', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as unknown as { user?: { userId: string } }).user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Authentication required' });

    const { sessionId } = request.params as { sessionId: string };
    if (!/^cs_(test|live)_[a-zA-Z0-9]+$/.test(sessionId)) {
      return reply.code(400).send({ error: 'Invalid session ID format' });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return reply.code(503).send({ error: 'Stripe not configured' });

    try {
      const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      const session = (await stripeRes.json()) as { id?: string; status?: string; payment_status?: string };
      if (!stripeRes.ok) return reply.code(404).send({ error: 'Session not found' });
      return reply.send({ sessionId: session.id, status: session.status, paymentStatus: session.payment_status });
    } catch {
      return reply.code(500).send({ error: 'Failed to retrieve checkout status' });
    }
  });

  app.post('/api/billing/create-portal-session', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as unknown as { user?: { userId: string } }).user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Authentication required' });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return reply.code(503).send({ error: 'Stripe is not configured' });

    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.stripeCustomerId) {
      return reply.code(400).send({ error: 'No Stripe customer on file. Subscribe to a paid plan first.' });
    }

    const params = new URLSearchParams();
    params.append('customer', sub.stripeCustomerId);
    params.append('return_url', `${process.env.FRONTEND_URL || 'https://courtaccess.net'}/dashboard/usage`);

    try {
      const stripeRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const session = (await stripeRes.json()) as { url?: string; error?: { message?: string } };
      if (!stripeRes.ok || session.error) {
        return reply.code(500).send({ error: 'Failed to create billing portal session' });
      }
      return reply.send({ url: session.url });
    } catch {
      return reply.code(500).send({ error: 'Failed to create billing portal session' });
    }
  });
}
