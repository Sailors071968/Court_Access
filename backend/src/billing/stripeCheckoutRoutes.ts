// ============================================================================
// CourtAccess — Stripe Checkout Routes
// POST /api/billing/create-checkout-session  — Create Stripe checkout session
// GET  /api/billing/checkout-status/:sessionId — Check checkout status
// GET  /api/billing/acu-packs                 — List available ACU credit packs
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import {
  getPlanById,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
} from './subscriptionService.js';
import { CREDIT_PACKS } from './aiCreditService.js';

// ---------------------------------------------------------------------------
// Stripe Configuration
// ---------------------------------------------------------------------------

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://courtaccess.net';

function getStripe(): Stripe | null {
  if (!STRIPE_SECRET_KEY) {
    console.warn('[Stripe] STRIPE_SECRET_KEY not set — checkout disabled');
    return null;
  }
  return new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' as Stripe.LatestApiVersion });
}

// ---------------------------------------------------------------------------
// Stripe Price ID Mapping — Maps internal plan IDs to Stripe Price IDs
// In production, these should be set via environment variables or DB config.
// ---------------------------------------------------------------------------

interface StripePriceMapping {
  planId: SubscriptionPlanId;
  stripePriceId: string;
  mode: 'subscription' | 'payment';
}

// Subscription plan price mappings (set via env vars)
function getSubscriptionPriceMappings(): StripePriceMapping[] {
  return [
    { planId: 'STARTER', stripePriceId: process.env.STRIPE_PRICE_STARTER || '', mode: 'subscription' },
    { planId: 'PROFESSIONAL', stripePriceId: process.env.STRIPE_PRICE_PROFESSIONAL || '', mode: 'subscription' },
    { planId: 'ADVANCED_INVESTIGATOR', stripePriceId: process.env.STRIPE_PRICE_ADVANCED || '', mode: 'subscription' },
    { planId: 'LITIGATION_INTELLIGENCE_PRO', stripePriceId: process.env.STRIPE_PRICE_LITIGATION || '', mode: 'subscription' },
    { planId: 'ENTERPRISE_FIRM', stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE || '', mode: 'subscription' },
  ];
}

// ACU credit pack price mappings (set via env vars)
interface ACUPackMapping {
  packId: string;
  credits: number;
  stripePriceId: string;
  priceCents: number;
}

function getACUPackMappings(): ACUPackMapping[] {
  return [
    { packId: 'acu_100', credits: 100, stripePriceId: process.env.STRIPE_PRICE_ACU_100 || '', priceCents: 4900 },
    { packId: 'acu_500', credits: 500, stripePriceId: process.env.STRIPE_PRICE_ACU_500 || '', priceCents: 19900 },
    { packId: 'acu_1000', credits: 1000, stripePriceId: process.env.STRIPE_PRICE_ACU_1000 || '', priceCents: 34900 },
  ];
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerStripeCheckoutRoutes(app: FastifyInstance): Promise<void> {

  // =========================================================================
  // POST /api/billing/create-checkout-session
  // Creates a Stripe Checkout session for subscription or ACU credit purchase
  // =========================================================================

  app.post('/api/billing/create-checkout-session', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const stripe = getStripe();
    if (!stripe) {
      return reply.code(503).send({
        error: 'Stripe not configured',
        message: 'Payment processing is not available. Please contact support.',
      });
    }

    const body = request.body as {
      planId?: string;
      packId?: string;
      userId?: string;
    };

    const userId = user.userId;

    // Determine checkout type: subscription plan or ACU credit pack
    if (body.planId) {
      // --- Subscription checkout ---
      const plan = getPlanById(body.planId as SubscriptionPlanId);
      if (!plan) {
        return reply.code(400).send({ error: 'Invalid plan ID', validPlans: SUBSCRIPTION_PLANS.map(p => p.id) });
      }

      if (plan.id === 'FREE') {
        return reply.code(400).send({ error: 'Free plan does not require checkout' });
      }

      const priceMapping = getSubscriptionPriceMappings().find(m => m.planId === plan.id);
      if (!priceMapping || !priceMapping.stripePriceId) {
        // Fallback: create a checkout with plan price inline
        try {
          const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            line_items: [{
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `CourtAccess ${plan.name} Plan`,
                  description: plan.description,
                },
                unit_amount: plan.priceCents,
                recurring: { interval: 'month' },
              },
              quantity: 1,
            }],
            metadata: {
              userId,
              planId: plan.id,
              type: 'subscription',
            },
            subscription_data: {
              metadata: {
                userId,
                planId: plan.id,
                type: 'subscription',
              },
            },
            success_url: `${FRONTEND_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${FRONTEND_URL}/pricing?checkout=cancelled`,
            customer_email: user.email,
          });

          return reply.send({ checkoutUrl: session.url, sessionId: session.id });
        } catch (err) {
          console.error('[Stripe] Checkout session creation failed:', err);
          const message = err instanceof Error ? err.message : 'Unknown error';
          return reply.code(500).send({ error: 'Failed to create checkout session', details: message });
        }
      }

      // Use pre-configured Stripe Price ID
      try {
        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          line_items: [{ price: priceMapping.stripePriceId, quantity: 1 }],
          metadata: {
            userId,
            planId: plan.id,
            type: 'subscription',
          },
          subscription_data: {
            metadata: {
              userId,
              planId: plan.id,
              type: 'subscription',
            },
          },
          success_url: `${FRONTEND_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${FRONTEND_URL}/pricing?checkout=cancelled`,
          customer_email: user.email,
        });

        return reply.send({ checkoutUrl: session.url, sessionId: session.id });
      } catch (err) {
        console.error('[Stripe] Checkout session creation failed:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return reply.code(500).send({ error: 'Failed to create checkout session', details: message });
      }
    }

    if (body.packId) {
      // --- ACU Credit Pack checkout ---
      const packMapping = getACUPackMappings().find(p => p.packId === body.packId);
      if (!packMapping) {
        return reply.code(400).send({
          error: 'Invalid ACU pack ID',
          validPacks: getACUPackMappings().map(p => ({ packId: p.packId, credits: p.credits })),
        });
      }

      try {
        const sessionParams: Stripe.Checkout.SessionCreateParams = {
          mode: 'payment',
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${packMapping.credits} ACU Credits`,
                description: `Analysis Compute Unit credit pack — ${packMapping.credits} credits`,
              },
              unit_amount: packMapping.priceCents,
            },
            quantity: 1,
          }],
          metadata: {
            userId,
            packId: packMapping.packId,
            credits: String(packMapping.credits),
            type: 'acu_credits',
          },
          success_url: `${FRONTEND_URL}/dashboard?checkout=success&type=credits&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${FRONTEND_URL}/dashboard?checkout=cancelled`,
          customer_email: user.email,
        };

        const session = await stripe.checkout.sessions.create(sessionParams);
        return reply.send({ checkoutUrl: session.url, sessionId: session.id });
      } catch (err) {
        console.error('[Stripe] ACU credit checkout failed:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return reply.code(500).send({ error: 'Failed to create checkout session', details: message });
      }
    }

    return reply.code(400).send({
      error: 'Either planId or packId is required',
      example: {
        subscription: { planId: 'PROFESSIONAL' },
        credits: { packId: 'acu_500' },
      },
    });
  });

  // NOTE: POST /api/billing/webhook is handled by stripeWebhookHandler.ts
  // which provides more robust HMAC-SHA256 verification with replay protection,
  // multi-signature rotation support, and handles more event types
  // (invoice.paid, invoice.payment_failed, subscription.created, etc.)

  // =========================================================================
  // GET /api/billing/checkout-status/:sessionId
  // Check status of a checkout session
  // =========================================================================

  app.get('/api/billing/checkout-status/:sessionId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const stripe = getStripe();
    if (!stripe) {
      return reply.code(503).send({ error: 'Stripe not configured' });
    }

    const { sessionId } = request.params as { sessionId: string };

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // Verify the session belongs to this user
      if (session.metadata?.userId !== user.userId) {
        return reply.code(403).send({ error: 'Session does not belong to this user' });
      }

      return reply.send({
        status: session.status,
        paymentStatus: session.payment_status,
        metadata: session.metadata,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.code(404).send({ error: 'Session not found', details: message });
    }
  });

  // =========================================================================
  // GET /api/billing/acu-packs — List available ACU credit packs
  // =========================================================================

  app.get('/api/billing/acu-packs', async (_request: FastifyRequest, reply: FastifyReply) => {
    const packs = getACUPackMappings().map(p => ({
      packId: p.packId,
      credits: p.credits,
      priceCents: p.priceCents,
      priceFormatted: `$${(p.priceCents / 100).toFixed(2)}`,
    }));

    // Also include existing credit packs
    const existingPacks = CREDIT_PACKS.map(p => ({
      packId: p.packId,
      credits: p.credits,
      priceCents: p.priceCents,
      priceFormatted: `$${(p.priceCents / 100).toFixed(2)}`,
    }));

    return reply.send({
      acuPacks: packs,
      creditPacks: existingPacks,
    });
  });

  console.log('[Server] Stripe checkout routes registered');
}
