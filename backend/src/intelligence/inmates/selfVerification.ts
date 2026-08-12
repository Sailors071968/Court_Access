// ============================================================================
// Self-verification — Zero Assumption Engineering Directive.
//
// After every daily run, NIIS attempts to disprove its own output.
// Uncertain answers force Provisional — never silent certification.
// ============================================================================

import prisma from '../../lib/prisma.js';
import { UNKNOWN, type KnownOrUnknown } from './unknown.js';
import { collectDailyStageMetrics } from './stageMetrics.js';
import { compareAgainstPriorSnapshot } from './rosterComparison.js';

export type CheckVerdict = 'pass' | 'fail' | 'unknown';

export interface SelfCheck {
  id: string;
  question: string;
  verdict: CheckVerdict;
  detail: string;
}

export interface SelfVerificationResult {
  facility: string;
  opsDate: string;
  /** True when any check is fail or unknown — report must not be silently certified. */
  provisional: boolean;
  checks: SelfCheck[];
  failedCount: number;
  unknownCount: number;
  passedCount: number;
}

export interface ReliabilityStreaks {
  daysSinceLastMissedNew: KnownOrUnknown<number>;
  daysSinceLastFalseNew: KnownOrUnknown<number>;
  lastMissedDate: KnownOrUnknown<string>;
  lastFalseNewDate: KnownOrUnknown<string>;
  evidence: string;
}

function dayStart(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = dayStart(fromIso).getTime();
  const b = dayStart(toIso).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * The dashboard metrics that matter more than feature count.
 * Insufficient history → UNKNOWN (never invent a streak).
 */
export async function reliabilityStreaks(
  facility: string,
  asOfDate = new Date().toISOString().slice(0, 10),
): Promise<ReliabilityStreaks> {
  const [lastMiss, lastFalse, anyCert] = await Promise.all([
    prisma.inmateLearningQueueItem.findFirst({
      where: { facility, errorType: 'missed_new' },
      orderBy: { opsDate: 'desc' },
      select: { opsDate: true },
    }),
    prisma.inmateLearningQueueItem.findFirst({
      where: { facility, errorType: 'false_new' },
      orderBy: { opsDate: 'desc' },
      select: { opsDate: true },
    }),
    prisma.inmateDailyCertification.findFirst({
      where: { facility, isCurrent: true },
      select: { certificationId: true },
    }),
  ]);

  // Also consult certification rows that recorded misses/extras without queue items.
  const [certMiss, certFalse] = await Promise.all([
    prisma.inmateDailyCertification.findFirst({
      where: {
        facility,
        isCurrent: true,
        OR: [
          { potentialClientsMissed: { gt: 0 } },
          { recall: { lt: 1 } },
        ],
      },
      orderBy: { opsDate: 'desc' },
      select: { opsDate: true },
    }),
    prisma.inmateDailyCertification.findFirst({
      where: {
        facility,
        isCurrent: true,
        OR: [
          { precision: { lt: 1 } },
        ],
      },
      orderBy: { opsDate: 'desc' },
      select: { opsDate: true },
    }),
  ]);

  if (!anyCert && !lastMiss && !lastFalse) {
    return {
      daysSinceLastMissedNew: UNKNOWN,
      daysSinceLastFalseNew: UNKNOWN,
      lastMissedDate: UNKNOWN,
      lastFalseNewDate: UNKNOWN,
      evidence:
        'No Sacramento daily certifications or Learning Queue discrepancies recorded yet. '
        + 'Streaks are UNKNOWN until investigator ground truth exists.',
    };
  }

  const missDate = newerDate(lastMiss?.opsDate, certMiss?.opsDate);
  const falseDate = newerDate(lastFalse?.opsDate, certFalse?.opsDate);

  return {
    daysSinceLastMissedNew: missDate
      ? daysBetween(missDate, asOfDate)
      : (anyCert ? daysBetween(await earliestCertDate(facility) ?? asOfDate, asOfDate) : UNKNOWN),
    daysSinceLastFalseNew: falseDate
      ? daysBetween(falseDate, asOfDate)
      : (anyCert ? daysBetween(await earliestCertDate(facility) ?? asOfDate, asOfDate) : UNKNOWN),
    lastMissedDate: missDate ?? UNKNOWN,
    lastFalseNewDate: falseDate ?? UNKNOWN,
    evidence: [
      `asOf=${asOfDate}`,
      `lastMissed=${missDate ?? 'none-recorded'}`,
      `lastFalseNew=${falseDate ?? 'none-recorded'}`,
    ].join('; '),
  };
}

function newerDate(a?: Date | null, b?: Date | null): string | null {
  if (!a && !b) return null;
  if (!a) return b!.toISOString().slice(0, 10);
  if (!b) return a.toISOString().slice(0, 10);
  return (a >= b ? a : b).toISOString().slice(0, 10);
}

async function earliestCertDate(facility: string): Promise<string | null> {
  const row = await prisma.inmateDailyCertification.findFirst({
    where: { facility },
    orderBy: { opsDate: 'asc' },
    select: { opsDate: true },
  });
  return row?.opsDate.toISOString().slice(0, 10) ?? null;
}

/**
 * Attempt to disprove today's NIIS output. Any fail/unknown → provisional.
 */
export async function runSelfVerification(args: {
  facility: string;
  opsDate: string;
  currentBatchId?: string | null;
  priorBatchId?: string | null;
}): Promise<SelfVerificationResult> {
  const checks: SelfCheck[] = [];
  const metrics = await collectDailyStageMetrics({
    facility: args.facility,
    opsDate: args.opsDate,
    currentBatchId: args.currentBatchId,
  });

  // 1. Did every PDF page parse?
  if (metrics.parser.pagesSkipped === UNKNOWN || metrics.parser.pagesProcessed === UNKNOWN) {
    checks.push({
      id: 'pages_parsed',
      question: 'Did every PDF page parse?',
      verdict: 'unknown',
      detail: 'Page/skip metrics unavailable (UNKNOWN).',
    });
  } else if (metrics.parser.pagesSkipped > 0) {
    checks.push({
      id: 'pages_parsed',
      question: 'Did every PDF page parse?',
      verdict: 'fail',
      detail: `${metrics.parser.pagesSkipped} page(s) skipped.`,
    });
  } else {
    checks.push({
      id: 'pages_parsed',
      question: 'Did every PDF page parse?',
      verdict: 'pass',
      detail: `${metrics.parser.pagesProcessed} page(s) processed, 0 skipped.`,
    });
  }

  // 2. Did inmate counts reconcile?
  if (metrics.comparison.reconcileOk === UNKNOWN) {
    checks.push({
      id: 'reconcile',
      question: 'Did inmate counts reconcile?',
      verdict: 'unknown',
      detail: 'Reconciliation result UNKNOWN.',
    });
  } else if (metrics.comparison.reconcileOk === false) {
    checks.push({
      id: 'reconcile',
      question: 'Did inmate counts reconcile?',
      verdict: 'fail',
      detail: 'NEW+EXISTING+RETURNING+REVIEW ≠ extracted total.',
    });
  } else {
    checks.push({
      id: 'reconcile',
      question: 'Did inmate counts reconcile?',
      verdict: 'pass',
      detail: 'Disposition totals reconcile.',
    });
  }

  // 3. Alphabetical ordering
  const snap = await prisma.inmateRosterSnapshot.findFirst({
    where: {
      facility: args.facility,
      rosterDate: dayStart(args.opsDate),
    },
    orderBy: { extractedAt: 'desc' },
    select: { validationOk: true, validationErrors: true },
  });
  const valErrs = (snap?.validationErrors ?? {}) as {
    errors?: { code?: string }[];
  };
  const alphaBroken = valErrs.errors?.some((e) => e.code === 'alphabetical_order_broken');
  if (!snap) {
    checks.push({
      id: 'alphabetical',
      question: 'Did alphabetical ordering unexpectedly change?',
      verdict: 'unknown',
      detail: 'No canonical snapshot for today (UNKNOWN).',
    });
  } else if (alphaBroken) {
    checks.push({
      id: 'alphabetical',
      question: 'Did alphabetical ordering unexpectedly change?',
      verdict: 'fail',
      detail: 'Source extraction was not alphabetical.',
    });
  } else {
    checks.push({
      id: 'alphabetical',
      question: 'Did alphabetical ordering unexpectedly change?',
      verdict: 'pass',
      detail: 'Alphabetical order validated.',
    });
  }

  // 4. OCR confidence
  if (metrics.parser.ocrUsed === true) {
    if (metrics.parser.extractionConfidenceAvg === UNKNOWN) {
      checks.push({
        id: 'ocr_confidence',
        question: 'Did OCR confidence fall?',
        verdict: 'unknown',
        detail: 'OCR used but average confidence UNKNOWN.',
      });
    } else if (metrics.parser.extractionConfidenceAvg < 70) {
      checks.push({
        id: 'ocr_confidence',
        question: 'Did OCR confidence fall?',
        verdict: 'fail',
        detail: `Average extraction confidence ${metrics.parser.extractionConfidenceAvg}% < 70%.`,
      });
    } else {
      checks.push({
        id: 'ocr_confidence',
        question: 'Did OCR confidence fall?',
        verdict: 'pass',
        detail: `Average extraction confidence ${metrics.parser.extractionConfidenceAvg}%.`,
      });
    }
  } else if (metrics.parser.ocrUsed === UNKNOWN) {
    checks.push({
      id: 'ocr_confidence',
      question: 'Did OCR confidence fall?',
      verdict: 'unknown',
      detail: 'OCR usage UNKNOWN.',
    });
  } else {
    checks.push({
      id: 'ocr_confidence',
      question: 'Did OCR confidence fall?',
      verdict: 'pass',
      detail: 'Text-layer extract (OCR not used).',
    });
  }

  // 5. Record-count deviation vs recent days
  const recent = await prisma.inmateRosterSnapshot.findMany({
    where: {
      facility: args.facility,
      status: { in: ['validated', 'certified'] },
      rosterDate: { lt: dayStart(args.opsDate) },
    },
    orderBy: { rosterDate: 'desc' },
    take: 5,
    select: { inmateCount: true, rosterDate: true },
  });
  const todayCount = metrics.parser.recordsExtracted;
  if (todayCount === UNKNOWN || recent.length === 0) {
    checks.push({
      id: 'count_deviation',
      question: 'Did record counts deviate significantly from recent days?',
      verdict: 'unknown',
      detail: recent.length === 0
        ? 'No recent certified/validated snapshots for baseline (UNKNOWN).'
        : 'Today\'s extracted count UNKNOWN.',
    });
  } else {
    const avg = recent.reduce((s, r) => s + r.inmateCount, 0) / recent.length;
    const delta = Math.abs(todayCount - avg) / Math.max(avg, 1);
    if (delta > 0.35) {
      checks.push({
        id: 'count_deviation',
        question: 'Did record counts deviate significantly from recent days?',
        verdict: 'fail',
        detail: `Today ${todayCount} vs recent avg ${avg.toFixed(0)} (${(delta * 100).toFixed(0)}% deviation).`,
      });
    } else {
      checks.push({
        id: 'count_deviation',
        question: 'Did record counts deviate significantly from recent days?',
        verdict: 'pass',
        detail: `Today ${todayCount} vs recent avg ${avg.toFixed(0)}.`,
      });
    }
  }

  // 6. Unclassified / failed classification
  if (metrics.comparison.unclassified === UNKNOWN) {
    checks.push({
      id: 'classification',
      question: 'Did any inmate fail classification?',
      verdict: 'unknown',
      detail: 'Unclassified count UNKNOWN.',
    });
  } else if (
    metrics.comparison.unclassified > 0
    || (metrics.identity.failedResolutions !== UNKNOWN && metrics.identity.failedResolutions > 0)
  ) {
    const failed = metrics.identity.failedResolutions === UNKNOWN
      ? 0
      : metrics.identity.failedResolutions;
    checks.push({
      id: 'classification',
      question: 'Did any inmate fail classification?',
      verdict: 'fail',
      detail: `unclassified=${metrics.comparison.unclassified} failed=${failed}`,
    });
  } else {
    checks.push({
      id: 'classification',
      question: 'Did any inmate fail classification?',
      verdict: 'pass',
      detail: 'No unclassified or failed dispositions.',
    });
  }

  // 7. Every "new" has no match on prior certified roster
  if (args.currentBatchId) {
    try {
      const diff = await compareAgainstPriorSnapshot({
        facility: args.facility,
        opsDate: args.opsDate,
        currentBatchId: args.currentBatchId,
        fallbackPriorBatchId: args.priorBatchId,
      });
      const badNews = diff.current.filter((r) => r.disposition === 'new' && r.onPrior);
      if (badNews.length > 0) {
        checks.push({
          id: 'new_absent_yesterday',
          question: 'Did every "new" inmate truly have no match on the prior certified roster?',
          verdict: 'fail',
          detail: `${badNews.length} "new" row(s) matched the prior roster.`,
        });
      } else if (diff.baselineSource === 'prior_batch_fallback') {
        checks.push({
          id: 'new_absent_yesterday',
          question: 'Did every "new" inmate truly have no match on the prior certified roster?',
          verdict: 'unknown',
          detail: 'Compared against prior PDF batch fallback — certified snapshot missing (UNKNOWN trust).',
        });
      } else {
        checks.push({
          id: 'new_absent_yesterday',
          question: 'Did every "new" inmate truly have no match on the prior certified roster?',
          verdict: 'pass',
          detail: `All ${diff.counts.new + diff.counts.returning} reportable new/returning absent from ${diff.baselineSource}.`,
        });
      }
    } catch (err) {
      checks.push({
        id: 'new_absent_yesterday',
        question: 'Did every "new" inmate truly have no match on the prior certified roster?',
        verdict: 'unknown',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    checks.push({
      id: 'new_absent_yesterday',
      question: 'Did every "new" inmate truly have no match on the prior certified roster?',
      verdict: 'unknown',
      detail: 'No current batch id — cannot verify (UNKNOWN).',
    });
  }

  const failedCount = checks.filter((c) => c.verdict === 'fail').length;
  const unknownCount = checks.filter((c) => c.verdict === 'unknown').length;
  const passedCount = checks.filter((c) => c.verdict === 'pass').length;

  return {
    facility: args.facility,
    opsDate: args.opsDate.slice(0, 10),
    provisional: failedCount > 0 || unknownCount > 0,
    checks,
    failedCount,
    unknownCount,
    passedCount,
  };
}
