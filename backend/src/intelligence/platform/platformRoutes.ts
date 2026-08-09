// ============================================================================
// The intelligence platform's administrative surface.
//
// Reviewing intelligence rather than raw records is the requirement these routes
// exist to satisfy. A reviewer opens an item and is given the evidence, the
// reasoning, the conflicts, the confidence and a recommendation, already assembled;
// they are never handed a booking id and asked to go and look at the source.
//
// The engine, run and profile routes are the operational half: which engines exist,
// what a reprocessing run would change, and which parser version read which
// document.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';

import prisma from '../../lib/prisma.js';
import type { AuthenticatedRequest } from '../../security/authMiddleware.js';
import { recordAccess } from '../inmates/auditLog.js';
import { describeEngines } from './engineRegistry.js';
import {
  buildReviewPacket, intelligenceForSubject, queryIntelligence, reviewQueue, setDisposition,
} from './intelligenceRepository.js';
import { batchesByProfile, listProfiles, publishProfile } from './parserProfiles.js';
import { discardRun, getRun, listRuns, promoteRun, startReprocessRun } from './reprocessing.js';
import type { Disposition } from './types.js';

// Importing the engines is what registers them. Without this the registry is empty
// and every reprocessing request would fail with "no engine registered".
import './engines/identityEngine.js';
import './engines/derivedEngines.js';

function requireAdministrator(request: AuthenticatedRequest, reply: FastifyReply): boolean {
  const user = request.user;
  if (!user) {
    void reply.code(401).send({ error: 'Authentication required' });
    return false;
  }
  if (user.role !== 'admin') {
    void reply.code(403).send({
      error: 'Forbidden',
      message: 'The intelligence platform is available to administrators only.',
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

const DISPOSITIONS: ReadonlySet<string> = new Set([
  'accepted', 'rejected', 'deferred',
]);

export async function registerIntelligencePlatformRoutes(app: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // The repository
  // -------------------------------------------------------------------------

  /** Every intelligence item, filterable. The searchable repository. */
  app.get('/api/admin/intelligence/items', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;

    const result = await queryIntelligence({
      engine: q.engine,
      type: q.type,
      severity: q.severity,
      disposition: q.disposition,
      reviewRequired: q.reviewRequired === undefined ? undefined : q.reviewRequired === 'true',
      subjectKind: q.subjectKind,
      subjectId: q.subjectId,
      runId: q.runId,
      minConfidence: q.minConfidence === undefined ? undefined : Number(q.minConfidence),
      limit: clampLimit(q.limit),
      offset: offsetOf(q.offset),
    });

    await recordAccess({
      userId: request.user!.userId,
      action: 'intelligence_query',
      parameters: q,
      resultCount: result.results.length,
      ipAddress: request.ip,
    });
    return reply.send(result);
  });

  /**
   * One item, with everything a reviewer needs.
   *
   * The evidence is resolved here rather than referenced, which is the difference
   * between reviewing intelligence and reconstructing it.
   */
  app.get('/api/admin/intelligence/items/:itemId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { itemId } = request.params as { itemId: string };

    const packet = await buildReviewPacket(itemId);
    if (!packet) {
      return reply.code(404).send({ error: 'Not found', message: 'No such intelligence item.' });
    }

    await recordAccess({
      userId: request.user!.userId,
      action: 'intelligence_view',
      parameters: { itemId, type: packet.type },
      ipAddress: request.ip,
    });
    return reply.send(packet);
  });

  /** Every conclusion ever drawn about one subject, superseded ones included. */
  app.get('/api/admin/intelligence/subject/:kind/:id', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { kind, id } = request.params as { kind: string; id: string };
    const items = await intelligenceForSubject(kind, id);
    return reply.send({ subjectKind: kind, subjectId: id, count: items.length, items });
  });

  // -------------------------------------------------------------------------
  // Review
  // -------------------------------------------------------------------------

  app.get('/api/admin/intelligence/review', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const result = await reviewQueue(clampLimit(q.limit), offsetOf(q.offset));
    return reply.send(result);
  });

  /**
   * Record a reviewer's decision.
   *
   * A rejection requires a note. A conclusion overturned without a stated reason is
   * a decision nobody can audit later, and the reviewer who made it will not
   * remember either.
   */
  app.post('/api/admin/intelligence/items/:itemId/disposition', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { itemId } = request.params as { itemId: string };
    const body = (request.body ?? {}) as { disposition?: string; note?: string };

    if (!body.disposition || !DISPOSITIONS.has(body.disposition)) {
      return reply.code(400).send({
        error: 'Invalid disposition',
        message: `Provide one of: ${[...DISPOSITIONS].join(', ')}.`,
      });
    }
    if (body.disposition === 'rejected' && !body.note?.trim()) {
      return reply.code(400).send({
        error: 'Note required',
        message: 'Rejecting a conclusion requires a reason, so the decision remains auditable.',
      });
    }

    const outcome = await setDisposition({
      itemId,
      to: body.disposition as Disposition,
      actorId: request.user!.userId,
      note: body.note?.trim(),
    });
    if (!outcome.ok) {
      return reply.code(409).send({ error: 'Cannot change disposition', message: outcome.reason });
    }

    await recordAccess({
      userId: request.user!.userId,
      action: 'intelligence_disposition',
      parameters: { itemId, disposition: body.disposition },
      ipAddress: request.ip,
    });
    return reply.send({ itemId, disposition: body.disposition });
  });

  // -------------------------------------------------------------------------
  // Engines
  // -------------------------------------------------------------------------

  app.get('/api/admin/intelligence/engines', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const engines = describeEngines();
    // Counts per engine, so an operator can see which engines are actually
    // producing and which have been registered but never ran.
    const counts = await prisma.inmateIntelligenceItem.groupBy({
      by: ['engine', 'engineVersion'],
      _count: { itemId: true },
    });
    const countFor = (name: string) =>
      counts.filter((c) => c.engine === name).map((c) => ({ version: c.engineVersion, items: c._count.itemId }));

    return reply.send({
      engines: engines.map((e) => ({ ...e, produced: countFor(e.name) })),
    });
  });

  // -------------------------------------------------------------------------
  // Reprocessing
  // -------------------------------------------------------------------------

  app.get('/api/admin/intelligence/runs', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const runs = await listRuns(clampLimit((request.query as Record<string, string>).limit));
    return reply.send({ runs });
  });

  app.get('/api/admin/intelligence/runs/:runId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { runId } = request.params as { runId: string };
    const run = await getRun(runId);
    if (!run) return reply.code(404).send({ error: 'Not found', message: 'No such run.' });
    return reply.send(run);
  });

  /**
   * Replay observations through an engine.
   *
   * Defaults to a dry run. A reprocessing request that persists by default would
   * make it easy to fill the repository with findings from an algorithm nobody has
   * evaluated yet, so persisting is the deliberate choice.
   */
  app.post('/api/admin/intelligence/reprocess', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const body = (request.body ?? {}) as {
      engine?: string;
      facility?: string; from?: string; to?: string; batchId?: string;
      maxObservations?: number; persist?: boolean;
    };

    if (!body.engine) {
      return reply.code(400).send({
        error: 'Engine required',
        message: `Name the engine to replay. Registered: ${describeEngines().map((e) => e.name).join(', ')}.`,
      });
    }

    const result = await startReprocessRun({
      engineName: body.engine,
      mode: body.persist === true ? 'reprocess' : 'dry_run',
      scope: {
        facility: body.facility,
        from: body.from,
        to: body.to,
        batchId: body.batchId,
        maxObservations: body.maxObservations,
      },
      triggeredById: request.user!.userId,
    });

    if ('error' in result) {
      return reply.code(400).send({ error: 'Reprocessing failed', message: result.error });
    }

    const run = await getRun(result.runId);
    await recordAccess({
      userId: request.user!.userId,
      action: 'intelligence_reprocess',
      parameters: { engine: body.engine, persist: body.persist === true },
      ipAddress: request.ip,
    });
    return reply.send({ runId: result.runId, run });
  });

  /** Put a run's findings in force, superseding the ones they replace. */
  app.post('/api/admin/intelligence/runs/:runId/promote', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { runId } = request.params as { runId: string };

    const outcome = await promoteRun({ runId, actorId: request.user!.userId });
    if (!outcome.ok) {
      return reply.code(409).send({ error: 'Cannot promote', message: outcome.reason });
    }
    await recordAccess({
      userId: request.user!.userId,
      action: 'intelligence_promote',
      parameters: { runId, superseded: outcome.superseded, promoted: outcome.promoted },
      ipAddress: request.ip,
    });
    return reply.send({ runId, ...outcome });
  });

  app.post('/api/admin/intelligence/runs/:runId/discard', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { runId } = request.params as { runId: string };
    const outcome = await discardRun(runId, request.user!.userId);
    if (!outcome.ok) {
      return reply.code(409).send({ error: 'Cannot discard', message: outcome.reason });
    }
    return reply.send({ runId, status: 'discarded' });
  });

  // -------------------------------------------------------------------------
  // Parser profiles
  // -------------------------------------------------------------------------

  app.get('/api/admin/intelligence/parser-profiles', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { facility } = request.query as { facility?: string };
    const profiles = await listProfiles(facility);
    return reply.send({ profiles });
  });

  /** Which imports were parsed by one profile version — the reprocessing scope. */
  app.get('/api/admin/intelligence/parser-profiles/:profileId/batches', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { profileId } = request.params as { profileId: string };
    const batches = await batchesByProfile(profileId);
    return reply.send({ profileId, count: batches.length, batches });
  });

  /**
   * Publish a new version of a profile.
   *
   * Always a new version. There is deliberately no route that edits one, because an
   * edited profile would misdescribe how already-imported documents were read.
   */
  app.post('/api/admin/intelligence/parser-profiles', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const body = (request.body ?? {}) as {
      facility?: string; sourceType?: string; label?: string;
      columnMap?: Record<string, unknown>; parseOptions?: Record<string, unknown>;
      normalizationVersion?: string; ocrVersion?: string;
      effectiveFrom?: string; changeNote?: string;
    };

    if (!body.facility || !body.sourceType || !body.columnMap || !body.changeNote) {
      return reply.code(400).send({
        error: 'Incomplete profile',
        message: 'A profile version requires facility, sourceType, columnMap and changeNote. The change note is what explains, years later, why this version exists.',
      });
    }
    if (!['csv', 'pdf_text', 'pdf_ocr'].includes(body.sourceType)) {
      return reply.code(400).send({ error: 'Invalid sourceType', message: 'One of: csv, pdf_text, pdf_ocr.' });
    }

    const created = await publishProfile({
      facility: body.facility,
      sourceType: body.sourceType as 'csv' | 'pdf_text' | 'pdf_ocr',
      label: body.label ?? `${body.facility} ${body.sourceType}`,
      columnMap: body.columnMap as never,
      parseOptions: body.parseOptions,
      normalizationVersion: body.normalizationVersion,
      ocrVersion: body.ocrVersion,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
      changeNote: body.changeNote,
      createdById: request.user!.userId,
    });

    await recordAccess({
      userId: request.user!.userId,
      action: 'parser_profile_published',
      parameters: { facility: body.facility, sourceType: body.sourceType, version: created.version },
      ipAddress: request.ip,
    });
    return reply.code(201).send(created);
  });
}
