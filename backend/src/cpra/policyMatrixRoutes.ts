// ============================================================================
// CourtAccess — CPRA Policy Matrix Routes (Fastify)
// Route handlers for the agency × topic policy status matrix.
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getAllTopics,
  getAllAgencies,
  getFullMatrix,
  getMatrixForAgency,
  upsertMatrixEntry,
  getMatrixSummary,
  seedSampleAgencies,
  initializeMatrix,
  type PolicyMatrixStatus,
  type MatrixFilterOptions,
} from './services/cpraMatrixService.js';

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerPolicyMatrixRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/cpra/policy-matrix/topics — list all policy topics
  app.get('/api/cpra/policy-matrix/topics', async (_req: FastifyRequest, reply: FastifyReply) => {
    const topics = getAllTopics();
    return reply.send({ topics, total: topics.length });
  });

  // GET /api/cpra/policy-matrix/agencies — list all tracked agencies
  app.get('/api/cpra/policy-matrix/agencies', async (_req: FastifyRequest, reply: FastifyReply) => {
    const agencies = getAllAgencies();
    return reply.send({ agencies, total: agencies.length });
  });

  // GET /api/cpra/policy-matrix — get the full matrix (with optional filters)
  app.get('/api/cpra/policy-matrix', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as Record<string, string | undefined>;
    const filters: MatrixFilterOptions = {};
    if (query.state) filters.state = query.state;
    if (query.agencyId) filters.agencyId = query.agencyId;
    if (query.topicId) filters.topicId = query.topicId;
    if (query.status) filters.status = query.status as PolicyMatrixStatus;

    const entries = getFullMatrix(filters);
    return reply.send({ entries, total: entries.length, filters });
  });

  // GET /api/cpra/policy-matrix/:agencyId — get matrix entries for a specific agency
  app.get('/api/cpra/policy-matrix/:agencyId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { agencyId } = req.params as { agencyId: string };
    const entries = getMatrixForAgency(agencyId);
    return reply.send({ agencyId, entries, total: entries.length });
  });

  // PUT /api/cpra/policy-matrix/:agencyId/:topicId — update a matrix cell status
  app.put('/api/cpra/policy-matrix/:agencyId/:topicId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { agencyId, topicId } = req.params as { agencyId: string; topicId: string };
    const body = req.body as {
      status?: PolicyMatrixStatus;
      fileUrl?: string;
      notes?: string;
    };

    const entry = upsertMatrixEntry(agencyId, topicId, {
      status: body.status,
      fileUrl: body.fileUrl,
      notes: body.notes,
    });

    return reply.send({ entry });
  });

  // GET /api/cpra/policy-matrix/summary — get matrix summary statistics
  app.get('/api/cpra/policy-matrix/summary', async (_req: FastifyRequest, reply: FastifyReply) => {
    const summary = getMatrixSummary();
    return reply.send({ summary });
  });

  // POST /api/cpra/policy-matrix/seed — seed sample agencies and initialize matrix
  app.post('/api/cpra/policy-matrix/seed', async (_req: FastifyRequest, reply: FastifyReply) => {
    const agencies = seedSampleAgencies();
    const result = initializeMatrix();
    return reply.send({
      message: 'CPRA policy matrix seeded successfully',
      agenciesSeeded: agencies.length,
      matrixInitialized: result,
    });
  });
}
