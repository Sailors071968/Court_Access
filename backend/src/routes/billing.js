// ============================================
// Court Access — Billing Routes
// Phase 39: Stripe subscription lifecycle — billing page, invoices, cancellation
// ============================================

import { Router } from 'express';
import Stripe from 'stripe';
import prisma from '../services/prismaClient.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config/index.js';

const router = Router();

// Lazy-init Stripe instance
let stripe = null;
function getStripe() {
  if (!stripe && config.stripeSecretKey) {
    stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2023-10-16' });
  }
  return stripe;
}

// All billing routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Price IDs mapping (Stripe products)
// ---------------------------------------------------------------------------

const PLAN_PRICES = {
  professional: process.env.STRIPE_PRICE_PROFESSIONAL || 'price_professional',
  team: process.env.STRIPE_PRICE_TEAM || 'price_team',
};

// ---------------------------------------------------------------------------
// POST /api/billing/create-checkout — Create Stripe checkout session
// ---------------------------------------------------------------------------

router.post('/create-checkout', async (req, res) => {
  try {
    const s = getStripe();
    if (!s) {
      return res.status(503).json({ error: 'Payment processing not configured' });
    }

    const { plan } = req.body;
    if (!plan || !PLAN_PRICES[plan]) {
      return res.status(400).json({ error: 'Invalid plan. Choose: professional, team' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await s.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const session = await s.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PLAN_PRICES[plan], quantity: 1 }],
      success_url: `${frontendUrl}/app/billing?success=true`,
      cancel_url: `${frontendUrl}/app/billing?cancelled=true`,
      metadata: { userId: user.id, plan },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[Billing] Checkout error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/billing/subscription — Get current subscription details
// ---------------------------------------------------------------------------

router.get('/subscription', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscription = {
      plan: user.plan,
      status: user.subscriptionStatus,
      stripeCustomerId: user.stripeCustomerId || null,
      subscriptionId: user.subscriptionId || null,
    };

    // If Stripe is configured and user has a subscription, get details
    const s = getStripe();
    if (s && user.subscriptionId) {
      try {
        const sub = await s.subscriptions.retrieve(user.subscriptionId);
        subscription.currentPeriodEnd = sub.current_period_end;
        subscription.cancelAtPeriodEnd = sub.cancel_at_period_end;
        subscription.interval = sub.items?.data?.[0]?.price?.recurring?.interval || 'month';
      } catch {
        // Subscription may not exist in Stripe anymore
      }
    }

    res.json({ subscription });
  } catch (err) {
    console.error('[Billing] Subscription error:', err.message);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/billing/invoices — Get invoice history
// ---------------------------------------------------------------------------

router.get('/invoices', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.stripeCustomerId) {
      return res.json({ invoices: [] });
    }

    const s = getStripe();
    if (!s) {
      return res.json({ invoices: [] });
    }

    const invoices = await s.invoices.list({
      customer: user.stripeCustomerId,
      limit: 20,
    });

    res.json({
      invoices: invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        amount: inv.amount_paid,
        currency: inv.currency,
        status: inv.status,
        date: inv.created,
        pdfUrl: inv.invoice_pdf,
        hostedUrl: inv.hosted_invoice_url,
      })),
    });
  } catch (err) {
    console.error('[Billing] Invoices error:', err.message);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/billing/cancel — Cancel subscription
// ---------------------------------------------------------------------------

router.post('/cancel', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.subscriptionId) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    const s = getStripe();
    if (!s) {
      return res.status(503).json({ error: 'Payment processing not configured' });
    }

    // Cancel at period end (not immediately)
    await s.subscriptions.update(user.subscriptionId, {
      cancel_at_period_end: true,
    });

    res.json({ success: true, message: 'Subscription will cancel at end of billing period' });
  } catch (err) {
    console.error('[Billing] Cancel error:', err.message);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/billing/portal — Create Stripe customer portal session
// ---------------------------------------------------------------------------

router.post('/portal', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.stripeCustomerId) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const s = getStripe();
    if (!s) {
      return res.status(503).json({ error: 'Payment processing not configured' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const session = await s.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${frontendUrl}/app/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Billing] Portal error:', err.message);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

export default router;
