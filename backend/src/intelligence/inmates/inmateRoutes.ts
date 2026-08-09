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
import prisma from '../../lib/prisma.js';
import { recordAccess } from './auditLog.js';
import { runIngestion } from './ingestionEngine.js';
import { listColumnMaps } from './parsers/columnMaps.js';
import { generateAndPersistReport } from './reportGenerator.js';
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


  // -------------------------------------------------------------------------
  // Current jail population
  // -------------------------------------------------------------------------
  app.get('/api/admin/intelligence/population', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const q = request.query as Record<string, string>;
    const where: Record<string, unknown> = { releasedAt: null, departedRosterAt: null };
    if (q.facility) where.facility = q.facility;

    const [total, bookings] = await Promise.all([
      prisma.inmateBooking.count({ where }),
      prisma.inmateBooking.findMany({
        where,
        orderBy: { bookedAt: 'desc' },
        skip: offsetOf(q.offset),
        take: clampLimit(q.limit),
        include: { inmate: true, charges: true },
      }),
    ]);

    return reply.send({
      total,
      results: bookings.map((b) => ({
        inmateId: b.inmateId,
        bookingId: b.bookingId,
        name: `${b.inmate.canonicalLast}, ${b.inmate.canonicalFirst}`,
        facility: b.facility,
        bookedAt: b.bookedAt.toISOString(),
        housingLocation: b.housingLocation,
        custodyStatus: b.custodyStatus,
        lastObservedAt: b.lastObservedAt?.toISOString() ?? null,
        chargeCount: b.charges.length,
      })),
    });
  });

  // -------------------------------------------------------------------------
  // Changes since last time — the other half of the operational answer
  // -------------------------------------------------------------------------
  app.get('/api/admin/intelligence/changes', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const q = request.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (q.batchId) where.batchId = q.batchId;
    if (q.changeType) where.changeType = q.changeType;
    // Immaterial changes (someone still in custody) are excluded by default:
    // they are recorded for completeness, not for reading.
    if (q.includeImmaterial !== 'true') where.material = true;

    const [total, events] = await Promise.all([
      prisma.inmateChangeEvent.count({ where }),
      prisma.inmateChangeEvent.findMany({
        where,
        orderBy: { detectedAt: 'desc' },
        skip: offsetOf(q.offset),
        take: clampLimit(q.limit),
      }),
    ]);

    const inmateIds = [...new Set(events.map((e) => e.inmateId).filter((v): v is string => Boolean(v)))];
    const inmates = inmateIds.length > 0
      ? await prisma.inmate.findMany({
          where: { inmateId: { in: inmateIds } },
          select: { inmateId: true, canonicalFirst: true, canonicalLast: true },
        })
      : [];
    const nameOf = new Map(inmates.map((i) => [i.inmateId, `${i.canonicalLast}, ${i.canonicalFirst}`]));

    return reply.send({
      total,
      results: events.map((e) => ({
        eventId: e.eventId,
        changeType: e.changeType,
        inmateId: e.inmateId,
        name: e.inmateId ? nameOf.get(e.inmateId) ?? null : null,
        bookingId: e.bookingId,
        field: e.field,
        previousValue: e.previousValue,
        newValue: e.newValue,
        material: e.material,
        rosterDate: e.rosterDate?.toISOString().slice(0, 10) ?? null,
        detectedAt: e.detectedAt.toISOString(),
      })),
    });
  });

  // -------------------------------------------------------------------------
  // Cross-source disagreements
  // -------------------------------------------------------------------------
  app.get('/api/admin/intelligence/conflicts', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const q = request.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (q.resolution) where.resolution = q.resolution;

    const [total, conflicts] = await Promise.all([
      prisma.inmateSourceConflict.count({ where }),
      prisma.inmateSourceConflict.findMany({
        where,
        orderBy: { detectedAt: 'desc' },
        skip: offsetOf(q.offset),
        take: clampLimit(q.limit),
      }),
    ]);

    return reply.send({
      total,
      results: conflicts.map((c) => ({
        conflictId: c.conflictId,
        bookingId: c.bookingId,
        field: c.field,
        sourceA: c.sourceA,
        valueA: c.valueA,
        sourceB: c.sourceB,
        valueB: c.valueB,
        resolution: c.resolution,
        resolutionNote: c.resolutionNote,
        rosterDate: c.rosterDate?.toISOString().slice(0, 10) ?? null,
        detectedAt: c.detectedAt.toISOString(),
      })),
    });
  });

  // -------------------------------------------------------------------------
  // Booking detail, with its observations — the evidence for every attribute
  // -------------------------------------------------------------------------
  app.get('/api/admin/intelligence/bookings/:bookingId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const { bookingId } = request.params as { bookingId: string };
    const booking = await prisma.inmateBooking.findUnique({
      where: { bookingId },
      include: {
        charges: true,
        inmate: true,
        sourceBatch: { include: { document: true } },
        observations: { orderBy: { observedAt: 'desc' } },
      },
    });
    if (!booking) return reply.code(404).send({ error: 'Not found' });

    const [changes, conflicts] = await Promise.all([
      prisma.inmateChangeEvent.findMany({ where: { bookingId }, orderBy: { detectedAt: 'desc' } }),
      prisma.inmateSourceConflict.findMany({ where: { bookingId }, orderBy: { detectedAt: 'desc' } }),
    ]);

    return reply.send({
      booking: {
        bookingId: booking.bookingId,
        inmateId: booking.inmateId,
        name: `${booking.inmate.canonicalLast}, ${booking.inmate.canonicalFirst}`,
        facility: booking.facility,
        externalBookingId: booking.externalBookingId,
        bookedAt: booking.bookedAt.toISOString(),
        releasedAt: booking.releasedAt?.toISOString() ?? null,
        custodyStatus: booking.custodyStatus,
        housingLocation: booking.housingLocation,
        isFirstAppearance: booking.isFirstAppearance,
        charges: booking.charges.map((c) => ({
          statute: c.statuteCode && c.statuteSection ? `${c.statuteCode} ${c.statuteSection}` : null,
          description: c.description, severity: c.severity, counts: c.counts, rawText: c.rawText,
        })),
      },
      /** Every source that described this booking, and what it said. */
      observations: booking.observations.map((o) => ({
        observationId: o.observationId,
        sourceType: o.sourceType,
        rosterDate: o.rosterDate?.toISOString().slice(0, 10) ?? null,
        sourcePage: o.sourcePage,
        sourceRow: o.sourceRow,
        housingLocation: o.housingLocation,
        bailAmount: o.bailAmountCents === null ? null : (Number(o.bailAmountCents) / 100).toFixed(2),
        releasedAt: o.releasedAt?.toISOString().slice(0, 10) ?? null,
        custodyStatus: o.custodyStatus,
        chargeCount: o.chargeCount,
        observedAt: o.observedAt.toISOString(),
      })),
      changes: changes.map((c) => ({
        changeType: c.changeType, field: c.field,
        previousValue: c.previousValue, newValue: c.newValue,
        detectedAt: c.detectedAt.toISOString(),
      })),
      conflicts: conflicts.map((c) => ({
        field: c.field, sourceA: c.sourceA, valueA: c.valueA,
        sourceB: c.sourceB, valueB: c.valueB,
        resolution: c.resolution, resolutionNote: c.resolutionNote,
      })),
      provenance: {
        filename: booking.sourceBatch.sourceFilename,
        sha256: booking.sourceBatch.sourceSha256,
        sourceType: booking.sourceBatch.sourceType,
        rosterDate: booking.sourceBatch.rosterDate?.toISOString().slice(0, 10) ?? null,
      },
    });
  });

  // -------------------------------------------------------------------------
  // The printable report — the primary operational deliverable
  // -------------------------------------------------------------------------
  app.get('/api/admin/intelligence/reports/new-inmates', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const q = request.query as Record<string, string>;
    const params = {
      from: q.from,
      to: q.to,
      facility: q.facility,
      minConfidence: q.minConfidence ? Number(q.minConfidence) : undefined,
    };

    // Generating persists the report verbatim, so the printed document can be
    // retrieved later even after the underlying data has been corrected.
    const { reportId, html, rowCount } = await generateAndPersistReport(params, request.user!.userId);

    await recordAccess({
      userId: request.user!.userId,
      action: 'generate_report',
      parameters: { ...params, reportId },
      resultCount: rowCount,
      ipAddress: request.ip,
    });

    if (q.format === 'json') return reply.send({ reportId, rowCount, parameters: params });
    return reply.type('text/html; charset=utf-8').send(html);
  });

  /** A previously generated report, exactly as it was printed. */
  app.get('/api/admin/intelligence/reports/:reportId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const { reportId } = request.params as { reportId: string };
    const report = await prisma.inmateIntelligenceReport.findUnique({ where: { reportId } });
    if (!report) return reply.code(404).send({ error: 'Not found' });

    if ((request.query as Record<string, string>).format === 'json') {
      return reply.send({
        reportId: report.reportId,
        reportType: report.reportType,
        parameters: report.parameters,
        rowCount: report.rowCount,
        generatedAt: report.generatedAt.toISOString(),
        generatedById: report.generatedById,
      });
    }
    return reply.type('text/html; charset=utf-8').send(report.renderedHtml ?? '<p>Not retained.</p>');
  });

  app.get('/api/admin/intelligence/reports', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const rows = await prisma.inmateIntelligenceReport.findMany({
      orderBy: { generatedAt: 'desc' }, take: 100,
      select: { reportId: true, reportType: true, parameters: true, rowCount: true, generatedAt: true, generatedById: true },
    });
    return reply.send({ results: rows.map((r) => ({ ...r, generatedAt: r.generatedAt.toISOString() })) });
  });

  // -------------------------------------------------------------------------
  // Watch lists
  // -------------------------------------------------------------------------
  app.get('/api/admin/intelligence/watchlists', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const entries = await prisma.inmateWatchListEntry.findMany({
      where: { active: true },
      include: { inmate: true, matches: { orderBy: { detectedAt: 'desc' }, take: 5 } },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({
      results: entries.map((e) => ({
        entryId: e.entryId,
        inmateId: e.inmateId,
        name: `${e.inmate.canonicalLast}, ${e.inmate.canonicalFirst}`,
        reason: e.reason,
        createdAt: e.createdAt.toISOString(),
        recentMatches: e.matches.map((m) => ({
          matchType: m.matchType,
          rosterDate: m.rosterDate?.toISOString().slice(0, 10) ?? null,
          detectedAt: m.detectedAt.toISOString(),
          acknowledged: Boolean(m.acknowledgedAt),
        })),
      })),
    });
  });

  app.post('/api/admin/intelligence/watchlists', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const body = (request.body ?? {}) as { inmateId?: string; reason?: string };
    if (!body.inmateId || !body.reason) {
      return reply.code(400).send({ error: 'Bad request', message: 'inmateId and reason are required.' });
    }
    const entry = await prisma.inmateWatchListEntry.upsert({
      where: { inmateId_createdById: { inmateId: body.inmateId, createdById: request.user!.userId } },
      create: { inmateId: body.inmateId, createdById: request.user!.userId, reason: body.reason },
      update: { reason: body.reason, active: true, deactivatedAt: null },
    });
    await recordAccess({
      userId: request.user!.userId, action: 'watch_list_add',
      inmateId: body.inmateId, ipAddress: request.ip,
    });
    return reply.send({ entryId: entry.entryId });
  });

  // -------------------------------------------------------------------------
  // Notifications and statistics
  // -------------------------------------------------------------------------
  app.get('/api/admin/intelligence/notifications', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const rows = await prisma.inmateNotification.findMany({
      where: (request.query as Record<string, string>).unreadOnly === 'true' ? { readAt: null } : {},
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    return reply.send({
      results: rows.map((n) => ({
        notificationId: n.notificationId, kind: n.kind, severity: n.severity,
        title: n.title, body: n.body, inmateId: n.inmateId,
        createdAt: n.createdAt.toISOString(), read: Boolean(n.readAt),
      })),
    });
  });

  app.get('/api/admin/intelligence/statistics', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const [people, bookings, charges, batches, documents, inCustody,
           newInmates, awaitingReview, openConflicts, watchEntries, changeEvents] = await Promise.all([
      prisma.inmate.count({ where: { mergedIntoId: null } }),
      prisma.inmateBooking.count(),
      prisma.inmateBookingCharge.count(),
      prisma.inmateIngestionBatch.count(),
      prisma.inmateSourceDocument.count(),
      prisma.inmateBooking.count({ where: { releasedAt: null, departedRosterAt: null } }),
      prisma.inmateBooking.count({ where: { isFirstAppearance: true } }),
      prisma.inmateReviewQueueItem.count({ where: { status: 'pending' } }),
      prisma.inmateSourceConflict.count({ where: { resolution: 'unknown' } }),
      prisma.inmateWatchListEntry.count({ where: { active: true } }),
      prisma.inmateChangeEvent.count({ where: { material: true } }),
    ]);

    return reply.send({
      repository: { people, bookings, charges, inCustody, newInmatesAllTime: newInmates },
      ingestion: { batches, documents },
      attention: { awaitingReview, unresolvedSourceConflicts: openConflicts, materialChanges: changeEvents },
      watchList: { activeEntries: watchEntries },
    });
  });

  console.log('[Server] Inmate intelligence routes registered (administrator only): /api/admin/intelligence/*');
}
