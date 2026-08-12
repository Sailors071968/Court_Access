// ============================================================================
// Per-stage metrics — Zero Assumption Engineering Directive.
// Each stage publishes measurable evidence. Missing data is UNKNOWN.
// ============================================================================

import prisma from '../../lib/prisma.js';
import { UNKNOWN, type KnownOrUnknown } from './unknown.js';

export interface ParserStageMetrics {
  pagesProcessed: KnownOrUnknown<number>;
  recordsExtracted: KnownOrUnknown<number>;
  pagesSkipped: KnownOrUnknown<number>;
  extractionConfidenceAvg: KnownOrUnknown<number>;
  ocrUsed: KnownOrUnknown<boolean>;
}

export interface IdentityStageMetrics {
  exactMatches: KnownOrUnknown<number>;
  aliasMatches: KnownOrUnknown<number>;
  fuzzyCandidates: KnownOrUnknown<number>;
  reviewCandidates: KnownOrUnknown<number>;
  mergeDecisions: KnownOrUnknown<number>;
  newInmateResolutions: KnownOrUnknown<number>;
  failedResolutions: KnownOrUnknown<number>;
}

export interface ComparisonStageMetrics {
  previousRosterSize: KnownOrUnknown<number>;
  currentRosterSize: KnownOrUnknown<number>;
  newInmates: KnownOrUnknown<number>;
  existingInmates: KnownOrUnknown<number>;
  returningInmates: KnownOrUnknown<number>;
  review: KnownOrUnknown<number>;
  unclassified: KnownOrUnknown<number>;
  baselineSource: KnownOrUnknown<string>;
  reconcileOk: KnownOrUnknown<boolean>;
}

export interface CertificationStageMetrics {
  precision: KnownOrUnknown<number>;
  recall: KnownOrUnknown<number>;
  falsePositives: KnownOrUnknown<number>;
  falseNegatives: KnownOrUnknown<number>;
  reconciliation: KnownOrUnknown<boolean>;
  status: KnownOrUnknown<string>;
}

export interface DailyStageMetrics {
  facility: string;
  opsDate: string;
  parser: ParserStageMetrics;
  identity: IdentityStageMetrics;
  comparison: ComparisonStageMetrics;
  certification: CertificationStageMetrics;
}

function num(value: number | null | undefined): KnownOrUnknown<number> {
  return value === null || value === undefined || !Number.isFinite(value) ? UNKNOWN : value;
}

function bool(value: boolean | null | undefined): KnownOrUnknown<boolean> {
  return value === null || value === undefined ? UNKNOWN : value;
}

function str(value: string | null | undefined): KnownOrUnknown<string> {
  return value === null || value === undefined || value === '' ? UNKNOWN : value;
}

/**
 * Collect stage metrics for an ops day. Any unavailable figure is UNKNOWN.
 */
export async function collectDailyStageMetrics(args: {
  facility: string;
  opsDate: string;
  currentBatchId?: string | null;
}): Promise<DailyStageMetrics> {
  const opsStart = new Date(`${args.opsDate.slice(0, 10)}T00:00:00.000Z`);
  const opsEnd = new Date(opsStart.getTime() + 86_400_000);

  const [batch, cert, dailyCase, comparison] = await Promise.all([
    args.currentBatchId
      ? prisma.inmateIngestionBatch.findUnique({
          where: { batchId: args.currentBatchId },
          include: { document: true },
        })
      : prisma.inmateIngestionBatch.findFirst({
          where: {
            facility: args.facility,
            status: 'completed',
            sourceType: { in: ['pdf_text', 'pdf_ocr'] },
            rosterDate: { gte: opsStart, lt: opsEnd },
          },
          orderBy: { finishedAt: 'desc' },
          include: { document: true },
        }),
    prisma.inmateDailyCertification.findUnique({
      where: {
        facility_opsDate: { facility: args.facility, opsDate: opsStart },
      },
    }),
    prisma.inmateDailyCase.findUnique({
      where: {
        facility_opsDate: { facility: args.facility, opsDate: opsStart },
      },
    }),
    prisma.inmateBatchComparison.findFirst({
      where: {
        facility: args.facility,
        currentRosterDate: { gte: opsStart, lt: opsEnd },
      },
      orderBy: { generatedAt: 'desc' },
    }),
  ]);

  let parser: ParserStageMetrics = {
    pagesProcessed: UNKNOWN,
    recordsExtracted: UNKNOWN,
    pagesSkipped: UNKNOWN,
    extractionConfidenceAvg: UNKNOWN,
    ocrUsed: UNKNOWN,
  };

  let identity: IdentityStageMetrics = {
    exactMatches: UNKNOWN,
    aliasMatches: UNKNOWN,
    fuzzyCandidates: UNKNOWN,
    reviewCandidates: UNKNOWN,
    mergeDecisions: UNKNOWN,
    newInmateResolutions: UNKNOWN,
    failedResolutions: UNKNOWN,
  };

  if (batch) {
    const stats = (batch.extractionStats ?? {}) as {
      pageCount?: number;
      emptyPages?: number[];
      ocrUsed?: boolean;
    };
    const empty = stats.emptyPages?.length ?? null;
    parser = {
      pagesProcessed: num(stats.pageCount ?? batch.document?.pageCount ?? null),
      recordsExtracted: num(batch.recordsTotal),
      pagesSkipped: empty === null ? UNKNOWN : empty,
      extractionConfidenceAvg: num(
        batch.parserConfidence != null ? batch.parserConfidence : null,
      ),
      ocrUsed: bool(stats.ocrUsed ?? (batch.sourceType === 'pdf_ocr' ? true : null)),
    };

    const records = await prisma.inmateIngestionRecord.groupBy({
      by: ['resolution', 'matchTier'],
      where: { batchId: batch.batchId },
      _count: { recordId: true },
    });

    let exact = 0;
    let alias = 0;
    let fuzzy = 0;
    let review = 0;
    let merge = 0;
    let news = 0;
    let failed = 0;
    for (const r of records) {
      const c = r._count.recordId;
      if (r.resolution === 'needs_review') review += c;
      if (r.resolution === 'failed') failed += c;
      if (r.resolution === 'new_inmate') news += c;
      if (r.resolution === 'matched' || r.resolution === 'duplicate') merge += c;
      if (r.matchTier === 'exact_booking' || r.matchTier === 'exact_identity') exact += c;
      else if (r.matchTier === 'near_name' || r.matchTier === 'near_dob') fuzzy += c;
      else if (r.matchTier === 'alias') alias += c;
    }

    identity = {
      exactMatches: exact,
      aliasMatches: alias,
      fuzzyCandidates: fuzzy,
      reviewCandidates: review,
      mergeDecisions: merge,
      newInmateResolutions: news,
      failedResolutions: failed,
    };
  }

  const detail = (comparison?.detail ?? {}) as {
    engine?: string;
    counts?: Record<string, number>;
    reconcileOk?: boolean;
  };

  const comparisonMetrics: ComparisonStageMetrics = {
    previousRosterSize: UNKNOWN,
    currentRosterSize: num(cert?.currentInmateCount ?? batch?.recordsTotal ?? null),
    newInmates: num(
      detail.counts?.new ?? cert?.newInmateCount ?? dailyCase?.newInmateCount ?? comparison?.newInmates ?? null,
    ),
    existingInmates: num(
      detail.counts?.existing ?? cert?.existingInmateCount ?? dailyCase?.existingInmateCount ?? null,
    ),
    returningInmates: num(
      detail.counts?.returning ?? cert?.returningInmateCount ?? dailyCase?.returningInmateCount ?? null,
    ),
    review: num(detail.counts?.review ?? cert?.reviewCount ?? dailyCase?.reviewCount ?? null),
    unclassified: num(detail.counts?.unclassified ?? null),
    baselineSource: str(detail.engine ?? null),
    reconcileOk: bool(detail.reconcileOk ?? cert?.reconcileOk ?? null),
  };

  // Prior size from snapshot when available.
  const priorSnap = await prisma.inmateRosterSnapshot.findFirst({
    where: {
      facility: args.facility,
      rosterDate: {
        gte: new Date(opsStart.getTime() - 86_400_000),
        lt: opsStart,
      },
      status: { in: ['validated', 'certified'] },
    },
    orderBy: { validatedAt: 'desc' },
    select: { inmateCount: true },
  });
  if (priorSnap) {
    comparisonMetrics.previousRosterSize = priorSnap.inmateCount;
  } else if (cert?.priorInmateCount != null) {
    comparisonMetrics.previousRosterSize = cert.priorInmateCount;
  }

  const fp = cert?.precision != null && cert?.newInmateCount != null && cert.precision < 1
    ? null // cannot derive exact FP without gold — leave UNKNOWN unless summary has it
    : cert?.precision === 1
      ? 0
      : null;
  const fn = cert?.potentialClientsMissed ?? null;

  const summary = (cert?.summary ?? {}) as {
    extras?: unknown[];
    misses?: unknown[];
  };

  const certification: CertificationStageMetrics = {
    precision: num(cert?.precision ?? null),
    recall: num(cert?.recall ?? null),
    falsePositives: num(
      summary.extras ? summary.extras.length : fp,
    ),
    falseNegatives: num(
      summary.misses ? summary.misses.length : fn,
    ),
    reconciliation: bool(cert?.reconcileOk ?? null),
    status: str(cert?.status ?? null),
  };

  return {
    facility: args.facility,
    opsDate: args.opsDate.slice(0, 10),
    parser,
    identity,
    comparison: comparisonMetrics,
    certification,
  };
}
