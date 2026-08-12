// ============================================================================
// No silent failure — conditions that could change the morning report
// must appear on the Morning Operations Dashboard (Engineering Law #0).
// ============================================================================

import prisma from '../../lib/prisma.js';
import type { OperationalAlert } from './truthCategories.js';

function dayStart(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

/**
 * Collect prominent operational alerts for the morning board.
 * Prefer operator language. Never bury these in logs alone.
 */
export async function collectMorningAlerts(args: {
  facility: string;
  opsDate: string;
  selfVerification?: {
    provisional: boolean;
    failedCount: number;
    unknownCount: number;
    checks: { id: string; question: string; verdict: string; detail: string }[];
  } | null;
  reconcileOk?: boolean | null;
  openLearningQueueItems?: number;
  reviewCount?: number;
}): Promise<OperationalAlert[]> {
  const alerts: OperationalAlert[] = [];
  const opsStart = dayStart(args.opsDate);
  const opsEnd = new Date(opsStart.getTime() + 86_400_000);
  const weekAgo = new Date(opsStart.getTime() - 7 * 86_400_000);

  // Self-verification failures / UNKNOWN
  if (args.selfVerification?.provisional) {
    for (const c of args.selfVerification.checks) {
      if (c.verdict === 'fail' || c.verdict === 'unknown') {
        alerts.push({
          id: `self_${c.id}`,
          severity: c.verdict === 'fail' ? 'critical' : 'warning',
          message: `${c.question} — ${c.detail}`,
          href: '/admin/intelligence',
        });
      }
    }
  }

  // Reconciliation
  if (args.reconcileOk === false) {
    alerts.push({
      id: 'reconciliation_failed',
      severity: 'critical',
      message:
        'Reconciliation failed: New + Existing + Returning + Review does not equal the roster total. '
        + 'Do not treat the report as complete.',
      href: '/admin/intelligence/daily-difference',
    });
  }

  // Today's batch health
  const todayBatch = await prisma.inmateIngestionBatch.findFirst({
    where: {
      facility: args.facility,
      status: { in: ['completed', 'failed'] },
      sourceType: { in: ['pdf_text', 'pdf_ocr'] },
      rosterDate: { gte: opsStart, lt: opsEnd },
    },
    orderBy: { finishedAt: 'desc' },
    select: {
      batchId: true,
      status: true,
      sourceType: true,
      parserConfidence: true,
      parserProfileId: true,
      parserVersion: true,
      recordsFailed: true,
      recordsForReview: true,
    },
  });

  if (todayBatch?.status === 'failed') {
    alerts.push({
      id: 'batch_failed',
      severity: 'critical',
      message: "Today's PDF import failed. Open Import History before trusting any new-inmate counts.",
      href: '/admin/intelligence/console',
    });
  }

  if (todayBatch?.sourceType === 'pdf_ocr') {
    const conf = todayBatch.parserConfidence;
    alerts.push({
      id: 'ocr_used',
      severity: conf != null && conf < 70 ? 'critical' : 'warning',
      message:
        conf != null && conf < 70
          ? `OCR confidence dropped to ${conf}% — verify names against the source PDF before acting.`
          : `Today's roster was read with OCR (confidence ${conf ?? 'UNKNOWN'}%). Verify uncertain names against the PDF.`,
      href: '/admin/intelligence/upload',
    });
  } else if (todayBatch?.parserConfidence != null && todayBatch.parserConfidence < 70) {
    alerts.push({
      id: 'parser_confidence_low',
      severity: 'warning',
      message:
        `Parser confidence is ${todayBatch.parserConfidence}% (under 70%). `
        + 'The county may have changed a column — run Import Inspection.',
      href: '/admin/intelligence/upload',
    });
  }

  if (todayBatch && !todayBatch.parserProfileId) {
    alerts.push({
      id: 'parser_profile_missing',
      severity: 'warning',
      message:
        "Today's import ran without a published parser profile. "
        + 'Publish a profile so future imports can be reprocessed if the mapping changes.',
      href: '/admin/intelligence/console',
    });
  }

  // Snapshot / parse validation issues for today
  try {
    const snap = await prisma.inmateRosterSnapshot.findFirst({
      where: {
        facility: args.facility,
        rosterDate: opsStart,
      },
      orderBy: { extractedAt: 'desc' },
      select: { validationOk: true, validationErrors: true, pageCount: true, inmateCount: true },
    });
    if (snap && snap.validationOk === false) {
      const errs = Array.isArray(snap.validationErrors)
        ? (snap.validationErrors as unknown[]).slice(0, 3).map(String).join('; ')
        : 'validation errors present';
      alerts.push({
        id: 'parse_validation_failed',
        severity: 'critical',
        message: `Roster parse validation failed — ${errs}. Do not certify until fixed.`,
        href: '/admin/intelligence/daily-difference',
      });
    }
  } catch {
    /* snapshot table may be absent on older hosts */
  }

  // Identity / review queue — review is a feature, but must be visible
  const reviewCount = args.reviewCount ?? todayBatch?.recordsForReview ?? 0;
  if (reviewCount > 0) {
    alerts.push({
      id: 'human_review_pending',
      severity: 'info',
      message:
        `${reviewCount} record(s) routed to human review. `
        + 'This preserves truth when evidence is insufficient — it is not a silent failure.',
      href: '/admin/intelligence/review',
    });
  }

  if ((args.openLearningQueueItems ?? 0) > 0) {
    alerts.push({
      id: 'learning_queue_open',
      severity: 'warning',
      message:
        `${args.openLearningQueueItems} open Learning Queue item(s). `
        + 'Fix each discrepancy and add it to the certification corpus so it never surprises NIIS twice.',
      href: '/admin/intelligence/learning-queue',
    });
  }

  // Recent low-confidence imports (county format drift)
  const lowConfWeek = await prisma.inmateIngestionBatch.count({
    where: {
      facility: args.facility,
      finishedAt: { gte: weekAgo },
      parserConfidence: { lt: 70 },
      status: 'completed',
    },
  });
  if (lowConfWeek > 0 && !alerts.some((a) => a.id === 'parser_confidence_low' || a.id === 'ocr_used')) {
    alerts.push({
      id: 'low_confidence_week',
      severity: 'warning',
      message:
        `${lowConfWeek} import(s) in the last week read under 70% parser confidence. `
        + 'Check whether Sacramento changed the roster layout.',
      href: '/admin/intelligence/console',
    });
  }

  // Deduplicate by id, keep highest severity
  const rank: Record<OperationalAlertSeverity, number> = {
    critical: 3,
    warning: 2,
    info: 1,
  };
  const byId = new Map<string, OperationalAlert>();
  for (const a of alerts) {
    const prev = byId.get(a.id);
    if (!prev || rank[a.severity] > rank[prev.severity]) byId.set(a.id, a);
  }

  return [...byId.values()].sort((a, b) => rank[b.severity] - rank[a.severity]);
}
