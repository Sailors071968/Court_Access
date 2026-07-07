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
import { registerClientRoutes } from './clients/clientRoutes.js';
import { registerEvidenceRoutes } from './evidence/evidenceRoutes.js';
import { registerDirectUploadRoutes } from './evidence/evidenceDirectUpload.js';
import { registerEvidenceRequestRoutes } from './evidence/evidenceRequestRoutes.js';
import { registerIntelligenceRoutes, registerNarrativeIntelligenceRoutes } from './intelligence/intelligenceRoutes.js';
import { registerWorkbenchRoutes } from './workbench/workbenchRoutes.js';
import { registerInvestigatorRoutes } from './investigator/investigatorRoutes.js';
import { registerTimelineRoutes } from './timeline/timelineRoutes.js';
import { registerQueueMonitorRoutes } from './admin/queueMonitorRoutes.js';
import { registerAdminRoutes } from './admin/adminRoutes.js';
import { registerDiscountRoutes } from './billing/discountRoutes.js';
import { seedDefaultDiscountCodes } from './billing/discountSeed.js';
import { startExpirationWorker } from './workers/discountExpirationWorker.js';
import { registerStripeWebhookRoutes } from './billing/stripeWebhookHandler.js';
import { startPipelineWorkers, stopPipelineWorkers } from './workers/startPipelineWorkers.js';
import { enforceSchemaOnBoot } from './database/schemaAssert.js';
import { registerObservabilityRoutes } from './observability/observabilityRoutes.js';
import { startRedisMemoryMonitor, stopRedisMemoryMonitor } from './observability/redisMemoryAlert.js';
import { registerChargeRoutes } from "./charges/chargeRoutes.js";
import { registerCalcrimRoutes } from "./routes/calcrimRoutes.js";
import { registerGovernanceRoutes } from './governance/governanceRoutes.ts';
import { registerLegislativeRoutes } from './legislative/legislativeRoutes.ts';
import { registerDoctrineRoutes } from './doctrine/doctrineRoutes.ts';
import { registerProductionGatesRoutes } from './productionGates/productionGatesRoutes.js';
import { registerProductionOperationsRoutes } from './productionOperations/productionOperationsRoutes.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  // PR 1 — Hard-fail if schema is drifted or migrations are pending
  await enforceSchemaOnBoot();
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

  // Phase 193 — CSRF protection (Bearer-authenticated API requests bypass CSRF)
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
  const { registerIdentityRoutes } = await import('./security/identityRoutes.js');
  await registerIdentityRoutes(app);

  // Program 0 — Public contact form
  const { registerContactRoutes } = await import('./marketing/contactRoutes.js');
  await registerContactRoutes(app);

  const { registerMembershipRoutes } = await import('./membership/membershipRoutes.js');
  await registerMembershipRoutes(app);

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

  console.log('[Server] Registering client management routes...');
  await registerClientRoutes(app);

  console.log('[Server] Registering organization routes (Program 2)...');
  const { registerOrganizationRoutes } = await import('./organizations/organizationRoutes.js');
  await registerOrganizationRoutes(app);
  const { registerFirmPlatformRoutes } = await import('./organizations/firmPlatformRoutes.js');
  await registerFirmPlatformRoutes(app);

  console.log('[Server] Registering communications routes (messaging, hearings)...');
  const { registerMessagingRoutes } = await import('./communications/messagingRoutes.js');
  const { registerHearingRoutes } = await import('./communications/hearingRoutes.js');
  await registerMessagingRoutes(app);
  await registerHearingRoutes(app);

  console.log('[Server] Registering direct evidence upload routes...');
  await registerDirectUploadRoutes(app);

  console.log('[Server] Registering evidence routes...');
  await registerEvidenceRoutes(app);

  // Evidence Gap Detection — AI evidence requests
  console.log('[Server] Registering evidence request routes...');
  await registerEvidenceRequestRoutes(app);

  // Narrative Deconstruction Engine routes
  console.log('[Server] Registering Attorney Intelligence routes...');
  await registerIntelligenceRoutes(app);
  await registerNarrativeIntelligenceRoutes(app);

  console.log('[Server] Registering Attorney Workbench routes...');
  await registerWorkbenchRoutes(app);

  // Program 115 — Unified Case Search (evidence-governed, permission-scoped)
  console.log('[Server] Registering unified search routes...');
  const { registerSearchRoutes } = await import('./search/searchRoutes.js');
  await registerSearchRoutes(app);

  // Program 108/118 — Evidence-governed Litigation Assistant (AI Safety Envelope)
  console.log('[Server] Registering litigation assistant routes...');
  const { registerLitigationAssistantRoutes } = await import('./assistant/litigationAssistantRoutes.js');
  await registerLitigationAssistantRoutes(app);

  // Phase 4A — Canonical connection of reachable case views (litigation strategy, trial exhibits)
  console.log('[Server] Registering case view routes...');
  const { registerCaseViewRoutes } = await import('./workbench/caseViewRoutes.js');
  await registerCaseViewRoutes(app);

  // CourtListener — external case-law / authority / citation integration
  console.log('[Server] Registering CourtListener routes...');
  const { registerCourtListenerRoutes } = await import('./courtlistener/courtListenerRoutes.js');
  await registerCourtListenerRoutes(app);

  // Legal Intelligence Provider Layer — canonical provider registry + federated search
  console.log('[Server] Registering Legal Intelligence provider routes...');
  const { registerProviderRoutes } = await import('./providers/providerRoutes.js');
  await registerProviderRoutes(app);

  // Master Program 8 — Case Knowledge Graph
  console.log('[Server] Registering knowledge graph routes...');
  const { registerKnowledgeGraphRoutes } = await import('./graph/knowledgeGraphRoutes.js');
  await registerKnowledgeGraphRoutes(app);

  console.log('[Server] Registering Investigator Workbench routes...');
  await registerInvestigatorRoutes(app);

  // Timeline Reconstruction Engine
  console.log('[Server] Registering timeline reconstruction routes...');
  await registerTimelineRoutes(app);

  console.log('[Server] Registering charge routes...');
  await registerChargeRoutes(app);

  console.log('[Server] Registering CALCRIM routes...');
  await registerCalcrimRoutes(app);

  console.log('[Server] Registering admin queue monitoring routes...');
  await registerQueueMonitorRoutes(app);

  // Admin management routes (stats, users, cases, delete endpoints)
  console.log('[Server] Registering admin management routes...');
  await registerAdminRoutes(app);

  console.log('[Server] Registering production gates routes...');
  await registerProductionGatesRoutes(app);

  console.log('[Server] Registering production operations routes...');
  await registerProductionOperationsRoutes(app);

  // Stripe Checkout & Webhook routes
  console.log('[Server] Registering Stripe webhook routes...');
  await registerStripeWebhookRoutes(app);

  // Discount code API routes
  console.log('[Server] Registering discount code routes...');
  await registerDiscountRoutes(app);

  // Epic 2A — Corpus governance + legislative intelligence APIs
  console.log('[Server] Registering corpus governance routes...');
  await registerGovernanceRoutes(app);

  console.log('[Server] Registering legislative intelligence routes...');
  await registerLegislativeRoutes(app);

  console.log('[Server] Registering doctrine intelligence routes...');
  registerDoctrineRoutes(app);

  // PR 6 — Observability: /api/health/deep, /api/metrics, /api/metrics/json
  console.log('[Server] Registering observability routes...');
  await registerObservabilityRoutes(app);

  // Seed default discount codes (e.g. HUNT100)
  await seedDefaultDiscountCodes();
  startExpirationWorker();

  // Start Phase 2 ACU-enforced pipeline workers (BullMQ)
  startPipelineWorkers();

  // Scale Validation — Redis memory alert monitor
  startRedisMemoryMonitor();

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
    console.log('  - POST /api/evidence/upload (direct multipart)');
    console.log('  - POST /api/evidence/upload-url');
    console.log('  - POST /api/evidence');
    console.log('  - GET  /api/cases/:caseId/evidence');
    console.log('  - GET  /api/evidence/:evidenceId');
    console.log('  - DELETE /api/evidence/:evidenceId');
    console.log('  - GET  /api/cases/:caseId/evidence-requests');
    console.log('  - POST /api/evidence-requests/:id/respond');
    console.log('  - POST /api/cases/:caseId/evidence-requests/detect');
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

// Graceful shutdown — stop pipeline workers before exit
const shutdown = async (signal: string) => {
  console.log(`[Server] Received ${signal}, shutting down pipeline workers...`);
  stopRedisMemoryMonitor();
  await stopPipelineWorkers();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
