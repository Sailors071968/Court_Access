// ============================================================================
// Phase 81 — Policy Intelligence Server Entry Point
// Creates Fastify server, registers all route handlers, starts listening.
// Usage: npx tsx backend/src/server.ts
// ============================================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerPipelineRoutes } from './policy/pipeline/pipelineRoutes.js';
import { registerPolicyIntelligenceRoutes } from './policy/pipeline/policyIntelligenceRoutes.js';

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
  });

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
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

startServer();
