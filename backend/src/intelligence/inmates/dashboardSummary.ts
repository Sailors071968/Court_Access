// ============================================================================
// The dashboard summary.
//
// What the operator sees immediately after pressing Process Import: how many people
// are new, how many came back, how many were already known, what needs a decision,
// what disagrees, how long it took, and which files it read.
//
// Scoped to a day rather than to a batch, because a day's work is two files — the
// CSV and the PDF — and the operator's question is about the roster, not about one
// document. Defaults to the most recent day that has any imports rather than to
// today: an operator opening the dashboard on Monday morning wants to see Friday's
// run, not an empty screen.
// ============================================================================

import prisma from '../../lib/prisma.js';

export interface DashboardSummary {
  /** The day these numbers describe, and whether it is today. */
  session: {
    date: string;
    isToday: boolean;
    batchIds: string[];
    filesProcessed: number;
    /** Wall time across the day's imports, which is what the operator waited. */
    processingTimeMs: number;
    facilities: string[];
    rosterDates: string[];
  };
  results: {
    recordsRead: number;
    /** People never seen in the repository before. The primary output. */
    newInmates: number;
    /** People with a prior booking who have been booked again. */
    returningInmates: number;
    /** Rows matched to someone already in custody — restatements, not events. */
    knownInmates: number;
    reviewRequired: number;
    conflicts: number;
    departures: number;
    failed: number;
  };
  /** Standing totals, so the day's numbers have something to sit against. */
  repository: {
    people: number;
    bookings: number;
    inCustody: number;
    awaitingReview: number;
    unresolvedConflicts: number;
  };
  /** Anything that went wrong, most severe first. */
  issues: { severity: string; code: string; message: string; batchId: string; lineNumber: number | null }[];
  uploads: {
    uploadId: string;
    filename: string;
    fileKind: string;
    status: string;
    stage: string | null;
    sizeBytes: number;
    uploadedByName: string | null;
    uploadedAt: string;
    durationMs: number | null;
  }[];
}

export async function getDashboardSummary(args: { date?: string } = {}): Promise<DashboardSummary> {
  const { dayStart, dayEnd, date } = await resolveDay(args.date);

  const batches = await prisma.inmateIngestionBatch.findMany({
    where: { startedAt: { gte: dayStart, lt: dayEnd } },
    orderBy: { startedAt: 'asc' },
  });
  const batchIds = batches.map((b) => b.batchId);

  const [
    newCount, returningCount, knownCount, reviewCount, conflictCount,
    departureCount, failedCount, recordsRead,
    people, bookings, inCustody, awaitingReview, unresolvedConflicts,
    issues, uploads,
  ] = await Promise.all([
    // A first appearance is recorded at ingestion time, never recomputed — so this
    // number does not change when an older roster is backfilled later.
    batchIds.length ? prisma.inmateBooking.count({ where: { sourceBatchId: { in: batchIds }, isFirstAppearance: true } }) : 0,
    batchIds.length ? prisma.inmateBooking.count({ where: { sourceBatchId: { in: batchIds }, isFirstAppearance: false } }) : 0,
    // A duplicate is the same booking restated by another source or another day's
    // roster: the person is known and so is the stay.
    batchIds.length ? prisma.inmateIngestionRecord.count({ where: { batchId: { in: batchIds }, resolution: 'duplicate' } }) : 0,
    batchIds.length ? prisma.inmateIngestionRecord.count({ where: { batchId: { in: batchIds }, resolution: 'needs_review' } }) : 0,
    batchIds.length ? prisma.inmateSourceConflict.count({ where: { batchId: { in: batchIds } } }) : 0,
    batchIds.length ? prisma.inmateChangeEvent.count({ where: { batchId: { in: batchIds }, changeType: 'departed_roster' } }) : 0,
    batchIds.length ? prisma.inmateIngestionRecord.count({ where: { batchId: { in: batchIds }, resolution: 'failed' } }) : 0,
    batchIds.length ? prisma.inmateIngestionRecord.count({ where: { batchId: { in: batchIds } } }) : 0,

    prisma.inmate.count({ where: { mergedIntoId: null } }),
    prisma.inmateBooking.count(),
    prisma.inmateBooking.count({ where: { releasedAt: null, departedRosterAt: null } }),
    prisma.inmateReviewQueueItem.count({ where: { status: 'pending' } }),
    prisma.inmateSourceConflict.count({ where: { resolution: 'unknown' } }),

    batchIds.length
      ? prisma.inmateIngestionIssue.findMany({
          where: { batchId: { in: batchIds } },
          orderBy: [{ severity: 'asc' }, { lineNumber: 'asc' }],
          take: 100,
        })
      : Promise.resolve([]),
    prisma.inmateRosterUpload.findMany({
      where: {
        OR: [
          { batchId: { in: batchIds.length ? batchIds : ['none'] } },
          { uploadedAt: { gte: dayStart, lt: dayEnd } },
        ],
      },
      orderBy: { uploadedAt: 'asc' },
      take: 50,
    }),
  ]);

  const processingTimeMs = batches.reduce((total, b) => {
    if (!b.finishedAt) return total;
    return total + (b.finishedAt.getTime() - b.startedAt.getTime());
  }, 0);

  const today = new Date().toISOString().slice(0, 10);

  return {
    session: {
      date,
      isToday: date === today,
      batchIds,
      filesProcessed: batches.length,
      processingTimeMs,
      facilities: [...new Set(batches.map((b) => b.facility))],
      rosterDates: [...new Set(batches.map((b) => b.rosterDate?.toISOString().slice(0, 10)).filter((v): v is string => Boolean(v)))],
    },
    results: {
      recordsRead,
      newInmates: newCount,
      returningInmates: returningCount,
      knownInmates: knownCount,
      reviewRequired: reviewCount,
      conflicts: conflictCount,
      departures: departureCount,
      failed: failedCount,
    },
    repository: { people, bookings, inCustody, awaitingReview, unresolvedConflicts },
    issues: issues.map((i) => ({
      severity: i.severity,
      code: i.code,
      message: i.message,
      batchId: i.batchId,
      lineNumber: i.lineNumber,
    })),
    uploads: uploads.map((u) => ({
      uploadId: u.uploadId,
      filename: u.originalName,
      fileKind: u.fileKind,
      status: u.status,
      stage: u.stage,
      sizeBytes: u.sizeBytes,
      uploadedByName: u.uploadedByName,
      uploadedAt: u.uploadedAt.toISOString(),
      durationMs: u.durationMs,
    })),
  };
}

/**
 * Which day to report on.
 *
 * An explicit date wins. Otherwise the most recent day with any import, so the
 * dashboard is never blank because nobody has run anything yet this morning. With no
 * imports at all it falls back to today, which is the honest empty state.
 */
async function resolveDay(requested?: string): Promise<{ dayStart: Date; dayEnd: Date; date: string }> {
  let date = requested?.trim();

  if (!date) {
    const latest = await prisma.inmateIngestionBatch.findFirst({
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    });
    date = (latest?.startedAt ?? new Date()).toISOString().slice(0, 10);
  }

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(dayStart.getTime())) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      dayStart: new Date(`${today}T00:00:00.000Z`),
      dayEnd: new Date(`${today}T23:59:59.999Z`),
      date: today,
    };
  }

  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return { dayStart, dayEnd, date };
}

/**
 * The import log: one row per processing run, with everything the spec asks a run
 * to record.
 */
export async function getImportHistory(args: { limit: number; offset: number }) {
  const [total, batches] = await Promise.all([
    prisma.inmateIngestionBatch.count(),
    prisma.inmateIngestionBatch.findMany({
      orderBy: [{ startedAt: 'desc' }, { batchId: 'asc' }],
      skip: args.offset,
      take: args.limit,
      include: { _count: { select: { issues: true } } },
    }),
  ]);

  const batchIds = batches.map((b) => b.batchId);

  const [uploads, errorCounts, warningCounts, newCounts] = await Promise.all([
    prisma.inmateRosterUpload.findMany({
      where: { batchId: { in: batchIds.length ? batchIds : ['none'] } },
      select: { batchId: true, originalName: true, fileKind: true, uploadedByName: true, sizeBytes: true },
    }),
    prisma.inmateIngestionIssue.groupBy({
      by: ['batchId'],
      where: { batchId: { in: batchIds.length ? batchIds : ['none'] }, severity: 'error' },
      _count: { issueId: true },
    }),
    prisma.inmateIngestionIssue.groupBy({
      by: ['batchId'],
      where: { batchId: { in: batchIds.length ? batchIds : ['none'] }, severity: 'warning' },
      _count: { issueId: true },
    }),
    prisma.inmateBooking.groupBy({
      by: ['sourceBatchId'],
      where: { sourceBatchId: { in: batchIds.length ? batchIds : ['none'] }, isFirstAppearance: true },
      _count: { bookingId: true },
    }),
  ]);

  const uploadByBatch = new Map(uploads.map((u) => [u.batchId!, u]));
  const errorByBatch = new Map(errorCounts.map((e) => [e.batchId, e._count.issueId]));
  const warningByBatch = new Map(warningCounts.map((w) => [w.batchId, w._count.issueId]));
  const newByBatch = new Map(newCounts.map((n) => [n.sourceBatchId, n._count.bookingId]));

  return {
    total,
    results: batches.map((b) => {
      const upload = uploadByBatch.get(b.batchId);
      return {
        // "Import ID" in the operator's language.
        batchId: b.batchId,
        startedAt: b.startedAt.toISOString(),
        finishedAt: b.finishedAt?.toISOString() ?? null,
        durationMs: b.finishedAt ? b.finishedAt.getTime() - b.startedAt.getTime() : null,
        operator: upload?.uploadedByName ?? b.ingestedById ?? null,
        operatorId: b.ingestedById,
        trigger: b.triggeredBy,
        facility: b.facility,
        filename: b.sourceFilename,
        fileKind: upload?.fileKind ?? b.sourceType,
        sizeBytes: upload?.sizeBytes ?? null,
        sourceType: b.sourceType,
        sha256: b.sourceSha256,
        rosterDate: b.rosterDate?.toISOString().slice(0, 10) ?? null,
        rosterKind: b.rosterKind,
        status: b.status,
        failureReason: b.failureReason,
        parserVersion: b.parserVersion,
        normalizationVersion: b.normalizationVersion,
        recordsTotal: b.recordsTotal,
        newInmates: newByBatch.get(b.batchId) ?? 0,
        // Everything the resolver decided, so the row explains its own totals.
        matched: b.recordsMatched,
        duplicates: b.recordsDuplicate,
        reviewRequired: b.recordsForReview,
        failed: b.recordsFailed,
        errors: errorByBatch.get(b.batchId) ?? 0,
        warnings: warningByBatch.get(b.batchId) ?? 0,
        issueCount: b._count.issues,
      };
    }),
  };
}
