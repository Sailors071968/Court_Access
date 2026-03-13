// ============================================================================
// Timeline Reconstruction Engine — Route Stubs
// Placeholder until full timeline pipeline is deployed to this branch.
// ============================================================================

import type { FastifyInstance } from 'fastify';

export async function registerTimelineRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/timeline/:caseId — Timeline summary
  app.get('/api/timeline/:caseId', async (request, reply) => {
    const { caseId } = request.params as { caseId: string };
    return { caseId, events: [], conflicts: [], status: 'pending' };
  });

  // GET /api/timeline/:caseId/events — Timeline events
  app.get('/api/timeline/:caseId/events', async (request, reply) => {
    const { caseId } = request.params as { caseId: string };
    return { caseId, events: [] };
  });

  // GET /api/timeline/:caseId/conflicts — Timeline conflicts
  app.get('/api/timeline/:caseId/conflicts', async (request, reply) => {
    const { caseId } = request.params as { caseId: string };
    return { caseId, conflicts: [] };
  });

  // POST /api/timeline/rebuild/:caseId — Trigger rebuild
  app.post('/api/timeline/rebuild/:caseId', async (request, reply) => {
    const { caseId } = request.params as { caseId: string };
    return { caseId, status: 'queued', message: 'Timeline reconstruction queued' };
  });

  // GET /api/timeline/health — Timeline engine health
  app.get('/api/timeline/health', async () => ({
    status: 'ok',
    engine: 'timeline-reconstruction',
    workers: 0,
    message: 'Stub — full pipeline not yet deployed',
  }));

  console.log('[Server] Timeline routes registered (stub mode)');
}
