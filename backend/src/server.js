// ============================================
// Court Access — Main Server Entry Point
// Wires together all backend modules:
// - Phases 36-45: Full system integration + beta readiness
// - Stripe Checkout + Webhooks (Phases 32/39)
// - Evidence Upload Pipeline (Phase 28/37)
// - BullMQ Workers (Phase 28/38)
// - Virus Scanning (Phase 29)
// - R2 Storage (Phase 31)
// - Rate Limiting + Subscription Guards (Phase 33)
// - Error Monitoring (Phase 34/42)
// - Auth + Tenant Isolation (Phase 36/40)
// - Beta User Controls (Phase 43)
// - Deployment Readiness (Phase 44)
// ============================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateProductionEnvironment } from './config/index.js';
import { initErrorMonitoring, sentryErrorHandler, captureMessage } from './services/errorMonitoring.js';
import { registerWebhookRoutes } from './routes/stripeWebhooks.js';
import evidenceUploadRoutes from './routes/evidenceUpload.js';
import { startProcessingWorker, stopProcessingWorker, getQueueStats } from './workers/evidenceProcessor.js';
import { getRedisConnection, closeRedisConnection, isRedisAvailable } from './services/redisClient.js';
import { isClamAVAvailable } from './services/virusScanner.js';
import { apiLimiter, webhookLimiter, authLimiter } from './middleware/rateLimiter.js';
import { isSmsAvailable } from './services/smsNotification.js';
import hearingsRoutes from './routes/hearings.js';
import timelineRoutes from './routes/timeline.js';
import entitiesRoutes from './routes/entities.js';
import narrativeRoutes from './routes/narrative.js';
import integrityRoutes from './routes/integrity.js';
import archivesRoutes from './routes/archives.js';
import transcriptsRoutes from './routes/transcripts.js';
import correlationsRoutes from './routes/correlations.js';
import policyComplianceRoutes from './routes/policyCompliance.js';
import emailRoutes from './routes/email.js';
import agenciesRoutes from './routes/agencies.js';
import recordsRequestsRoutes from './routes/recordsRequests.js';
import crossReferenceRoutes from './routes/crossReference.js';
import systemTestRoutes from './routes/systemTest.js';
import backupRecoveryRoutes from './routes/backupRecovery.js';
import betaAccessControlRoutes from './routes/betaAccessControl.js';
import betaReadinessRoutes from './routes/betaReadiness.js';
import alertRoutes from './routes/alerts.js';
import betaFeedbackRoutes from './routes/betaFeedback.js';
import bugTrackingRoutes from './routes/bugTracking.js';
import healthReportRoutes from './routes/healthReport.js';
import { initScheduler, stopScheduler, getReminderStatus, runSchedulerPass } from './services/hearingScheduler.js';
import { registerWorker, startWorker, startHealthChecker, stopAllWorkers, getWorkerStatuses } from './services/workerMonitor.js';
import { initAlertRules, installCrashHandlers } from './services/alertService.js';
import Stripe from 'stripe';

// Phase 36-45 imports
import { authenticate, requireRole } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import casesRoutes from './routes/cases.js';
import billingRoutes from './routes/billing.js';
import adminMonitoringRoutes from './routes/adminMonitoring.js';
import betaControlsRoutes from './routes/betaControls.js';
import deploymentReadinessRoutes, { runStartupChecks } from './routes/deploymentReadiness.js';
import { logApiError } from './services/systemLogger.js';

const app = express();

// ---------------------------------------------------------------------------
// Initialize Services
// ---------------------------------------------------------------------------

// Phase 99: Validate required environment variables on startup
validateProductionEnvironment();

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
  if (req.originalUrl.startsWith('/api/admin/')) return next(); // Admin endpoints exempt from rate limit
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
// Routes — Phase A-E: Intelligence Layer
// ---------------------------------------------------------------------------

app.use('/api/timeline', timelineRoutes);
app.use('/api/entities', entitiesRoutes);
app.use('/api/narrative', narrativeRoutes);
app.use('/api/integrity', integrityRoutes);
app.use('/api/archives', archivesRoutes);

// ---------------------------------------------------------------------------
// Routes — Phase 52-56: AI Evidence Intelligence Layer
// ---------------------------------------------------------------------------

app.use('/api/transcripts', transcriptsRoutes);
app.use('/api/correlations', correlationsRoutes);
app.use('/api/policy', policyComplianceRoutes);

// ---------------------------------------------------------------------------
// Routes — Phases 63-69: Email System (SES Sandbox)
// ---------------------------------------------------------------------------

app.use('/api/email', emailRoutes);

// ---------------------------------------------------------------------------
// Routes — Phases 70-75: Law Enforcement Agency Intelligence
// ---------------------------------------------------------------------------

app.use('/api/agencies', agenciesRoutes);

// ---------------------------------------------------------------------------
// Routes — Phases 76-81: Public Records Request System
// ---------------------------------------------------------------------------

app.use('/api/records-requests', recordsRequestsRoutes);

// ---------------------------------------------------------------------------
// Routes — Phases 82-83: Evidence Cross-Reference Engine
// ---------------------------------------------------------------------------

app.use('/api/cross-reference', crossReferenceRoutes);

// ---------------------------------------------------------------------------
// Routes — Phase 36: Auth + User Management
// ---------------------------------------------------------------------------

app.use('/api/auth', authLimiter, authRoutes);

// ---------------------------------------------------------------------------
// Routes — Phase 36: Case Management (tenant-isolated)
// ---------------------------------------------------------------------------

app.use('/api/cases', casesRoutes);

// ---------------------------------------------------------------------------
// Routes — Phase 39: Billing + Subscription Lifecycle
// ---------------------------------------------------------------------------

app.use('/api/billing', billingRoutes);

// ---------------------------------------------------------------------------
// Routes — Phase 42: Admin Monitoring (real data)
// ---------------------------------------------------------------------------

app.use('/api/admin/monitoring', adminMonitoringRoutes);

// ---------------------------------------------------------------------------
// Routes — Phase 43: Beta User Controls
// ---------------------------------------------------------------------------

app.use('/api/admin/beta', betaControlsRoutes);

// ---------------------------------------------------------------------------
// Routes — Phase 44: Deployment Readiness
// ---------------------------------------------------------------------------

app.use('/api/admin/deployment', deploymentReadinessRoutes);

// ---------------------------------------------------------------------------
// Routes — Phases 101-105: System Tests, Backup, Beta Access, Readiness
// ---------------------------------------------------------------------------

app.use('/api/admin/system-test', systemTestRoutes);
app.use('/api/admin/backup-test', backupRecoveryRoutes);
app.use('/api/admin/beta-access', betaAccessControlRoutes);
app.use('/api/admin/beta-readiness', betaReadinessRoutes);

// ---------------------------------------------------------------------------
// Routes — Phase 116: Monitoring & Alerting
// ---------------------------------------------------------------------------

app.use('/api/admin/alerts', alertRoutes);

// ---------------------------------------------------------------------------
// Routes — Phase 120: Beta Feedback Collection
// ---------------------------------------------------------------------------

app.use('/api/feedback', betaFeedbackRoutes);

// ---------------------------------------------------------------------------
// Routes — Phase 121: Bug Tracking
// ---------------------------------------------------------------------------

app.use('/api/admin/bugs', bugTrackingRoutes);

// ---------------------------------------------------------------------------
// Routes — Phase 122: Weekly Health Reports
// ---------------------------------------------------------------------------

app.use('/api/admin/health-report', healthReportRoutes);

// Phase 100: Worker status endpoint
app.get('/api/admin/worker-status', authenticate, requireRole('admin'), (_req, res) => {
  const statuses = getWorkerStatuses();
  res.json({ workers: statuses, timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Routes — Admin Monitoring (legacy)
// ---------------------------------------------------------------------------

app.get('/api/admin/reminder-status', authenticate, requireRole('admin'), async (_req, res) => {
  try {
    const status = await getReminderStatus();
    res.json(status);
  } catch (err) {
    console.error('[Admin] reminder-status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch reminder status' });
  }
});

// Manual scheduler trigger (for testing / recovery)
app.post('/api/admin/run-scheduler', authenticate, requireRole('admin'), async (_req, res) => {
  try {
    const result = await runSchedulerPass();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Admin] run-scheduler error:', err.message);
    res.status(500).json({ error: 'Failed to run scheduler' });
  }
});

// ---------------------------------------------------------------------------
// Health Check + System Status
// ---------------------------------------------------------------------------

app.get('/api/health', async (_req, res) => {
  const redisConnected = isRedisAvailable();
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
// Error Handling (Phase 42: persistent error logging)
// ---------------------------------------------------------------------------

app.use(sentryErrorHandler());

// Log API errors to database
app.use((err, req, res, next) => {
  logApiError(err, req).catch(() => {});
  if (!res.headersSent) {
    res.status(err.statusCode || 500).json({ error: config.nodeEnv === 'production' ? 'Internal server error' : (err.message || 'Internal server error') });
  }
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

const PORT = config.port || 3001;

// Phase 44: Run startup deployment readiness checks
runStartupChecks();

// Phase 116: Initialize alert rules and crash handlers
initAlertRules();
installCrashHandlers();

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
  console.log(`  - SES Email: ${config.sesAccessKeyId ? 'configured' : 'MISSING'} (sandbox: ${config.emailSandboxMode})`);
  console.log(`  - Auth: JWT (${config.jwtSecret ? 'configured' : 'MISSING'})`);
  console.log(`  - Database: ${config.databaseUrl ? 'configured' : 'MISSING'}`);
  console.log(`  - Email Sandbox: ${config.emailSandboxMode ? 'ON' : 'OFF'}`);
  console.log(`  - Hearing Scheduler: running (hourly)`);
  console.log(`  - Agency Intelligence: active`);
  console.log(`  - Records Request System: active`);
  console.log('');
});

// Phase 100: Register workers with heartbeat monitor
registerWorker(
  'evidence-processor',
  () => startProcessingWorker(),
  () => stopProcessingWorker()
);

registerWorker(
  'hearing-scheduler',
  () => { initScheduler(); return true; },
  () => { stopScheduler(); return true; }
);

// Start all registered workers
await startWorker('evidence-processor').then(ok => {
  console.log(`[Court Access] Evidence processing worker ${ok ? 'started' : 'not started (Redis unavailable)'}`);
});

await startWorker('hearing-scheduler').then(ok => {
  console.log(`[Court Access] Hearing scheduler ${ok ? 'started' : 'not started'}`);
});

// Start worker health checker
startHealthChecker();
console.log('[Court Access] Worker health monitor active');

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal) {
  console.log(`\n[Court Access] Received ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    await stopAllWorkers();
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
