// ============================================================================
// Phase 81 — Policy Intelligence Server Entry Point
// Phase 191-197 — Production Security Hardening
// Creates Fastify server, registers all route handlers, starts listening.
// Usage: npx tsx backend/src/server.ts
// ============================================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { registerPipelineRoutes } from './policy/pipeline/pipelineRoutes.js';
import { registerPolicyIntelligenceRoutes } from './policy/pipeline/policyIntelligenceRoutes.js';
import { registerOperationsConsoleRoutes } from './policy/pipeline/operationsConsoleRoutes.js';
import { registerComplianceRoutes } from './evidence/complianceRoutes.js';
import { registerForensicRoutes } from './evidence/forensicReconstructionRoutes.js';
import { authenticationHook, registerAuthRoutes } from './security/authMiddleware.js';
import { rateLimitHook, registerRateLimitRoutes } from './security/rateLimiter.js';
import { csrfProtectionHook, getCsrfTokenRoute } from './security/csrfProtection.js';
import { securityHeadersHook } from './security/securityHeaders.js';
import { uploadProtectionHook } from './security/evidenceUploadProtection.js';
import { registerSecurityLogging } from './security/securityLogger.js';
import { registerContradictionRoutes } from './contradiction/index.ts';
import { registerPolicyMatrixRoutes } from './cpra/policyMatrixRoutes.js';
import { registerAutonomousCpraRoutes } from './cpra/autonomousCpraRoutes.js';
import { registerBillingRoutes } from './billing/billingRoutes.js';
import { registerCaseRoutes } from './evidence/caseRoutes.js';
import { registerEvidenceRoutes } from './evidence/evidenceRoutes.js';
import { registerNarrativeRoutes } from './narrative/narrativeRoutes.js';
import { registerTimelineRoutes } from './timeline/timelineRoutes.js';
import { registerQueueMonitorRoutes } from './admin/queueMonitorRoutes.js';
import { registerAdminRoutes } from './admin/adminRoutes.js';
import { registerDiscountRoutes } from './billing/discountRoutes.js';
import { seedDefaultDiscountCodes } from './billing/discountSeed.js';
import { registerStripeWebhookRoutes } from './billing/stripeWebhookHandler.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  const app = Fastify({
    logger: true,
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // CORS — production domains + local dev
  const CORS_ORIGINS = process.env.NODE_ENV === 'production'
    ? [
        'https://courtaccess.net',
        'https://www.courtaccess.net',
        'https://beta.courtaccess.net',
      ]
    : [
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:3000',
      ];

  // Allow FRONTEND_URL override
  if (process.env.FRONTEND_URL && !CORS_ORIGINS.includes(process.env.FRONTEND_URL)) {
    CORS_ORIGINS.push(process.env.FRONTEND_URL);
  }

  await app.register(cors, {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // Cookie support (required for CSRF, refresh tokens)
  if (!process.env.COOKIE_SECRET && process.env.NODE_ENV === 'production') {
    console.warn('[Server] WARNING: COOKIE_SECRET not set in production! Using insecure hardcoded fallback. Set COOKIE_SECRET env var immediately.');
  }
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'court-access-cookie-secret-change-in-production',
  });

  // Phase 194 — Security headers (applied to all responses)
  app.addHook('onRequest', securityHeadersHook);

  // Phase 192 — Rate limiting (applied before auth)
  app.addHook('onRequest', rateLimitHook);

  // Phase 191 — Authentication (JWT verification + RBAC)
  app.addHook('onRequest', authenticationHook);

  // Phase 193 — CSRF protection (after auth, before route handlers)
  app.addHook('onRequest', csrfProtectionHook);

  // Phase 195 — Evidence upload protection
  app.addHook('onRequest', uploadProtectionHook);

  // Phase 197 — Security logging (response tracking)
  await registerSecurityLogging(app);

  // Health check
  app.get('/api/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.1.0',
    service: 'court-access-backend',
    environment: process.env.NODE_ENV || 'development',
  }));

  // Register route modules
  console.log('[Server] Registering pipeline routes...');
  await registerPipelineRoutes(app);

  console.log('[Server] Registering policy intelligence routes...');
  await registerPolicyIntelligenceRoutes(app);

  console.log('[Server] Registering operations console routes...');
  await registerOperationsConsoleRoutes(app);

  console.log('[Server] Registering compliance analysis routes...');
  await registerComplianceRoutes(app);

  console.log('[Server] Registering forensic reconstruction routes...');
  await registerForensicRoutes(app);

  // Phase 191 — Auth routes (login, register, refresh, logout)
  console.log('[Server] Registering authentication routes...');
  await registerAuthRoutes(app);

  // Phase 192 — Rate limit admin routes
  console.log('[Server] Registering rate limit admin routes...');
  await registerRateLimitRoutes(app);

  // Phase 193 — CSRF token endpoint
  app.get('/api/auth/csrf-token', getCsrfTokenRoute());

  // Contradiction Detection Engine routes
  console.log('[Server] Registering contradiction detection engine routes...');
  registerContradictionRoutes(app);

  // CPRA Policy Matrix routes
  console.log('[Server] Registering CPRA policy matrix routes...');
  await registerPolicyMatrixRoutes(app);

  // Autonomous CPRA System routes
  console.log('[Server] Registering autonomous CPRA system routes...');
  await registerAutonomousCpraRoutes(app);

  // Billing, subscriptions, AI credits, usage enforcement routes
  console.log('[Server] Registering billing & usage routes...');
  await registerBillingRoutes(app);

  // Core Evidence System — Case Management + Evidence Upload
  console.log('[Server] Registering case management routes...');
  await registerCaseRoutes(app);

  console.log('[Server] Registering evidence routes...');
  await registerEvidenceRoutes(app);

  // Narrative Deconstruction Engine routes
  console.log('[Server] Registering narrative deconstruction engine routes...');
  await registerNarrativeRoutes(app);

  // Timeline Reconstruction Engine
  console.log('[Server] Registering timeline reconstruction routes...');
  await registerTimelineRoutes(app);

  // Admin queue monitoring
  console.log('[Server] Registering admin queue monitoring routes...');
  await registerQueueMonitorRoutes(app);

  // Admin management routes (stats, users, cases, delete endpoints)
  console.log('[Server] Registering admin management routes...');
  await registerAdminRoutes(app);

  // Stripe Checkout & Webhook routes
  console.log('[Server] Registering Stripe webhook routes...');
  await registerStripeWebhookRoutes(app);

  // Discount code API routes
  console.log('[Server] Registering discount code routes...');
  await registerDiscountRoutes(app);

  // Seed default discount codes (e.g. HUNT100)
  await seedDefaultDiscountCodes();
  // Start server
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[Server] CourtAccess API running on http://${HOST}:${PORT}`);
    console.log('[Server] Routes registered:');
    console.log('  - GET  /api/health');
    console.log('  - GET  /api/policy-pipeline/stats');
    console.log('  - GET  /api/policy-pipeline/agencies');
    console.log('  - POST /api/policy-intelligence/sandbox/crawl');
    console.log('  - POST /api/policy-intelligence/chp/import');
    console.log('  - GET  /api/policy-intelligence/classification/validate');
    console.log('  - POST /api/policy-intelligence/coverage/generate');
    console.log('  - POST /api/policy-intelligence/cpra/prepare-queue');
    console.log('  - POST /api/policy-intelligence/cpra/launch-campaign');
    console.log('  - POST /api/policy-intelligence/responses/process');
    console.log('  - GET  /api/policy-intelligence/dashboard');
    console.log('  - GET  /api/operations/dashboard');
    console.log('  - GET  /api/operations/deadlines');
    console.log('  - GET  /api/operations/topics');
    console.log('  - GET  /api/operations/topics/:agencyId');
    console.log('  - POST /api/operations/report');
    console.log('  - POST /api/operations/populate');
    console.log('  - GET  /api/compliance/dashboard');
    console.log('  - POST /api/compliance/analyze');
    console.log('  - GET  /api/compliance/timeline/:caseId');
    console.log('  - GET  /api/compliance/heatmap');
    console.log('  - GET  /api/compliance/expert/:caseId');
    console.log('  - GET  /api/compliance/jury/:caseId');
    console.log('  - POST /api/forensic/vision/analyze');
    console.log('  - POST /api/forensic/trajectory/analyze');
    console.log('  - POST /api/forensic/visibility/simulate');
    console.log('  - POST /api/forensic/line-of-sight/analyze');
    console.log('  - POST /api/forensic/camera-sync/synchronize');
    console.log('  - POST /api/forensic/scene/build');
    console.log('  - GET  /api/forensic/timeline/:caseId');
    console.log('  - POST /api/forensic/evidence-graph/build');
    console.log('  - POST /api/forensic/expert-package/generate');
    console.log('  - POST /api/forensic/jury-view/generate');
    console.log('  - POST /api/auth/login');
    console.log('  - POST /api/auth/register');
    console.log('  - POST /api/auth/refresh');
    console.log('  - POST /api/auth/logout');
    console.log('  - GET  /api/auth/me');
    console.log('  - GET  /api/auth/csrf-token');
    console.log('  - GET  /api/security/log');
    console.log('  - GET  /api/security/logs');
    console.log('  - GET  /api/security/summary');
    console.log('  - GET  /api/admin/rate-limits');
    console.log('  - GET  /api/contradiction/status');
    console.log('  - GET  /api/contradiction/ontology');
    console.log('  - POST /api/contradiction/extract');
    console.log('  - POST /api/contradiction/analyze/:caseId');
    console.log('  - GET  /api/contradiction/graph/:caseId');
    console.log('  - GET  /api/contradiction/recommendations/:caseId');
    console.log('  - POST /api/cases');
    console.log('  - GET  /api/cases');
    console.log('  - GET  /api/cases/:caseId');
    console.log('  - PATCH /api/cases/:caseId');
    console.log('  - DELETE /api/cases/:caseId');
    console.log('  - POST /api/evidence/upload-url');
    console.log('  - POST /api/evidence');
    console.log('  - GET  /api/cases/:caseId/evidence');
    console.log('  - GET  /api/evidence/:evidenceId');
    console.log('  - DELETE /api/evidence/:evidenceId');
    console.log('  - GET  /api/timeline/:caseId');
    console.log('  - GET  /api/timeline/:caseId/events');
    console.log('  - GET  /api/timeline/:caseId/conflicts');
    console.log('  - POST /api/timeline/rebuild/:caseId');
    console.log('  - GET  /api/timeline/health');
    console.log('  - GET  /api/admin/queues');
    console.log('  - GET  /api/discount-codes/validate');
    console.log('  - POST /api/discount-codes/apply');
    console.log('  - GET  /api/admin/discount-codes');
    console.log('  - POST /api/admin/discount-codes');
    console.log('  - PATCH /api/admin/discount-codes/:codeId');
    console.log('  - DELETE /api/admin/discount-codes/:codeId');
    console.log('  - GET  /api/admin/stats');
    console.log('  - GET  /api/admin/users');
    console.log('  - GET  /api/admin/cases');
    console.log('  - DELETE /api/admin/users/:userId');
    console.log('  - DELETE /api/admin/cases/:caseId');
    console.log('  - DELETE /api/admin/evidence/:evidenceId');
    console.log('[Server] Security hardening active: JWT auth, rate limiting, CSRF, security headers, upload protection, security logging');
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

startServer();
