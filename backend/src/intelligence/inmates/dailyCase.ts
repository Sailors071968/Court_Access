// ============================================================================
// Daily Case — one operational day at a facility.
//
// Pipeline (PDF primary):
//   Yesterday PDF + Today PDF → comparison → new-inmate detection → historical
//   lookup → New Inmate Intelligence Report → repository
//   → (optional) CSV enrichment → update existing records / flag exceptions
//
// The case is the single place to review everything that happened that day.
// ============================================================================

import prisma from '../../lib/prisma.js';
import { generateAndPersistReport } from './reportGenerator.js';

export type DailyCaseStatus =
  | 'pending'
  | 'prior_ready'
  | 'current_ready'
  | 'compared'
  | 'report_ready'
  | 'enriching'
  | 'enriched'
  | 'closed';

export interface DailyCaseAuditEntry {
  at: string;
  kind: string;
  detail: string;
  actorId?: string | null;
}

function dayStart(isoDate: string): Date {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
}

function priorIso(isoDate: string): string {
  const d = dayStart(isoDate);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function asAudit(log: unknown): DailyCaseAuditEntry[] {
  return Array.isArray(log) ? (log as DailyCaseAuditEntry[]) : [];
}

async function appendAudit(
  caseId: string,
  entry: DailyCaseAuditEntry,
  extra: Record<string, unknown> = {},
) {
  const row = await prisma.inmateDailyCase.findUnique({ where: { caseId } });
  if (!row) return;
  const auditLog = [...asAudit(row.auditLog), entry];
  await prisma.inmateDailyCase.update({
    where: { caseId },
    data: { auditLog: auditLog as object, ...extra, updatedAt: new Date() },
  });
}

/** Upsert the Daily Case for a facility + ops (today) date. */
export async function ensureDailyCase(args: {
  facility: string;
  opsDate: string;
  createdById?: string | null;
}) {
  const opsDate = dayStart(args.opsDate);
  return prisma.inmateDailyCase.upsert({
    where: { facility_opsDate: { facility: args.facility, opsDate } },
    create: {
      facility: args.facility,
      opsDate,
      priorRosterDate: dayStart(priorIso(args.opsDate)),
      currentRosterDate: opsDate,
      createdById: args.createdById ?? null,
      auditLog: [{
        at: new Date().toISOString(),
        kind: 'case_opened',
        detail: `Daily case opened for ${args.opsDate}`,
        actorId: args.createdById ?? null,
      }],
    },
    update: {},
  });
}

/**
 * Attach a completed upload/batch to the day's case.
 *
 * PDF with rosterDate = opsDate → current PDF (triggers comparison + report when prior exists).
 * PDF with rosterDate = opsDate−1 → prior PDF.
 * CSV with rosterDate = opsDate → enrichment attachment.
 */
export async function attachUploadToDailyCase(args: {
  facility: string;
  uploadId: string;
  batchId: string | null;
  fileKind: string;
  rosterDate: string | null;
  counts?: {
    newInmates?: number;
    matched?: number;
    needsReview?: number;
  } | null;
  userId?: string | null;
  /** When true, generate the initial new-inmate report immediately after PDF compare. */
  autoReport?: boolean;
}): Promise<{ caseId: string; status: string } | null> {
  if (!args.rosterDate) return null;

  const rosterDate = args.rosterDate.slice(0, 10);
  // Ops day is the current (today) roster date for PDFs/CSVs labeled as "today".
  // A prior-day PDF is attached to tomorrow's case as the baseline.
  const isPdf = args.fileKind === 'pdf';
  const isCsv = args.fileKind === 'csv';

  // Prefer attaching to a case whose currentRosterDate matches this file's date
  // (today's PDF/CSV). Prior PDFs attach to the next day's case.
  let opsDate = rosterDate;
  if (isPdf) {
    // Heuristic: if a case already exists for rosterDate+1 with this as prior, use it;
    // otherwise if attaching a file that looks like "yesterday", callers pass the
    // current ops date via ensure. Default: treat PDF rosterDate as opsDate (today).
    opsDate = rosterDate;
  }

  const daily = await ensureDailyCase({
    facility: args.facility,
    opsDate,
    createdById: args.userId,
  });

  const entry: DailyCaseAuditEntry = {
    at: new Date().toISOString(),
    kind: isCsv ? 'csv_attached' : 'pdf_attached',
    detail: `${args.fileKind} upload ${args.uploadId} batch ${args.batchId ?? 'none'} rosterDate=${rosterDate}`,
    actorId: args.userId ?? null,
  };

  if (isCsv) {
    await appendAudit(daily.caseId, entry, {
      csvUploadId: args.uploadId,
      csvBatchId: args.batchId,
      status: daily.status === 'report_ready' || daily.status === 'compared'
        ? 'enriching'
        : daily.status === 'enriched'
          ? 'enriched'
          : 'enriching',
      exceptionCount: args.counts?.needsReview ?? daily.exceptionCount,
      reviewCount: args.counts?.needsReview ?? daily.reviewCount,
    });
    // Mark enriched when CSV batch completed.
    if (args.batchId) {
      await prisma.inmateDailyCase.update({
        where: { caseId: daily.caseId },
        data: { status: 'enriched' },
      });
      await appendAudit(daily.caseId, {
        at: new Date().toISOString(),
        kind: 'csv_enrichment_complete',
        detail: 'CSV enrichment finished; newness was not re-derived from CSV.',
        actorId: args.userId ?? null,
      });
    }
    const refreshed = await prisma.inmateDailyCase.findUnique({ where: { caseId: daily.caseId } });
    return { caseId: daily.caseId, status: refreshed?.status ?? daily.status };
  }

  // PDF: same-day = current; if case already has current and this date is prior day, set prior.
  const casePrior = daily.priorRosterDate?.toISOString().slice(0, 10);
  const caseCurrent = daily.currentRosterDate?.toISOString().slice(0, 10) ?? opsDate;

  if (rosterDate === caseCurrent || !daily.currentPdfBatchId) {
    await appendAudit(daily.caseId, entry, {
      currentPdfUploadId: args.uploadId,
      currentPdfBatchId: args.batchId,
      currentRosterDate: dayStart(rosterDate),
      status: daily.priorPdfBatchId ? 'current_ready' : 'current_ready',
      newInmateCount: args.counts?.newInmates ?? daily.newInmateCount,
    });
  } else if (rosterDate === casePrior) {
    await appendAudit(daily.caseId, entry, {
      priorPdfUploadId: args.uploadId,
      priorPdfBatchId: args.batchId,
      status: 'prior_ready',
    });
  } else {
    // PDF for a different day: open/attach as current for that day.
    const other = await ensureDailyCase({
      facility: args.facility,
      opsDate: rosterDate,
      createdById: args.userId,
    });
    await appendAudit(other.caseId, entry, {
      currentPdfUploadId: args.uploadId,
      currentPdfBatchId: args.batchId,
      status: 'current_ready',
      newInmateCount: args.counts?.newInmates ?? 0,
    });
    return finalizePdfComparison({
      caseId: other.caseId,
      userId: args.userId,
      autoReport: args.autoReport ?? true,
    });
  }

  // Also try attaching this PDF as prior on the next day's case.
  const nextOps = (() => {
    const d = dayStart(rosterDate);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const nextCase = await ensureDailyCase({
    facility: args.facility,
    opsDate: nextOps,
    createdById: args.userId,
  });
  if (!nextCase.priorPdfBatchId && rosterDate === nextCase.priorRosterDate?.toISOString().slice(0, 10)) {
    await appendAudit(nextCase.caseId, {
      ...entry,
      kind: 'prior_pdf_attached',
      detail: `Prior PDF for ${nextOps}: upload ${args.uploadId}`,
    }, {
      priorPdfUploadId: args.uploadId,
      priorPdfBatchId: args.batchId,
      status: nextCase.currentPdfBatchId ? 'current_ready' : 'prior_ready',
    });
  }

  return finalizePdfComparison({
    caseId: daily.caseId,
    userId: args.userId,
    autoReport: args.autoReport ?? true,
  });
}

/**
 * When both prior and current PDFs are present, run the Roster Comparison Engine
 * (set-diff) and optionally emit the initial New Inmate Report immediately
 * (before any CSV).
 *
 * "New" for the report = on current PDF ∧ not on prior PDF — not repository
 * first appearance. That matches manual investigator comparison.
 */
export async function finalizePdfComparison(args: {
  caseId: string;
  userId?: string | null;
  autoReport?: boolean;
}): Promise<{ caseId: string; status: string }> {
  const daily = await prisma.inmateDailyCase.findUnique({ where: { caseId: args.caseId } });
  if (!daily) return { caseId: args.caseId, status: 'missing' };

  if (!daily.priorPdfBatchId || !daily.currentPdfBatchId) {
    return { caseId: daily.caseId, status: daily.status };
  }

  const { compareRosterBatches } = await import('./rosterComparison.js');
  const comparison = await compareRosterBatches({
    priorBatchId: daily.priorPdfBatchId,
    currentBatchId: daily.currentPdfBatchId,
  });

  // Persist a durable comparison snapshot for operators / diagnostics.
  const reportable = comparison.counts.new + comparison.counts.returning;
  const comparisonRow = await prisma.inmateBatchComparison.upsert({
    where: {
      baselineBatchId_currentBatchId: {
        baselineBatchId: daily.priorPdfBatchId,
        currentBatchId: daily.currentPdfBatchId,
      },
    },
    create: {
      facility: daily.facility,
      baselineBatchId: daily.priorPdfBatchId,
      currentBatchId: daily.currentPdfBatchId,
      baselineRosterDate: daily.priorRosterDate,
      currentRosterDate: daily.currentRosterDate,
      newInmates: reportable,
      returns: comparison.counts.returning,
      departures: comparison.departed.length,
      detail: {
        engine: 'roster_set_diff',
        counts: comparison.counts,
        reconcileOk: comparison.reconcileOk,
        newInmateNames: comparison.newInmateNames,
        departed: comparison.departed.slice(0, 500),
        current: comparison.current.slice(0, 500).map((r) => ({
          name: r.name,
          disposition: r.disposition,
          why: r.why,
          bookingId: r.bookingId,
          inmateId: r.inmateId,
        })),
      } as object,
      detailTruncated: comparison.current.length > 500,
      generatedById: args.userId ?? null,
    },
    update: {
      newInmates: reportable,
      returns: comparison.counts.returning,
      departures: comparison.departed.length,
      detail: {
        engine: 'roster_set_diff',
        counts: comparison.counts,
        reconcileOk: comparison.reconcileOk,
        newInmateNames: comparison.newInmateNames,
        departed: comparison.departed.slice(0, 500),
        current: comparison.current.slice(0, 500).map((r) => ({
          name: r.name,
          disposition: r.disposition,
          why: r.why,
          bookingId: r.bookingId,
          inmateId: r.inmateId,
        })),
      } as object,
      detailTruncated: comparison.current.length > 500,
      generatedById: args.userId ?? null,
    },
  });

  let status: DailyCaseStatus = 'compared';
  await appendAudit(daily.caseId, {
    at: new Date().toISOString(),
    kind: 'pdf_compared',
    detail:
      `Roster set-diff prior ${daily.priorPdfBatchId} vs current ${daily.currentPdfBatchId}: ` +
      `new=${comparison.counts.new} returning=${comparison.counts.returning} ` +
      `existing=${comparison.counts.existing} review=${comparison.counts.review} ` +
      `reconcileOk=${comparison.reconcileOk}`,
    actorId: args.userId ?? null,
  }, {
    status,
    comparisonId: comparisonRow.comparisonId,
    newInmateCount: reportable,
    returningInmateCount: comparison.counts.returning,
    existingInmateCount: comparison.counts.existing,
    reviewCount: comparison.counts.review,
  });

  if (args.autoReport !== false && !daily.initialReportId) {
    const ops = daily.opsDate.toISOString().slice(0, 10);
    const next = (() => {
      const d = dayStart(ops);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    })();
    try {
      const report = await generateAndPersistReport(
        {
          facility: daily.facility,
          from: ops,
          to: next,
          priorBatchId: daily.priorPdfBatchId,
          currentBatchId: daily.currentPdfBatchId,
        },
        args.userId ?? 'daily-case',
      );
      status = 'report_ready';
      await prisma.inmateDailyCase.update({
        where: { caseId: daily.caseId },
        data: {
          initialReportId: report.reportId,
          newInmateCount: report.rowCount,
          returningInmateCount: comparison.counts.returning,
          existingInmateCount: comparison.counts.existing,
          reviewCount: comparison.counts.review,
          comparisonId: comparisonRow.comparisonId,
          status,
        },
      });
      await appendAudit(daily.caseId, {
        at: new Date().toISOString(),
        kind: 'initial_report',
        detail:
          `Initial New Inmate Report ${report.reportId} (${report.rowCount} rows) ` +
          `via roster set-diff — before CSV enrichment`,
        actorId: args.userId ?? null,
      });
    } catch (err) {
      await appendAudit(daily.caseId, {
        at: new Date().toISOString(),
        kind: 'initial_report_failed',
        detail: err instanceof Error ? err.message : String(err),
        actorId: args.userId ?? null,
      });
    }
  }

  const refreshed = await prisma.inmateDailyCase.findUnique({ where: { caseId: daily.caseId } });
  return { caseId: daily.caseId, status: refreshed?.status ?? status };
}

export async function listDailyCases(args: {
  facility?: string;
  limit?: number;
  offset?: number;
}) {
  const where = args.facility ? { facility: args.facility } : {};
  const [total, rows] = await Promise.all([
    prisma.inmateDailyCase.count({ where }),
    prisma.inmateDailyCase.findMany({
      where,
      orderBy: { opsDate: 'desc' },
      take: args.limit ?? 30,
      skip: args.offset ?? 0,
    }),
  ]);
  return { total, cases: rows.map(viewDailyCase) };
}

export async function getDailyCase(caseId: string) {
  const row = await prisma.inmateDailyCase.findUnique({ where: { caseId } });
  return row ? viewDailyCase(row) : null;
}

export async function getDailyCaseByDate(facility: string, opsDate: string) {
  const row = await prisma.inmateDailyCase.findUnique({
    where: { facility_opsDate: { facility, opsDate: dayStart(opsDate) } },
  });
  return row ? viewDailyCase(row) : null;
}

function viewDailyCase(row: {
  caseId: string;
  facility: string;
  opsDate: Date;
  status: string;
  priorRosterDate: Date | null;
  currentRosterDate: Date | null;
  priorPdfUploadId: string | null;
  priorPdfBatchId: string | null;
  currentPdfUploadId: string | null;
  currentPdfBatchId: string | null;
  csvUploadId: string | null;
  csvBatchId: string | null;
  initialReportId: string | null;
  enrichedReportId: string | null;
  comparisonId: string | null;
  newInmateCount: number;
  returningInmateCount: number;
  existingInmateCount: number;
  exceptionCount: number;
  reviewCount: number;
  auditLog: unknown;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}) {
  return {
    caseId: row.caseId,
    facility: row.facility,
    opsDate: row.opsDate.toISOString().slice(0, 10),
    status: row.status,
    priorRosterDate: row.priorRosterDate?.toISOString().slice(0, 10) ?? null,
    currentRosterDate: row.currentRosterDate?.toISOString().slice(0, 10) ?? null,
    priorPdfUploadId: row.priorPdfUploadId,
    priorPdfBatchId: row.priorPdfBatchId,
    currentPdfUploadId: row.currentPdfUploadId,
    currentPdfBatchId: row.currentPdfBatchId,
    csvUploadId: row.csvUploadId,
    csvBatchId: row.csvBatchId,
    initialReportId: row.initialReportId,
    enrichedReportId: row.enrichedReportId,
    comparisonId: row.comparisonId,
    results: {
      newInmates: row.newInmateCount,
      returningInmates: row.returningInmateCount,
      existingInmates: row.existingInmateCount,
      exceptions: row.exceptionCount,
      review: row.reviewCount,
    },
    auditLog: asAudit(row.auditLog),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}

/** True when a completed PDF batch exists for facility + roster date (PDF primary present). */
export async function pdfPrimaryExists(facility: string, rosterDate: string): Promise<boolean> {
  const start = dayStart(rosterDate);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const found = await prisma.inmateIngestionBatch.findFirst({
    where: {
      facility,
      status: 'completed',
      sourceType: { in: ['pdf_text', 'pdf_ocr'] },
      rosterDate: { gte: start, lt: end },
    },
    select: { batchId: true },
  });
  return Boolean(found);
}
