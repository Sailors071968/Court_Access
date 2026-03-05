// ============================================
// Court Access — Main Server Entry Point
// Wires together all backend modules:
// - Stripe Checkout + Webhooks (Phases 32)
// - Evidence Upload Pipeline (Phase 28)
// - BullMQ Workers (Phase 28)
// - Virus Scanning (Phase 29)
// - R2 Storage (Phase 31)
// - Rate Limiting + Subscription Guards (Phase 33)
// - Error Monitoring (Phase 34)
// ============================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { initErrorMonitoring, sentryErrorHandler, captureMessage } from './services/errorMonitoring.js';
import { registerWebhookRoutes } from './routes/stripeWebhooks.js';
import evidenceUploadRoutes from './routes/evidenceUpload.js';
import { startProcessingWorker, stopProcessingWorker, getQueueStats } from './workers/evidenceProcessor.js';
import { getRedisConnection, closeRedisConnection } from './services/redisClient.js';
import { isClamAVAvailable } from './services/virusScanner.js';
import { apiLimiter, webhookLimiter } from './middleware/rateLimiter.js';
import { isSmsAvailable } from './services/smsNotification.js';
import hearingsRoutes, { hearingsStore, reminderLogsStore } from './routes/hearings.js';
import { initScheduler, stopScheduler } from './services/hearingScheduler.js';
import Stripe from 'stripe';

const app = express();

// ---------------------------------------------------------------------------
// Initialize Services
// ---------------------------------------------------------------------------

await initErrorMonitoring();

// ---------------------------------------------------------------------------
// Security Middleware
// ---------------------------------------------------------------------------

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ---------------------------------------------------------------------------
// CORS Configuration
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));

// ---------------------------------------------------------------------------
// Body Parsing
// ---------------------------------------------------------------------------

// JSON body parser for all routes EXCEPT Stripe webhooks
// Stripe webhooks need the raw body for signature verification
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhooks') {
    // Skip JSON parsing — raw body handled by webhook route
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});

// ---------------------------------------------------------------------------
// Stripe Configuration (for checkout routes)
// ---------------------------------------------------------------------------

const stripe = config.stripeSecretKey
  ? new Stripe(config.stripeSecretKey, { apiVersion: '2024-12-18.acacia' })
  : null;

const PLANS = {
  free: {
    name: 'Free',
    priceAmount: 0,
    interval: null,
    features: ['1 document analysis', 'Up to 10 pages per document', 'Basic structure mapping'],
  },
  professional: {
    name: 'Professional',
    priceAmount: 9900,
    interval: 'month',
    features: ['Unlimited document analysis', 'Up to 500 pages per document', 'Full structure mapping', 'Case analytics dashboard'],
  },
  team: {
    name: 'Team',
    priceAmount: 24900,
    interval: 'month',
    features: ['Everything in Professional', 'Up to 10 team members', 'Role-based access control', 'Cross-case indexing'],
  },
};

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

// Webhook limiter first (more permissive), then API limiter excluding webhooks
app.use('/api/stripe/webhooks', webhookLimiter);
app.use('/api/', (req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhooks') return next();
  return apiLimiter(req, res, next);
});

// ---------------------------------------------------------------------------
// Routes — Stripe Checkout (existing functionality)
// ---------------------------------------------------------------------------

app.post('/api/stripe/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  try {
    const { plan, email } = req.body;

    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan. Must be one of: professional, team' });
    }

    if (plan === 'free') {
      return res.status(400).json({ error: 'Free plan does not require checkout.' });
    }

    const planConfig = PLANS[plan];
    const origin = ALLOWED_ORIGINS.includes(req.headers.origin) ? req.headers.origin : ALLOWED_ORIGINS[0];

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
            recurring: { interval: planConfig.interval },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      metadata: { plan, source: 'court-access-frontend' },
    };

    if (email) sessionParams.customer_email = email;

    const session = await stripe.checkout.sessions.create(sessionParams);
    console.log(`[Stripe] Checkout session created: ${session.id} for plan: ${plan}`);
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[Stripe] Error creating checkout session:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

app.get('/api/stripe/session-status', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  try {
    const { session_id } = req.query;
    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({ error: 'session_id is required and must be a string' });
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

app.get('/api/stripe/plans', (_req, res) => {
  const plans = Object.entries(PLANS).map(([id, c]) => ({
    id,
    name: c.name,
    price: c.priceAmount / 100,
    interval: c.interval,
    features: c.features,
  }));
  res.json({ plans });
});

// ---------------------------------------------------------------------------
// Routes — Stripe Webhooks (Phase 32)
// ---------------------------------------------------------------------------

registerWebhookRoutes(app);

// ---------------------------------------------------------------------------
// Routes — Evidence Upload + Processing (Phase 28/29/31)
// ---------------------------------------------------------------------------

app.use('/api/evidence', evidenceUploadRoutes);

// ---------------------------------------------------------------------------
// Routes — Court Hearings + SMS Reminders
// ---------------------------------------------------------------------------

app.use('/api/hearings', hearingsRoutes);

// ---------------------------------------------------------------------------
// Health Check + System Status
// ---------------------------------------------------------------------------

app.get('/api/health', async (_req, res) => {
  const redisConnected = !!getRedisConnection();
  const clamavAvailable = await isClamAVAvailable();
  let queueStats = null;

  try {
    queueStats = await getQueueStats();
  } catch {
    // Queue stats unavailable
  }

  res.json({
    status: 'ok',
    service: 'court-access-api',
    version: '2.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    services: {
      redis: redisConnected ? 'connected' : 'disconnected',
      stripe: config.stripeSecretKey ? 'configured' : 'not_configured',
      openai: config.openaiApiKey ? 'configured' : 'not_configured',
      r2Storage: (config.r2AccessKeyId && config.r2SecretAccessKey) ? 'configured' : 'not_configured',
      clamav: clamavAvailable ? 'available' : 'unavailable',
      sentry: config.sentryDsn ? 'configured' : 'not_configured',
      twilio: isSmsAvailable() ? 'configured' : 'not_configured',
    },
    queue: queueStats,
  });
});

// Legacy health check endpoint
app.get('/api/stripe/health', (_req, res) => {
  res.json({ status: 'ok', service: 'court-access-stripe-api' });
});

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

app.use(sentryErrorHandler());

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

const PORT = config.port || 3001;

const server = app.listen(PORT, () => {
  console.log(`\n[Court Access] API server running on http://localhost:${PORT}`);
  console.log(`[Court Access] Environment: ${config.nodeEnv}`);
  console.log(`[Court Access] Services:`);
  console.log(`  - Stripe: ${config.stripeSecretKey ? 'configured' : 'MISSING'}`);
  console.log(`  - OpenAI: ${config.openaiApiKey ? 'configured' : 'MISSING'}`);
  console.log(`  - R2 Storage: ${config.r2AccessKeyId ? 'configured' : 'MISSING'}`);
  console.log(`  - Redis: ${config.redisUrl}`);
  console.log(`  - Sentry: ${config.sentryDsn ? 'configured' : 'MISSING'}`);
  console.log(`  - Twilio SMS: ${config.twilioAccountSid ? 'configured' : 'MISSING'}`);
  console.log(`  - Hearing Scheduler: running (hourly)`);
  console.log('');
});

// Start hearing reminder scheduler
initScheduler(hearingsStore, reminderLogsStore);

// Start BullMQ worker
const worker = startProcessingWorker();
if (worker) {
  console.log('[Court Access] Evidence processing worker started');
} else {
  console.log('[Court Access] Evidence processing worker not started (Redis unavailable)');
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal) {
  console.log(`\n[Court Access] Received ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    stopScheduler();
    await stopProcessingWorker();
    await closeRedisConnection();
    console.log('[Court Access] Server shut down complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('[Court Access] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
