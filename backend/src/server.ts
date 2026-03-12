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
import { registerLegalResearchRoutes } from './services/legalResearchRoutes.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  const app = Fastify({
    logger: true,
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // CORS for frontend dev server
  await app.register(cors, {
    origin: ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // Cookie support (required for CSRF, refresh tokens)
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
    version: '1.0.0',
    service: 'court-access-backend',
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

  // Phases 293-300 — Legal Research (CourtListener integration)
  console.log('[Server] Registering legal research routes...');
  await registerLegalResearchRoutes(app);

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
    console.log('  - GET  /api/legal-research/status');
    console.log('  - GET  /api/legal-research/search');
    console.log('  - GET  /api/legal-research/opinions');
    console.log('  - GET  /api/legal-research/motion-precedent');
    console.log('  - GET  /api/legal-research/case-intelligence/:caseId');
    console.log('  - GET  /api/legal-research/judge/:judgeName');
    console.log('  - GET  /api/legal-research/citation-graph/:opinionId');
    console.log('  - GET  /api/legal-research/cache/stats');
    console.log('  - POST /api/legal-research/cache/clear');
    console.log('[Server] Security hardening active: JWT auth, rate limiting, CSRF, security headers, upload protection, security logging');
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

startServer();
