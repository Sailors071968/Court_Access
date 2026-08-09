// ============================================================================
// Administrative routes for the New Inmate Intelligence System.
//
// Permission model: administrator only, enforced here, on every route.
//
// The gate is a second one — independent of whatever the route map or a global
// hook does — following the pattern in certification/certificationRoutes.ts. Two
// gates because this subsystem holds personal data about people who have not been
// convicted of anything, and a change to a shared hook should not be able to
// expose it. Hiding the routes in the SPA is not access control and is not
// treated as any part of this.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';

import type { AuthenticatedRequest } from '../../security/authMiddleware.js';
import { recordAccess } from './auditLog.js';
import { runIngestion } from './ingestionEngine.js';
import { listColumnMaps } from './parsers/columnMaps.js';
import {
  getAliases, getArrestTimeline, getBatchIssues, getInmate, getNewInmates,
  getReviewQueue, listBatches, searchInmates,
} from './repository.js';

/** Every route in this module passes through here first. */
function requireAdministrator(request: AuthenticatedRequest, reply: FastifyReply): boolean {
  const user = request.user;
  if (!user) {
    void reply.code(401).send({ error: 'Authentication required' });
    return false;
  }
  if (user.role !== 'admin') {
    void reply.code(403).send({
      error: 'Forbidden',
      message: 'The Inmate Intelligence System is available to administrators only.',
    });
    return false;
  }
  return true;
}

const clampLimit = (value: unknown, fallback = 50, max = 500): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback;
};
const offsetOf = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

export async function registerInmateIntelligenceRoutes(app: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // Overview
  // -------------------------------------------------------------------------
  app.get('/api/admin/intelligence/overview', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const [batches, review, newInmates] = await Promise.all([
      listBatches(5, 0),
      getReviewQueue(1, 0),
      getNewInmates({ limit: 1, offset: 0 }),
    ]);

    return reply.send({
      recentBatches: batches.results,
      batchTotal: batches.total,
      awaitingReview: review.total,
      newInmatesTotal: newInmates.total,
      facilities: listColumnMaps(),
    });
  });

  // -------------------------------------------------------------------------
  // Newly discovered inmates — the primary output
  // -------------------------------------------------------------------------
  app.get('/api/admin/intelligence/new-inmates', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const q = request.query as Record<string, string>;
    const params = {
      from: q.from, to: q.to, facility: q.facility,
      limit: clampLimit(q.limit), offset: offsetOf(q.offset),
    };
    const result = await getNewInmates(params);

    await recordAccess({
      userId: request.user!.userId,
      action: 'list_new_inmates',
      parameters: params,
      resultCount: result.total,
      ipAddress: request.ip,
    });

    return reply.send(result);
  });

  // -------------------------------------------------------------------------
  // One person
  // -------------------------------------------------------------------------
  app.get('/api/admin/intelligence/inmates/:inmateId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const { inmateId } = request.params as { inmateId: string };
    const inmate = await getInmate(inmateId);
    if (!inmate) return reply.code(404).send({ error: 'Not found' });

    const aliases = await getAliases(inmateId);

    await recordAccess({
      userId: request.user!.userId,
      action: 'view_inmate',
      inmateId,
      ipAddress: request.ip,
    });

    return reply.send({ inmate, aliases });
  });

  app.get('/api/admin/intelligence/inmates/:inmateId/timeline', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const { inmateId } = request.params as { inmateId: string };
    const inmate = await getInmate(inmateId);
    if (!inmate) return reply.code(404).send({ error: 'Not found' });

    const timeline = await getArrestTimeline(inmateId);

    await recordAccess({
      userId: request.user!.userId,
      action: 'view_timeline',
      inmateId,
      resultCount: timeline.length,
      ipAddress: request.ip,
    });

    return reply.send({ inmate, timeline });
  });

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------
  app.get('/api/admin/intelligence/search', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const q = request.query as Record<string, string>;
    const params = {
      name: q.name, dateOfBirth: q.dob, facility: q.facility,
      limit: clampLimit(q.limit), offset: offsetOf(q.offset),
    };
    const result = await searchInmates(params);

    await recordAccess({
      userId: request.user!.userId,
      action: 'search',
      parameters: params,
      resultCount: result.total,
      ipAddress: request.ip,
    });

    return reply.send(result);
  });

  // -------------------------------------------------------------------------
  // Ingestion
  // -------------------------------------------------------------------------
  app.get('/api/admin/intelligence/batches', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const q = request.query as Record<string, string>;
    return reply.send(await listBatches(clampLimit(q.limit, 25, 200), offsetOf(q.offset)));
  });

  app.get('/api/admin/intelligence/batches/:batchId/issues', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { batchId } = request.params as { batchId: string };
    return reply.send({ issues: await getBatchIssues(batchId) });
  });

  /**
   * Manual run — one of the triggers, not the engine.
   *
   * This handler builds an IngestionRequest and calls runIngestion. It contains
   * no parsing, normalization, resolution or persistence, which is what keeps the
   * scheduling decision open: a queue worker later is another adapter like this
   * one.
   *
   * `dryRun` defaults to true. An import that writes to the repository should be
   * something an administrator asked for explicitly, having read the dry run.
   */
  app.post('/api/admin/intelligence/ingest', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const body = (request.body ?? {}) as { filePath?: string; facility?: string; dryRun?: boolean; rosterDate?: string };
    if (!body.filePath || !body.facility) {
      return reply.code(400).send({ error: 'Bad request', message: 'filePath and facility are required.' });
    }

    const outcome = await runIngestion({
      filePath: body.filePath,
      facility: body.facility,
      trigger: 'manual',
      dryRun: body.dryRun !== false,
      rosterDate: body.rosterDate,
      userId: request.user!.userId,
    });

    await recordAccess({
      userId: request.user!.userId,
      action: 'ingest',
      batchId: outcome.batchId ?? undefined,
      parameters: { facility: body.facility, filePath: body.filePath, dryRun: outcome.dryRun },
      resultCount: outcome.counts.total,
      ipAddress: request.ip,
    });

    return reply.code(outcome.status === 'failed' ? 422 : 200).send(outcome);
  });

  // -------------------------------------------------------------------------
  // Review queue — rows that must not change the repository unexamined
  // -------------------------------------------------------------------------
  app.get('/api/admin/intelligence/review-queue', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const q = request.query as Record<string, string>;
    const result = await getReviewQueue(clampLimit(q.limit, 25, 200), offsetOf(q.offset));

    await recordAccess({
      userId: request.user!.userId,
      action: 'view_review_queue',
      resultCount: result.total,
      ipAddress: request.ip,
    });

    return reply.send(result);
  });

  console.log('[Server] Inmate intelligence routes registered (administrator only): /api/admin/intelligence/*');
}
