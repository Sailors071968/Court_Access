// ============================================
// Court Access — Stripe Checkout API Server
// Creates Stripe Checkout Sessions for plan upgrades.
//
// Endpoints:
//   POST /api/stripe/create-checkout-session
//   GET  /api/stripe/session-status?session_id=...
//
// Requires: STRIPE_SECRET_KEY env var
// ============================================

import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.STRIPE_API_PORT || 3001;

// ---------------------------------------------------------------------------
// Stripe Configuration
// ---------------------------------------------------------------------------

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

// Court Access pricing plans — maps plan IDs to Stripe price lookup keys.
// In production, these would be created in Stripe Dashboard and referenced by price ID.
const PLANS = {
  free: {
    name: 'Free',
    priceAmount: 0,
    interval: null,
    features: ['1 document analysis', 'Up to 10 pages per document', 'Basic structure mapping'],
  },
  professional: {
    name: 'Professional',
    priceAmount: 9900, // $99.00 in cents
    interval: 'month',
    features: ['Unlimited document analysis', 'Up to 500 pages per document', 'Full structure mapping', 'Case analytics dashboard'],
  },
  team: {
    name: 'Team',
    priceAmount: 24900, // $249.00 in cents
    interval: 'month',
    features: ['Everything in Professional', 'Up to 10 team members', 'Role-based access control', 'Cross-case indexing'],
  },
};

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true,
}));
app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/stripe/create-checkout-session
 * Creates a Stripe Checkout Session for the selected plan.
 *
 * Body: { plan: 'professional' | 'team', email?: string, name?: string }
 * Returns: { url: string } — redirect URL for Stripe hosted checkout
 */
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { plan, email, name } = req.body;

    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan. Must be one of: professional, team' });
    }

    if (plan === 'free') {
      return res.status(400).json({ error: 'Free plan does not require checkout.' });
    }

    const planConfig = PLANS[plan];
    const origin = req.headers.origin || 'http://localhost:5174';

    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Court Access — ${planConfig.name}`,
              description: planConfig.features.join(', '),
            },
            unit_amount: planConfig.priceAmount,
            recurring: {
              interval: planConfig.interval,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      metadata: {
        plan,
        source: 'court-access-frontend',
      },
    };

    // Pre-fill customer email if provided
    if (email) {
      sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`[Stripe] Checkout session created: ${session.id} for plan: ${plan}`);
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[Stripe] Error creating checkout session:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

/**
 * GET /api/stripe/session-status?session_id=...
 * Returns the status of a Stripe Checkout Session (for success page).
 */
app.get('/api/stripe/session-status', async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    res.json({
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email || session.customer_email,
      plan: session.metadata?.plan,
      amountTotal: session.amount_total,
      currency: session.currency,
    });
  } catch (err) {
    console.error('[Stripe] Error retrieving session:', err.message);
    res.status(500).json({ error: 'Failed to retrieve session status.' });
  }
});

/**
 * GET /api/stripe/plans
 * Returns available plans and pricing.
 */
app.get('/api/stripe/plans', (_req, res) => {
  const plans = Object.entries(PLANS).map(([id, config]) => ({
    id,
    name: config.name,
    price: config.priceAmount / 100,
    interval: config.interval,
    features: config.features,
  }));
  res.json({ plans });
});

// Health check
app.get('/api/stripe/health', (_req, res) => {
  res.json({ status: 'ok', service: 'court-access-stripe-api' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`[Court Access] Stripe API server running on http://localhost:${PORT}`);
  console.log(`[Court Access] Stripe key: ${process.env.STRIPE_SECRET_KEY ? 'configured' : 'MISSING'}`);
});
