// ============================================================================
// The operational half of the New Inmate Intelligence dashboard.
//
// Upload, process, watch, review, and look someone up. Everything an administrator
// needs to run a day's roster without touching a shell, which was the point of the
// sprint: the CLI still exists but is no longer the only way in.
//
// These routes sit beside the read-only ones in inmateRoutes.ts rather than inside
// them because multipart has to be registered in its own encapsulated scope. Mixing
// it into the main scope changes body parsing for every other route in the file.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';

import prisma from '../../lib/prisma.js';
import type { AuthenticatedRequest } from '../../security/authMiddleware.js';
import { recordAccess } from './auditLog.js';
import {
  MAX_UPLOAD_BYTES, SUPPORTED_FACILITIES, UPLOAD_FILES_PER_REQUEST,
  deleteUpload, getUpload, listUploads, processingQueue, startProcessing, storeUpload,
} from './rosterUploads.js';

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

export async function registerInmateOperationsRoutes(app: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // Upload — its own scope, so multipart does not affect JSON parsing elsewhere
  // -------------------------------------------------------------------------
  await app.register(async function rosterUploadPlugin(instance) {
    // Cap per request, not per day. The Admin UI uploads large folders in chunks of
    // UPLOAD_FILES_PER_REQUEST so a 1,000+ file drop does not arrive as one body.
    // nginx client_max_body_size must stay above (chunk size × typical file size).
    await instance.register(multipart, {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: UPLOAD_FILES_PER_REQUEST },
    });

    /**
     * Receive one or more roster files.
     *
     * Streamed to disk rather than buffered, so a large scanned PDF does not sit in
     * memory. Each file is registered independently: one bad file in a batch
     * reports its own error and the others still land.
     */
    instance.post('/api/admin/intelligence/uploads', async (request: AuthenticatedRequest, reply: FastifyReply) => {
      if (!requireAdministrator(request, reply)) return;

      const query = request.query as { facility?: string; rosterDate?: string; rosterKind?: string };
      const facility = query.facility ?? SUPPORTED_FACILITIES[0];

      const accepted: unknown[] = [];
      const rejected: { filename: string; reason: string }[] = [];

      try {
        for await (const part of request.parts()) {
          if (part.type !== 'file') continue;

          const stored = await storeUpload({
            facility,
            originalName: part.filename,
            stream: part.file,
            uploadedById: request.user!.userId,
            uploadedByName: request.user!.email ?? undefined,
            rosterDate: query.rosterDate,
            rosterKind: query.rosterKind === 'incremental' ? 'incremental' : 'full_population',
          });

          if ('error' in stored) {
            rejected.push({ filename: part.filename, reason: stored.error });
            // The stream must be drained even when the file is refused, or the
            // remaining parts never arrive.
            part.file.resume();
          } else {
            accepted.push(stored);
          }
        }
      } catch (err) {
        return reply.code(400).send({
          error: 'Upload failed',
          message: err instanceof Error ? err.message : String(err),
          accepted,
          rejected,
        });
      }

      if (accepted.length === 0 && rejected.length === 0) {
        return reply.code(400).send({ error: 'No file received', message: 'Attach at least one CSV or PDF roster.' });
      }

      await recordAccess({
        userId: request.user!.userId,
        action: 'roster_uploaded',
        parameters: { facility, accepted: accepted.length, rejected: rejected.length },
        ipAddress: request.ip,
      });

      return reply.code(accepted.length > 0 ? 201 : 400).send({ accepted, rejected });
    });
  });

  // -------------------------------------------------------------------------
  // Uploads and the processing queue
  // -------------------------------------------------------------------------

  app.get('/api/admin/intelligence/uploads', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const q = request.query as { limit?: string; offset?: string; status?: string };
    return reply.send(await listUploads({
      limit: clampLimit(q.limit),
      offset: offsetOf(q.offset),
      status: q.status,
    }));
  });

  /** What the Processing Queue page polls. */
  app.get('/api/admin/intelligence/uploads/queue', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    return reply.send(await processingQueue());
  });

  app.get('/api/admin/intelligence/uploads/:uploadId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { uploadId } = request.params as { uploadId: string };
    const upload = await getUpload(uploadId);
    if (!upload) return reply.code(404).send({ error: 'Not found', message: 'No such upload.' });
    return reply.send(upload);
  });

  app.delete('/api/admin/intelligence/uploads/:uploadId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { uploadId } = request.params as { uploadId: string };
    const outcome = await deleteUpload(uploadId);
    if (!outcome.ok) return reply.code(409).send({ error: 'Cannot delete', message: outcome.reason });
    return reply.send({ uploadId, deleted: true });
  });

  /**
   * Process Import — the one button.
   *
   * Returns as soon as the uploads are claimed. The work runs in the background and
   * the dashboard polls the queue, because holding a connection open for the length
   * of a roster fails on any proxy timeout and shows the operator nothing meanwhile.
   */
  app.post('/api/admin/intelligence/process', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const body = (request.body ?? {}) as { uploadIds?: string[] };

    let uploadIds = Array.isArray(body.uploadIds) ? body.uploadIds.filter((id) => typeof id === 'string') : [];

    // No selection means everything waiting, which is what the button does when the
    // operator has just uploaded today's two files and pressed it.
    if (uploadIds.length === 0) {
      const pending = await prisma.inmateRosterUpload.findMany({
        where: { status: 'uploaded' },
        orderBy: { uploadedAt: 'asc' },
        select: { uploadId: true },
      });
      uploadIds = pending.map((p) => p.uploadId);
    }

    if (uploadIds.length === 0) {
      return reply.code(400).send({
        error: 'Nothing to process',
        message: 'There are no uploaded files waiting. Upload a roster first.',
      });
    }

    const outcome = await startProcessing({ uploadIds, userId: request.user!.userId });

    await recordAccess({
      userId: request.user!.userId,
      action: 'ingest',
      parameters: { uploadIds: outcome.started, skipped: outcome.skipped.length },
      ipAddress: request.ip,
    });

    return reply.code(202).send(outcome);
  });

  // -------------------------------------------------------------------------
  // Review queue decisions
  // -------------------------------------------------------------------------

  /**
   * Act on a record the resolver would not decide.
   *
   * Three outcomes, matching the three buttons: approve the merge the engine
   * proposed, reject it and create a separate person, or create a new person
   * outright. Every one of them writes the decision and its reason — a merge
   * accepted without a record of who accepted it is exactly the black box the
   * platform is built to avoid.
   */
  app.post('/api/admin/intelligence/review/:recordId/decide', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { recordId } = request.params as { recordId: string };
    const body = (request.body ?? {}) as { decision?: string; note?: string };

    const decision = body.decision;
    if (decision !== 'approve_merge' && decision !== 'reject_merge' && decision !== 'create_new_person') {
      return reply.code(400).send({
        error: 'Invalid decision',
        message: 'One of: approve_merge, reject_merge, create_new_person.',
      });
    }

    const { decideReview } = await import('./reviewDecisions.js');
    const outcome = await decideReview({
      recordId,
      decision,
      note: body.note?.trim(),
      reviewerId: request.user!.userId,
    });

    if (!outcome.ok) {
      return reply.code(409).send({ error: 'Cannot record decision', message: outcome.reason });
    }

    await recordAccess({
      userId: request.user!.userId,
      action: decision === 'approve_merge' ? 'merge' : 'unmerge',
      inmateId: outcome.inmateId,
      parameters: { recordId, decision },
      ipAddress: request.ip,
    });

    return reply.send(outcome);
  });

  // -------------------------------------------------------------------------
  // The daily intelligence report — the operational product
  // -------------------------------------------------------------------------

  /**
   * The report an operator prints each morning.
   *
   * Returns HTML by default because the server renders it with a print stylesheet:
   * what is reviewed on screen is exactly what prints, with no second rendering path
   * that could disagree. `?format=json` returns the assembled sections for a caller
   * that wants the data rather than the document.
   */
  app.get('/api/admin/intelligence/reports/daily', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const q = request.query as { date?: string; facility?: string; format?: string };

    const { generateDailyReport } = await import('./dailyReport.js');
    const { reportId, html, report } = await generateDailyReport(
      { date: q.date, facility: q.facility },
      request.user!.userId,
    );

    await recordAccess({
      userId: request.user!.userId,
      action: 'generate_report',
      parameters: { reportId, date: report.summary.reportDate, type: 'daily_intelligence' },
      resultCount: report.newlyBooked.length + report.returning.length,
      ipAddress: request.ip,
    });

    if (q.format === 'json') return reply.send({ reportId, ...report });
    return reply.type('text/html; charset=utf-8').send(html);
  });

  // -------------------------------------------------------------------------
  // Morning Operations Summary — the first thing an operator sees
  // -------------------------------------------------------------------------

  app.get('/api/admin/intelligence/morning', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { getMorningSummary } = await import('./operations.js');
    return reply.send(await getMorningSummary());
  });

  // -------------------------------------------------------------------------
  // Batch lifecycle
  // -------------------------------------------------------------------------

  /** One batch, with every state it passed through and how long each took. */
  app.get('/api/admin/intelligence/batches/:batchId/lifecycle', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { batchId } = request.params as { batchId: string };

    const { getBatchLifecycle } = await import('./batchLifecycle.js');
    const view = await getBatchLifecycle(batchId);
    if (!view) return reply.code(404).send({ error: 'Not found', message: 'No such batch.' });
    return reply.send(view);
  });

  /** Close a batch: the operator has read the intelligence and is finished with it. */
  app.post('/api/admin/intelligence/batches/:batchId/close', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { batchId } = request.params as { batchId: string };

    const { closeBatch } = await import('./batchLifecycle.js');
    const outcome = await closeBatch({ batchId, actorId: request.user!.userId });
    if (!outcome.ok) return reply.code(409).send({ error: 'Cannot close', message: outcome.reason });
    return reply.send({ batchId, closed: true });
  });

  app.post('/api/admin/intelligence/batches/:batchId/cancel', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { batchId } = request.params as { batchId: string };
    const body = (request.body ?? {}) as { reason?: string };

    const { cancelBatch } = await import('./batchLifecycle.js');
    const outcome = await cancelBatch({ batchId, actorId: request.user!.userId, reason: body.reason ?? '' });
    if (!outcome.ok) return reply.code(409).send({ error: 'Cannot cancel', message: outcome.reason });
    return reply.send({ batchId, cancelled: true });
  });

  // -------------------------------------------------------------------------
  // Batch comparison
  // -------------------------------------------------------------------------

  /** Compare the two most recent completed imports — "what changed since yesterday". */
  app.get('/api/admin/intelligence/comparison/latest', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { facility } = request.query as { facility?: string };

    const { compareLatest } = await import('./operations.js');
    const result = await compareLatest(facility ?? 'sacramento', request.user!.userId);
    if (!result.ok) return reply.code(409).send({ error: 'Cannot compare', message: result.reason });
    return reply.send(result);
  });

  app.post('/api/admin/intelligence/comparison', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const body = (request.body ?? {}) as { baselineBatchId?: string; currentBatchId?: string };
    if (!body.baselineBatchId || !body.currentBatchId) {
      return reply.code(400).send({ error: 'Two batches required', message: 'Send baselineBatchId and currentBatchId.' });
    }

    const { compareBatches } = await import('./operations.js');
    const result = await compareBatches({
      baselineBatchId: body.baselineBatchId,
      currentBatchId: body.currentBatchId,
      generatedById: request.user!.userId,
      persist: true,
    });
    if (!result.ok) return reply.code(409).send({ error: 'Cannot compare', message: result.reason });
    return reply.send(result);
  });

  // -------------------------------------------------------------------------
  // Report approval
  // -------------------------------------------------------------------------

  app.get('/api/admin/intelligence/reports/list', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const q = request.query as { state?: string; limit?: string };

    const { listReports } = await import('./operations.js');
    return reply.send({ reports: await listReports({ limit: clampLimit(q.limit, 50, 200), state: q.state }) });
  });

  /**
   * Move a report through its approval states.
   *
   * Forward only, and the document never changes. Printing is recorded because it is the
   * moment a conclusion left the building on paper — after that a correction has to be a
   * new report that says what it supersedes.
   */
  app.post('/api/admin/intelligence/reports/:reportId/state', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { reportId } = request.params as { reportId: string };
    const body = (request.body ?? {}) as { state?: string; note?: string };

    const states = ['draft', 'reviewed', 'approved', 'printed', 'archived'];
    if (!body.state || !states.includes(body.state)) {
      return reply.code(400).send({ error: 'Invalid state', message: `One of: ${states.join(', ')}.` });
    }

    const { setReportState } = await import('./operations.js');
    const outcome = await setReportState({
      reportId,
      to: body.state as 'draft' | 'reviewed' | 'approved' | 'printed' | 'archived',
      actorId: request.user!.userId,
      note: body.note,
    });
    if (!outcome.ok) return reply.code(409).send({ error: 'Cannot change state', message: outcome.reason });

    await recordAccess({
      userId: request.user!.userId,
      action: 'generate_report',
      parameters: { reportId, state: body.state },
      ipAddress: request.ip,
    });
    return reply.send({ reportId, state: outcome.state, printCount: outcome.printCount });
  });

  // -------------------------------------------------------------------------
  // Operational metrics
  // -------------------------------------------------------------------------

  app.get('/api/admin/intelligence/metrics', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const q = request.query as { limit?: string; facility?: string; trendDays?: string };

    const { getBatchMetrics, getMetricTrend } = await import('./operations.js');
    const [perBatch, trend] = await Promise.all([
      getBatchMetrics({ limit: clampLimit(q.limit, 30, 200), facility: q.facility }),
      getMetricTrend(Math.min(Number(q.trendDays) || 30, 180)),
    ]);
    return reply.send({ ...perBatch, ...trend });
  });

  // -------------------------------------------------------------------------
  // Dashboard and import history
  // -------------------------------------------------------------------------

  /** What the dashboard shows immediately after Process Import. */
  app.get('/api/admin/intelligence/dashboard', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { date } = request.query as { date?: string };

    const { getDashboardSummary } = await import('./dashboardSummary.js');
    return reply.send(await getDashboardSummary({ date }));
  });

  /** One row per processing run, with everything a run is required to record. */
  app.get('/api/admin/intelligence/import-history', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const q = request.query as { limit?: string; offset?: string };

    const { getImportHistory } = await import('./dashboardSummary.js');
    return reply.send(await getImportHistory({
      limit: clampLimit(q.limit),
      offset: offsetOf(q.offset),
    }));
  });

  // -------------------------------------------------------------------------
  // Person detail and historical search
  // -------------------------------------------------------------------------

  /** Everything known about one person, assembled. */
  app.get('/api/admin/intelligence/persons/:inmateId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const { inmateId } = request.params as { inmateId: string };

    const { getPersonDetail } = await import('./personDetail.js');
    const detail = await getPersonDetail(inmateId);
    if (!detail) return reply.code(404).send({ error: 'Not found', message: 'No such person.' });

    await recordAccess({
      userId: request.user!.userId,
      action: 'view_inmate',
      inmateId,
      ipAddress: request.ip,
    });
    return reply.send(detail);
  });

  /** Search by name, alias, date of birth, booking number or the jail's person id. */
  app.get('/api/admin/intelligence/persons', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;

    const { searchHistorical } = await import('./personDetail.js');
    const result = await searchHistorical({
      name: q.name,
      last: q.last,
      first: q.first,
      dateOfBirth: q.dateOfBirth,
      bookingNumber: q.bookingNumber,
      externalPersonId: q.externalPersonId ?? q.soNumber,
      facility: q.facility,
      limit: clampLimit(q.limit),
      offset: offsetOf(q.offset),
    });

    await recordAccess({
      userId: request.user!.userId,
      action: 'search',
      parameters: q,
      resultCount: result.results.length,
      ipAddress: request.ip,
    });
    return reply.send(result);
  });

  /** The review queue, with each candidate resolved enough to decide against. */
  app.get('/api/admin/intelligence/review', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;
    const q = request.query as { limit?: string; offset?: string };

    const { reviewQueueDetailed } = await import('./reviewDecisions.js');
    const result = await reviewQueueDetailed({
      limit: clampLimit(q.limit, 25, 100),
      offset: offsetOf(q.offset),
    });

    await recordAccess({
      userId: request.user!.userId,
      action: 'view_review_queue',
      resultCount: result.results.length,
      ipAddress: request.ip,
    });
    return reply.send(result);
  });

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  /** What version 1 supports, so the UI states its own scope rather than assuming. */
  app.get('/api/admin/intelligence/settings', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!requireAdministrator(request, reply)) return;

    const [facilities, profiles, uploadCount, batchCount] = await Promise.all([
      prisma.inmateFacility.findMany({ orderBy: { code: 'asc' } }),
      prisma.inmateParserProfile.findMany({
        where: { active: true },
        orderBy: [{ facility: 'asc' }, { version: 'desc' }],
      }),
      prisma.inmateRosterUpload.count(),
      prisma.inmateIngestionBatch.count(),
    ]);

    return reply.send({
      scope: {
        facilities: SUPPORTED_FACILITIES,
        manualUploadsOnly: true,
        schedulerEnabled: false,
        watchListNotificationsEnabled: false,
        maxUploadBytes: MAX_UPLOAD_BYTES,
        acceptedFileTypes: ['.csv', '.pdf'],
      },
      facilities: facilities.map((f) => ({
        code: f.code,
        name: f.name,
        county: f.county,
        rostersAreFullPopulation: f.rostersAreFullPopulation,
        active: f.active,
      })),
      parserProfiles: profiles.map((p) => ({
        profileId: p.profileId,
        facility: p.facility,
        sourceType: p.sourceType,
        version: p.version,
        label: p.label,
        effectiveFrom: p.effectiveFrom?.toISOString().slice(0, 10) ?? null,
        effectiveTo: p.effectiveTo?.toISOString().slice(0, 10) ?? null,
        changeNote: p.changeNote,
      })),
      totals: { uploads: uploadCount, imports: batchCount },
      dailyWorkflow: {
        primarySource: 'pdf',
        pipeline: [
          'yesterday_pdf',
          'today_pdf',
          'roster_comparison',
          'new_inmate_detection',
          'historical_lookup',
          'new_inmate_report',
          'repository',
          'optional_csv_enrichment',
        ],
        csvRole: 'enrichment_only_never_determines_newness',
      },
    });
  });

  // -------------------------------------------------------------------------
  // Daily Case — one operational day (PDF primary, optional CSV enrichment)
  // -------------------------------------------------------------------------

  app.get('/api/admin/intelligence/daily-cases', async (request, reply) => {
    if (!requireAdministrator(request as AuthenticatedRequest, reply)) return;
    const query = request.query as { facility?: string; limit?: string; offset?: string };
    const { listDailyCases } = await import('./dailyCase.js');
    return reply.send(await listDailyCases({
      facility: query.facility,
      limit: clampLimit(query.limit, 30, 100),
      offset: offsetOf(query.offset),
    }));
  });

  app.get('/api/admin/intelligence/daily-cases/:caseId', async (request, reply) => {
    if (!requireAdministrator(request as AuthenticatedRequest, reply)) return;
    const { caseId } = request.params as { caseId: string };
    const { getDailyCase } = await import('./dailyCase.js');
    const row = await getDailyCase(caseId);
    if (!row) return reply.code(404).send({ error: 'Daily case not found' });
    return reply.send(row);
  });

  app.get('/api/admin/intelligence/daily-cases/by-date/:facility/:opsDate', async (request, reply) => {
    if (!requireAdministrator(request as AuthenticatedRequest, reply)) return;
    const { facility, opsDate } = request.params as { facility: string; opsDate: string };
    const { getDailyCaseByDate } = await import('./dailyCase.js');
    const row = await getDailyCaseByDate(facility, opsDate);
    if (!row) return reply.code(404).send({ error: 'Daily case not found' });
    return reply.send(row);
  });

  // -------------------------------------------------------------------------
  // Continuous Operational Validation — Learning Queue + engineering certs
  // (admin/developer only; not the staff revenue report)
  // -------------------------------------------------------------------------

  app.get('/api/admin/intelligence/learning-queue', async (request, reply) => {
    if (!requireAdministrator(request as AuthenticatedRequest, reply)) return;
    const query = request.query as { facility?: string; status?: string; limit?: string; offset?: string };
    const { listLearningQueue } = await import('./learningQueue.js');
    return reply.send(await listLearningQueue({
      facility: query.facility,
      status: query.status,
      limit: clampLimit(query.limit, 100, 500),
      offset: offsetOf(query.offset),
    }));
  });

  app.patch('/api/admin/intelligence/learning-queue/:itemId', async (request, reply) => {
    if (!requireAdministrator(request as AuthenticatedRequest, reply)) return;
    const { itemId } = request.params as { itemId: string };
    const body = request.body as {
      status?: 'open' | 'in_progress' | 'fixed' | 'verified_regression';
      rootCause?: 'parser' | 'normalization' | 'identity' | 'classification' | 'report' | 'unknown';
      note?: string;
      regressionPath?: string;
    };
    const { updateLearningQueueItem } = await import('./learningQueue.js');
    try {
      const row = await updateLearningQueueItem({ itemId, ...body });
      return reply.send({
        itemId: row.itemId,
        status: row.status,
        rootCause: row.rootCause,
        regressionPath: row.regressionPath,
        fixedAt: row.fixedAt?.toISOString() ?? null,
        verifiedAt: row.verifiedAt?.toISOString() ?? null,
      });
    } catch {
      return reply.code(404).send({ error: 'Learning queue item not found' });
    }
  });

  app.get('/api/admin/intelligence/certifications', async (request, reply) => {
    if (!requireAdministrator(request as AuthenticatedRequest, reply)) return;
    const query = request.query as { facility?: string; limit?: string };
    const facility = query.facility ?? 'sacramento';
    const limit = clampLimit(query.limit, 30, 100);
    const rows = await prisma.inmateDailyCertification.findMany({
      where: { facility },
      orderBy: { opsDate: 'desc' },
      take: limit,
    });
    const { consecutivePassStreak } = await import('./learningQueue.js');
    const streak = await consecutivePassStreak(facility);
    return reply.send({
      facility,
      readiness: streak,
      certifications: rows.map((r) => ({
        certificationId: r.certificationId,
        opsDate: r.opsDate.toISOString().slice(0, 10),
        status: r.status,
        precision: r.precision,
        recall: r.recall,
        potentialClientsFound: r.potentialClientsFound,
        potentialClientsMissed: r.potentialClientsMissed,
        reconcileOk: r.reconcileOk,
        currentInmateCount: r.currentInmateCount,
        newInmateCount: r.newInmateCount,
      })),
    });
  });

  app.get('/api/admin/intelligence/certifications/:facility/:opsDate', async (request, reply) => {
    if (!requireAdministrator(request as AuthenticatedRequest, reply)) return;
    const { facility, opsDate } = request.params as { facility: string; opsDate: string };
    const row = await prisma.inmateDailyCertification.findUnique({
      where: {
        facility_opsDate: {
          facility,
          opsDate: new Date(`${opsDate.slice(0, 10)}T00:00:00.000Z`),
        },
      },
    });
    if (!row) return reply.code(404).send({ error: 'Certification not found' });
    return reply.send({
      certificationId: row.certificationId,
      facility: row.facility,
      opsDate: row.opsDate.toISOString().slice(0, 10),
      status: row.status,
      summary: row.summary,
      precision: row.precision,
      recall: row.recall,
      precisionPct: pct(row.precision),
      recallPct: pct(row.recall),
      potentialClientsFound: row.potentialClientsFound,
      potentialClientsMissed: row.potentialClientsMissed,
      reconcileOk: row.reconcileOk,
      processingTimeMs: row.processingTimeMs,
    });
  });
}

function pct(value: number | null): string | null {
  return value == null ? null : `${(value * 100).toFixed(1)}%`;
}
