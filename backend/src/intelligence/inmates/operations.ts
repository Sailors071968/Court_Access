// ============================================================================
// The operations console: the morning summary, report approval, and batch comparison.
//
// This is the layer written for the person who does the import, not for the person who
// built the system. Every number here answers a question someone actually asks at 7am:
// did last night's roster arrive, is today's done, how many new people, is anything
// waiting for me.
//
// The morning summary in particular is deliberately opinionated. It does not present
// twelve equal figures; it leads with whether today's work is done, because that is the
// only question whose answer changes what the operator does next.
// ============================================================================

import prisma from '../../lib/prisma.js';
import { displayName } from './displayName.js';

const day = (date: Date | null | undefined): string | null =>
  date ? date.toISOString().slice(0, 10) : null;

const money = (cents: bigint | null | undefined): string | null =>
  cents === null || cents === undefined ? null : (Number(cents) / 100).toFixed(2);

// ---------------------------------------------------------------------------
// Morning Operations Summary
// ---------------------------------------------------------------------------

export interface MorningSummary {
  /** What the operator should do next, in one sentence. */
  headline: string;
  /** ok | attention | action_required — decides the colour, not the content. */
  posture: 'ok' | 'attention' | 'action_required';

  lastSuccessfulImport: {
    batchId: string;
    at: string;
    rosterDate: string | null;
    filename: string;
    operator: string | null;
    /** Hours since. The number that tells an operator whether a roster was missed. */
    hoursAgo: number;
  } | null;

  today: {
    date: string;
    /** True when a batch completed today. */
    processed: boolean;
    batchesStarted: number;
    batchesCompleted: number;
    batchesFailed: number;
    batchesInProgress: number;
    /** True when a roster dated today has been imported, which is not the same as a
     *  batch having run today — an operator may have imported yesterday's file. */
    todaysRosterImported: boolean;
  };

  intelligence: {
    newInmates: number;
    returningInmates: number;
    watchListMatches: number;
    unresolvedReviewItems: number;
    unresolvedConflicts: number;
    significantChanges: number;
  };

  /** Anything about the parser worth an operator's attention before they import again. */
  parserWarnings: {
    facility: string;
    sourceType: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }[];

  health: {
    /** ok | degraded | down */
    database: 'ok' | 'down';
    facilitiesConfigured: number;
    activeParserProfiles: number;
    /** Batches stuck in a non-terminal state for more than an hour. */
    stalledBatches: number;
    oldestUnresolvedReviewDays: number | null;
    repository: { people: number; bookings: number; observations: number };
  };

  /** Reports awaiting a decision. */
  reports: { draft: number; reviewed: number; approvedNotPrinted: number };
}

export async function getMorningSummary(): Promise<MorningSummary> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dayStart = new Date(`${today}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const anHourAgo = new Date(now.getTime() - 3_600_000);

  let databaseOk = true;
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
  } catch {
    databaseOk = false;
  }

  const [
    lastSuccess, todaysBatches, todaysRoster,
    facilities, profiles, stalled,
    people, bookings, observations,
    unresolvedReviews, oldestReview, unresolvedConflicts,
    reportsDraft, reportsReviewed, reportsApproved,
    fallbackBatches, lowConfidenceBatches,
  ] = await Promise.all([
    prisma.inmateIngestionBatch.findFirst({
      where: { status: 'completed' },
      orderBy: { finishedAt: 'desc' },
      select: { batchId: true, finishedAt: true, startedAt: true, rosterDate: true, sourceFilename: true, ingestedById: true },
    }),
    prisma.inmateIngestionBatch.findMany({
      where: { startedAt: { gte: dayStart, lt: dayEnd } },
      select: { batchId: true, status: true, lifecycleState: true },
    }),
    prisma.inmateIngestionBatch.count({
      where: { rosterDate: { gte: dayStart, lt: dayEnd }, status: 'completed' },
    }),
    prisma.inmateFacility.count({ where: { active: true } }),
    prisma.inmateParserProfile.count({ where: { active: true } }),
    prisma.inmateIngestionBatch.count({
      where: {
        lifecycleState: { notIn: ['completed', 'failed', 'cancelled'] },
        startedAt: { lt: anHourAgo },
      },
    }),
    prisma.inmate.count({ where: { mergedIntoId: null } }),
    prisma.inmateBooking.count(),
    prisma.inmateBookingObservation.count(),
    prisma.inmateReviewQueueItem.count({ where: { status: 'pending' } }),
    prisma.inmateReviewQueueItem.findFirst({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.inmateSourceConflict.count({ where: { resolution: 'unknown' } }),
    prisma.inmateIntelligenceReport.count({ where: { approvalState: 'draft' } }),
    prisma.inmateIntelligenceReport.count({ where: { approvalState: 'reviewed' } }),
    prisma.inmateIntelligenceReport.count({ where: { approvalState: 'approved' } }),
    // Imports that ran without a published profile: they worked, but their provenance
    // is weaker and they cannot be reprocessed against a corrected mapping.
    prisma.inmateIngestionBatch.count({
      where: { parserProfileId: null, startedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
    }),
    prisma.inmateIngestionBatch.count({
      where: { parserConfidence: { lt: 70 }, startedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
    }),
  ]);

  const batchIdsToday = todaysBatches.map((b) => b.batchId);
  const [newToday, returningToday, watchToday, changesToday] = await Promise.all([
    batchIdsToday.length
      ? prisma.inmateBooking.count({ where: { sourceBatchId: { in: batchIdsToday }, isFirstAppearance: true } })
      : 0,
    batchIdsToday.length
      ? prisma.inmateBooking.count({ where: { sourceBatchId: { in: batchIdsToday }, isFirstAppearance: false } })
      : 0,
    batchIdsToday.length
      ? prisma.inmateWatchListMatch.count({ where: { batchId: { in: batchIdsToday } } })
      : 0,
    batchIdsToday.length
      ? prisma.inmateChangeEvent.count({ where: { batchId: { in: batchIdsToday }, material: true } })
      : 0,
  ]);

  const completedToday = todaysBatches.filter((b) => b.status === 'completed').length;
  const failedToday = todaysBatches.filter((b) => b.status === 'failed').length;
  const inProgress = todaysBatches.filter(
    (b) => !['completed', 'failed', 'cancelled'].includes(b.lifecycleState),
  ).length;

  const lastAt = lastSuccess?.finishedAt ?? lastSuccess?.startedAt ?? null;
  const hoursAgo = lastAt ? Math.floor((now.getTime() - lastAt.getTime()) / 3_600_000) : 0;

  const parserWarnings: MorningSummary['parserWarnings'] = [];
  if (profiles === 0) {
    parserWarnings.push({
      facility: 'all', sourceType: 'all', severity: 'error',
      message: 'No parser profile is published. Imports fall back to the compiled-in map, record weaker provenance, and cannot be reprocessed against a corrected mapping.',
    });
  }
  if (fallbackBatches > 0) {
    parserWarnings.push({
      facility: 'all', sourceType: 'all', severity: 'warning',
      message: `${fallbackBatches} import(s) in the last week ran without a published profile. Publish one in Parser Mapping so future imports can be reprocessed.`,
    });
  }
  if (lowConfidenceBatches > 0) {
    parserWarnings.push({
      facility: 'all', sourceType: 'all', severity: 'warning',
      message: `${lowConfidenceBatches} import(s) in the last week read at under 70% parser confidence. Run Import Inspection on the next export — the county may have changed a column.`,
    });
  }

  // The headline. One sentence, chosen by what would change what the operator does.
  let headline: string;
  let posture: MorningSummary['posture'];

  if (!databaseOk) {
    headline = 'The database is not answering. Nothing can be imported until it is.';
    posture = 'action_required';
  } else if (failedToday > 0) {
    headline = `${failedToday} import(s) failed today. Open Import History for the reason before re-uploading.`;
    posture = 'action_required';
  } else if (inProgress > 0) {
    headline = `${inProgress} import(s) still processing. The numbers below will fill in as they finish.`;
    posture = 'attention';
  } else if (todaysRoster === 0 && completedToday === 0) {
    headline = hoursAgo >= 24
      ? `No roster has been imported for ${hoursAgo} hours. Today's Sacramento export has not been processed.`
      : "Today's Sacramento roster has not been imported yet.";
    posture = 'action_required';
  } else if (unresolvedReviews > 0) {
    headline = `Today's roster is processed. ${unresolvedReviews} record(s) need a decision — until they are decided their bookings do not exist in the repository.`;
    posture = 'attention';
  } else if (newToday > 0) {
    headline = `Today's roster is processed: ${newToday} newly booked, ${returningToday} returning${
      watchToday > 0 ? `, ${watchToday} watch list match(es)` : ''}. Nothing is waiting for you.`;
    posture = 'ok';
  } else {
    headline = "Today's roster is processed and nobody new was booked. Nothing is waiting for you.";
    posture = 'ok';
  }

  return {
    headline,
    posture,
    lastSuccessfulImport: lastSuccess && lastAt ? {
      batchId: lastSuccess.batchId,
      at: lastAt.toISOString(),
      rosterDate: day(lastSuccess.rosterDate),
      filename: lastSuccess.sourceFilename,
      operator: lastSuccess.ingestedById,
      hoursAgo,
    } : null,
    today: {
      date: today,
      processed: completedToday > 0,
      batchesStarted: todaysBatches.length,
      batchesCompleted: completedToday,
      batchesFailed: failedToday,
      batchesInProgress: inProgress,
      todaysRosterImported: todaysRoster > 0,
    },
    intelligence: {
      newInmates: newToday,
      returningInmates: returningToday,
      watchListMatches: watchToday,
      unresolvedReviewItems: unresolvedReviews,
      unresolvedConflicts,
      significantChanges: changesToday,
    },
    parserWarnings,
    health: {
      database: databaseOk ? 'ok' : 'down',
      facilitiesConfigured: facilities,
      activeParserProfiles: profiles,
      stalledBatches: stalled,
      oldestUnresolvedReviewDays: oldestReview
        ? Math.floor((now.getTime() - oldestReview.createdAt.getTime()) / 86_400_000)
        : null,
      repository: { people, bookings, observations },
    },
    reports: { draft: reportsDraft, reviewed: reportsReviewed, approvedNotPrinted: reportsApproved },
  };
}

// ---------------------------------------------------------------------------
// Morning Operations Board — seven questions, answered in one payload
// ---------------------------------------------------------------------------

export interface MorningOperationsBoard {
  opsDate: string;
  priorDate: string;
  facility: string;
  /** Engineering Law #0 north star. */
  northStar: string;
  /** One sentence: what to do next. */
  headline: string;
  posture: 'ok' | 'attention' | 'action_required';
  /**
   * Conditions that could change the report — never buried in logs.
   * Critical/warning/info; human review shown as info (review is a feature).
   */
  alerts: {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    href?: string;
  }[];
  questions: {
    todaysPdfUploaded: { answer: boolean; detail: string };
    yesterdaysRosterIdentified: { answer: boolean; detail: string };
    comparisonCompleted: { answer: boolean; detail: string };
    newInmatesFound: { answer: number; detail: string };
    requireManualReview: { answer: number; detail: string };
    reportCertification: {
      answer: 'certified' | 'provisional' | 'missing' | 'failed';
      detail: string;
    };
    canPrintReport: { answer: boolean; detail: string; reportId: string | null };
  };
  readiness: {
    consecutivePassStreak: number;
    required: number;
    productionReady: boolean;
  };
  /**
   * The metrics that matter more than feature count.
   * Values may be the string "UNKNOWN" when history is insufficient.
   */
  reliability: {
    daysSinceLastMissedNew: number | 'UNKNOWN';
    daysSinceLastFalseNew: number | 'UNKNOWN';
    lastMissedDate: string | 'UNKNOWN';
    lastFalseNewDate: string | 'UNKNOWN';
    evidence: string;
  };
  selfVerification: {
    provisional: boolean;
    failedCount: number;
    unknownCount: number;
    passedCount: number;
    checks: { id: string; question: string; verdict: string; detail: string }[];
  } | null;
  openLearningQueueItems: number;
  links: {
    upload: string;
    newInmates: string;
    review: string;
    reports: string;
    learningQueue: string;
    dailyDifference: string;
    investigatorWorkspace: string;
    operationalHealth: string;
  };
}

/**
 * Command-center payload for the morning dashboard.
 * Answers the seven operator questions without requiring a page hunt.
 */
export async function getMorningOperationsBoard(
  facility = 'sacramento',
): Promise<MorningOperationsBoard> {
  const now = new Date();
  const opsDate = now.toISOString().slice(0, 10);
  const dayStart = new Date(`${opsDate}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const prior = new Date(dayStart);
  prior.setUTCDate(prior.getUTCDate() - 1);
  const priorDate = prior.toISOString().slice(0, 10);
  const priorEnd = dayStart;

  const [
    todayPdfUpload,
    todayPdfBatch,
    yesterdayPdfBatch,
    dailyCase,
    certification,
    newBookings,
    reviewPending,
    printableReport,
    openLearning,
  ] = await Promise.all([
    prisma.inmateRosterUpload.findFirst({
      where: {
        facility,
        fileKind: 'pdf',
        rosterDate: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { uploadedAt: 'desc' },
      select: { uploadId: true, status: true, originalName: true, uploadedAt: true, batchId: true },
    }),
    prisma.inmateIngestionBatch.findFirst({
      where: {
        facility,
        status: 'completed',
        sourceType: { in: ['pdf_text', 'pdf_ocr'] },
        rosterDate: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { finishedAt: 'desc' },
      select: { batchId: true, finishedAt: true, recordsNew: true, recordsForReview: true },
    }),
    prisma.inmateIngestionBatch.findFirst({
      where: {
        facility,
        status: 'completed',
        sourceType: { in: ['pdf_text', 'pdf_ocr'] },
        rosterDate: { gte: prior, lt: priorEnd },
      },
      orderBy: { finishedAt: 'desc' },
      select: { batchId: true, sourceFilename: true, rosterDate: true },
    }),
    prisma.inmateDailyCase.findUnique({
      where: { facility_opsDate: { facility, opsDate: dayStart } },
    }).catch(() => null),
    prisma.inmateDailyCertification.findFirst({
      where: { facility, opsDate: dayStart, isCurrent: true },
    }).catch(() => null),
    prisma.inmateBooking.count({
      where: {
        facility,
        isFirstAppearance: true,
        bookedAt: { gte: dayStart, lt: dayEnd },
      },
    }),
    prisma.inmateReviewQueueItem.count({ where: { status: 'pending' } }),
    prisma.inmateIntelligenceReport.findFirst({
      where: {
        reportType: { in: ['new_inmates', 'daily_intelligence'] },
        approvalState: { in: ['approved', 'printed', 'draft', 'reviewed'] },
        generatedAt: { gte: dayStart },
      },
      orderBy: { generatedAt: 'desc' },
      select: { reportId: true, approvalState: true, rowCount: true },
    }),
    prisma.inmateLearningQueueItem.count({
      where: { facility, status: { in: ['open', 'in_progress'] } },
    }).catch(() => 0),
  ]);

  let streak = { streak: 0, required: 10, productionReady: false };
  try {
    const { consecutivePassStreak } = await import('./learningQueue.js');
    streak = await consecutivePassStreak(facility);
  } catch {
    // migration may not be applied yet
  }

  const todaysPdfUploaded = Boolean(todayPdfUpload);
  const yesterdaysRosterIdentified = Boolean(yesterdayPdfBatch || dailyCase?.priorPdfBatchId);
  const comparisonCompleted = Boolean(
    (dailyCase?.priorPdfBatchId && dailyCase?.currentPdfBatchId
      && ['compared', 'report_ready', 'enriching', 'enriched', 'closed'].includes(dailyCase.status))
    || (yesterdayPdfBatch && todayPdfBatch),
  );
  const newInmatesFound = dailyCase?.newInmateCount
    ?? todayPdfBatch?.recordsNew
    ?? newBookings;
  const requireManualReview = dailyCase?.reviewCount
    ?? todayPdfBatch?.recordsForReview
    ?? reviewPending;

  const { reliabilityStreaks, runSelfVerification } = await import('./selfVerification.js');
  const reliability = await reliabilityStreaks(facility, opsDate);

  let selfVerification: MorningOperationsBoard['selfVerification'] = null;
  if (todayPdfBatch?.batchId && comparisonCompleted) {
    try {
      const sv = await runSelfVerification({
        facility,
        opsDate,
        currentBatchId: todayPdfBatch.batchId,
        priorBatchId: yesterdayPdfBatch?.batchId ?? dailyCase?.priorPdfBatchId ?? null,
      });
      selfVerification = {
        provisional: sv.provisional,
        failedCount: sv.failedCount,
        unknownCount: sv.unknownCount,
        passedCount: sv.passedCount,
        checks: sv.checks,
      };
    } catch {
      selfVerification = {
        provisional: true,
        failedCount: 0,
        unknownCount: 1,
        passedCount: 0,
        checks: [{
          id: 'self_verification',
          question: 'Could self-verification run?',
          verdict: 'unknown',
          detail: 'Self-verification threw — treating report as Provisional (UNKNOWN).',
        }],
      };
    }
  }

  let reportCertification: MorningOperationsBoard['questions']['reportCertification']['answer'] = 'missing';
  if (certification?.status === 'pass' && !selfVerification?.provisional) {
    reportCertification = 'certified';
  } else if (certification?.status === 'fail') {
    reportCertification = 'failed';
  } else if (printableReport || todayPdfBatch || selfVerification?.provisional) {
    reportCertification = 'provisional';
  }

  const canPrint = Boolean(
    printableReport
    && ['approved', 'printed', 'reviewed', 'draft'].includes(printableReport.approvalState),
  );

  const { collectMorningAlerts } = await import('./morningAlerts.js');
  const { OPERATIONAL_NORTH_STAR } = await import('./truthCategories.js');
  const alerts = await collectMorningAlerts({
    facility,
    opsDate,
    selfVerification,
    reconcileOk: certification?.reconcileOk ?? null,
    openLearningQueueItems: openLearning,
    reviewCount: requireManualReview,
  });

  let headline: string;
  let posture: MorningOperationsBoard['posture'];
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  if (!todaysPdfUploaded) {
    headline = "Upload today's Sacramento PDF to begin the morning run.";
    posture = 'action_required';
  } else if (!yesterdaysRosterIdentified) {
    headline = "Yesterday's roster is not identified. Upload or link yesterday's PDF before trusting new-inmate counts.";
    posture = 'action_required';
  } else if (criticalAlerts.length > 0) {
    headline = criticalAlerts[0]!.message;
    posture = 'action_required';
  } else if (!comparisonCompleted && todayPdfUpload && todayPdfUpload.status !== 'completed') {
    headline = "Today's PDF is uploaded but comparison has not finished. Process the import.";
    posture = 'attention';
  } else if (selfVerification?.provisional) {
    headline = `Provisional: self-verification found ${selfVerification.failedCount} fail(s) and ${selfVerification.unknownCount} UNKNOWN check(s). Do not treat as certified.`;
    posture = 'attention';
  } else if (requireManualReview > 0) {
    headline = `Comparison ready: ${newInmatesFound} new inmates; ${requireManualReview} routed to human review (preserves truth — not a silent failure).`;
    posture = 'attention';
  } else if (reportCertification === 'certified') {
    headline = `Certified morning: ${newInmatesFound} newly booked. Report is ready to print.`;
    posture = 'ok';
  } else if (comparisonCompleted) {
    headline = `Provisional report: ${newInmatesFound} newly booked. Complete manual verification to certify.`;
    posture = 'attention';
  } else {
    headline = 'Morning operations incomplete. Follow the checklist below.';
    posture = 'action_required';
  }

  return {
    opsDate,
    priorDate,
    facility,
    northStar: OPERATIONAL_NORTH_STAR,
    headline,
    posture,
    alerts,
    questions: {
      todaysPdfUploaded: {
        answer: todaysPdfUploaded,
        detail: todayPdfUpload
          ? `${todayPdfUpload.originalName} · ${todayPdfUpload.status}`
          : "No PDF with today's roster date uploaded yet",
      },
      yesterdaysRosterIdentified: {
        answer: yesterdaysRosterIdentified,
        detail: yesterdayPdfBatch
          ? `${yesterdayPdfBatch.sourceFilename} · ${day(yesterdayPdfBatch.rosterDate)}`
          : dailyCase?.priorPdfBatchId
            ? `Daily case prior batch ${dailyCase.priorPdfBatchId}`
            : `No completed PDF batch for ${priorDate}`,
      },
      comparisonCompleted: {
        answer: comparisonCompleted,
        detail: comparisonCompleted
          ? (dailyCase ? `Daily case status: ${dailyCase.status}` : 'Prior and current PDF batches present')
          : 'Waiting for both prior and current PDF batches',
      },
      newInmatesFound: {
        answer: newInmatesFound,
        detail: 'On today ∧ not on yesterday (roster set-diff / certified snapshot)',
      },
      requireManualReview: {
        answer: requireManualReview,
        detail: requireManualReview > 0
          ? 'Human review is a feature — evidence insufficient for an automatic decision'
          : 'Nothing waiting in review',
      },
      reportCertification: {
        answer: reportCertification,
        detail: certification
          ? `Engineering cert: ${certification.status}`
            + (certification.potentialClientsMissed != null
              ? ` · clients missed ${certification.potentialClientsMissed}`
              : '')
          : printableReport
            ? `Operational report ${printableReport.approvalState} (not yet engineering-certified)`
            : 'No report for today yet',
      },
      canPrintReport: {
        answer: canPrint,
        detail: canPrint
          ? `Report ${printableReport!.reportId} · ${printableReport!.approvalState} · ${printableReport!.rowCount} rows`
          : 'Generate or approve the New Inmate Report first',
        reportId: printableReport?.reportId ?? dailyCase?.initialReportId ?? null,
      },
    },
    readiness: {
      consecutivePassStreak: streak.streak,
      required: streak.required,
      productionReady: streak.productionReady,
    },
    reliability: {
      daysSinceLastMissedNew: reliability.daysSinceLastMissedNew,
      daysSinceLastFalseNew: reliability.daysSinceLastFalseNew,
      lastMissedDate: reliability.lastMissedDate,
      lastFalseNewDate: reliability.lastFalseNewDate,
      evidence: reliability.evidence,
    },
    selfVerification,
    openLearningQueueItems: openLearning,
    links: {
      upload: '/admin/intelligence/upload',
      newInmates: '/admin/intelligence/new-inmates',
      review: '/admin/intelligence/review',
      reports: '/admin/intelligence/reports',
      learningQueue: '/admin/intelligence/learning-queue',
      dailyDifference: '/admin/intelligence/daily-difference',
      investigatorWorkspace: '/admin/intelligence/investigator-workspace',
      operationalHealth: '/admin/intelligence/operational-health',
    },
  };
}

// ---------------------------------------------------------------------------
// Report approval
// ---------------------------------------------------------------------------

export type ApprovalState = 'draft' | 'reviewed' | 'approved' | 'printed' | 'archived';

/**
 * The states a report moves through, and what may follow each.
 *
 * Forward only, and the document itself never changes. `printed` is the state that
 * matters most: it is the moment a conclusion left the building on paper, and after that
 * a correction has to be a new report saying what it supersedes rather than a quiet edit.
 */
const APPROVAL_FLOW: Record<ApprovalState, ApprovalState[]> = {
  draft: ['reviewed', 'archived'],
  reviewed: ['approved', 'draft', 'archived'],
  approved: ['printed', 'archived'],
  // Printing again is allowed and counted; a printed report is otherwise terminal
  // except for archiving.
  printed: ['printed', 'archived'],
  archived: [],
};

export async function setReportState(args: {
  reportId: string;
  to: ApprovalState;
  actorId: string;
  note?: string;
}): Promise<{ ok: boolean; reason?: string; state?: ApprovalState; printCount?: number }> {
  const report = await prisma.inmateIntelligenceReport.findUnique({
    where: { reportId: args.reportId },
    select: { approvalState: true, printCount: true },
  });
  if (!report) return { ok: false, reason: 'No such report.' };

  const from = report.approvalState as ApprovalState;
  if (!APPROVAL_FLOW[from].includes(args.to)) {
    return {
      ok: false,
      reason: from === 'archived'
        ? 'An archived report is a historical record and does not change state again.'
        : `A report cannot go from ${from} to ${args.to}. From ${from} it may become: ${APPROVAL_FLOW[from].join(', ')}.`,
    };
  }
  if (args.to === 'draft' && !args.note?.trim()) {
    // Sending a report back is a judgement about it, and the reason is the useful part.
    return { ok: false, reason: 'Returning a report to draft requires a reason.' };
  }

  const now = new Date();
  const updated = await prisma.inmateIntelligenceReport.update({
    where: { reportId: args.reportId },
    data: {
      approvalState: args.to,
      ...(args.note?.trim() ? { approvalNote: args.note.trim() } : {}),
      ...(args.to === 'reviewed' ? { reviewedById: args.actorId, reviewedAt: now } : {}),
      ...(args.to === 'approved' ? { approvedById: args.actorId, approvedAt: now } : {}),
      ...(args.to === 'printed'
        ? { printedById: args.actorId, printedAt: now, printCount: { increment: 1 } }
        : {}),
      ...(args.to === 'archived' ? { archivedAt: now } : {}),
      // Returning to draft clears the approval, because an approval that survived a
      // rejection would say someone approved a document that was then sent back.
      ...(args.to === 'draft' ? { approvedById: null, approvedAt: null, reviewedById: null, reviewedAt: null } : {}),
    },
    select: { approvalState: true, printCount: true },
  });

  return { ok: true, state: updated.approvalState as ApprovalState, printCount: updated.printCount };
}

export async function listReports(args: { limit: number; state?: string }) {
  const reports = await prisma.inmateIntelligenceReport.findMany({
    where: args.state ? { approvalState: args.state } : {},
    orderBy: [{ generatedAt: 'desc' }, { reportId: 'asc' }],
    take: args.limit,
    select: {
      reportId: true, reportType: true, parameters: true, rowCount: true,
      approvalState: true, generatedById: true, generatedAt: true,
      reviewedById: true, reviewedAt: true, approvedById: true, approvedAt: true,
      printedById: true, printedAt: true, printCount: true, archivedAt: true,
      approvalNote: true, supersedesReportId: true,
    },
  });

  return reports.map((r) => ({
    ...r,
    generatedAt: r.generatedAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    printedAt: r.printedAt?.toISOString() ?? null,
    archivedAt: r.archivedAt?.toISOString() ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Batch comparison
// ---------------------------------------------------------------------------

export interface ComparisonDetail {
  kind: 'new_inmate' | 'release' | 'return' | 'housing_move' | 'bail_change' | 'charge_change' | 'court_change' | 'departure';
  inmateId: string | null;
  name: string;
  bookingNumber: string | null;
  from: string | null;
  to: string | null;
  note: string | null;
}

/**
 * Compare two consecutive imports.
 *
 * Built from the change events the later import recorded, not by diffing the two
 * rosters again. The change engine already compared them observation by observation
 * when the second one was imported; re-diffing would produce a second, possibly
 * different answer, and the whole point of recording changes at import time is that the
 * answer does not drift.
 */
export async function compareBatches(args: {
  baselineBatchId: string;
  currentBatchId: string;
  generatedById?: string;
  persist?: boolean;
}): Promise<
  | { ok: true; comparisonId: string | null; counts: Record<string, number>; detail: ComparisonDetail[]; truncated: boolean }
  | { ok: false; reason: string }
> {
  const [baseline, current] = await Promise.all([
    prisma.inmateIngestionBatch.findUnique({
      where: { batchId: args.baselineBatchId },
      select: { batchId: true, facility: true, rosterDate: true, status: true, startedAt: true },
    }),
    prisma.inmateIngestionBatch.findUnique({
      where: { batchId: args.currentBatchId },
      select: { batchId: true, facility: true, rosterDate: true, status: true, startedAt: true },
    }),
  ]);

  if (!baseline || !current) return { ok: false, reason: 'One of the batches does not exist.' };
  if (baseline.facility !== current.facility) {
    return { ok: false, reason: `These batches are from different facilities (${baseline.facility} and ${current.facility}). Comparing them would report every person in one as new in the other.` };
  }
  if (baseline.batchId === current.batchId) {
    return { ok: false, reason: 'A batch cannot be compared with itself.' };
  }
  if (current.startedAt < baseline.startedAt) {
    return { ok: false, reason: 'The current batch is older than the baseline. Swap them — the comparison is directional.' };
  }

  const existing = await prisma.inmateBatchComparison.findUnique({
    where: { baselineBatchId_currentBatchId: { baselineBatchId: baseline.batchId, currentBatchId: current.batchId } },
  });
  if (existing) {
    return {
      ok: true,
      comparisonId: existing.comparisonId,
      counts: {
        newInmates: existing.newInmates, releases: existing.releases, returns: existing.returns,
        housingMoves: existing.housingMoves, bailChanges: existing.bailChanges,
        chargeChanges: existing.chargeChanges, courtChanges: existing.courtChanges,
        departures: existing.departures,
      },
      detail: existing.detail as unknown as ComparisonDetail[],
      truncated: existing.detailTruncated,
    };
  }

  const events = await prisma.inmateChangeEvent.findMany({
    where: { batchId: current.batchId, material: true },
    orderBy: [{ changeType: 'asc' }, { detectedAt: 'asc' }],
    take: 5_000,
  });

  const inmateIds = [...new Set(events.map((e) => e.inmateId).filter((v): v is string => Boolean(v)))];
  const inmates = inmateIds.length > 0
    ? await prisma.inmate.findMany({
        where: { inmateId: { in: inmateIds } },
        select: {
          inmateId: true, canonicalFirst: true, canonicalLast: true,
          displayFirst: true, displayLast: true,
        },
      })
    : [];
  const nameOf = new Map(inmates.map((i) => [i.inmateId, displayName(i)]));

  const bookingIds = [...new Set(events.map((e) => e.bookingId).filter((v): v is string => Boolean(v)))];
  const bookings = bookingIds.length > 0
    ? await prisma.inmateBooking.findMany({
        where: { bookingId: { in: bookingIds } },
        select: { bookingId: true, externalBookingId: true },
      })
    : [];
  const bookingNumberOf = new Map(bookings.map((b) => [b.bookingId, b.externalBookingId]));

  const KIND: Record<string, ComparisonDetail['kind']> = {
    new_inmate: 'new_inmate',
    returning_inmate: 'return',
    released: 'release',
    departed_roster: 'departure',
    housing_change: 'housing_move',
    bail_change: 'bail_change',
    charge_added: 'charge_change',
    charge_removed: 'charge_change',
    court_date_change: 'court_change',
  };

  const detail: ComparisonDetail[] = [];
  const counts = {
    newInmates: 0, releases: 0, returns: 0, housingMoves: 0,
    bailChanges: 0, chargeChanges: 0, courtChanges: 0, departures: 0,
  };
  const bump: Record<ComparisonDetail['kind'], keyof typeof counts> = {
    new_inmate: 'newInmates', release: 'releases', return: 'returns',
    housing_move: 'housingMoves', bail_change: 'bailChanges',
    charge_change: 'chargeChanges', court_change: 'courtChanges', departure: 'departures',
  };

  for (const event of events) {
    const kind = KIND[event.changeType];
    if (!kind) continue;
    counts[bump[kind]] += 1;

    // Bounded: a thousand-row roster produces a detail list nobody reads, and the counts
    // above remain complete regardless.
    if (detail.length < 500) {
      detail.push({
        kind,
        inmateId: event.inmateId,
        name: event.inmateId ? (nameOf.get(event.inmateId) ?? 'UNKNOWN') : 'UNKNOWN',
        bookingNumber: event.bookingId ? (bookingNumberOf.get(event.bookingId) ?? null) : null,
        from: event.previousValue,
        to: event.newValue,
        note: event.field,
      });
    }
  }

  const truncated = events.filter((e) => KIND[e.changeType]).length > detail.length;

  if (!args.persist) {
    return { ok: true, comparisonId: null, counts, detail, truncated };
  }

  const created = await prisma.inmateBatchComparison.create({
    data: {
      facility: current.facility,
      baselineBatchId: baseline.batchId,
      currentBatchId: current.batchId,
      baselineRosterDate: baseline.rosterDate,
      currentRosterDate: current.rosterDate,
      ...counts,
      detail: detail as unknown as object,
      detailTruncated: truncated,
      generatedById: args.generatedById ?? null,
    },
    select: { comparisonId: true },
  });

  return { ok: true, comparisonId: created.comparisonId, counts, detail, truncated };
}

/**
 * The two most recent completed imports for a facility, which is what "compare with
 * yesterday" means in practice.
 */
export async function compareLatest(facility: string, generatedById?: string) {
  const recent = await prisma.inmateIngestionBatch.findMany({
    where: { facility, status: 'completed' },
    orderBy: { startedAt: 'desc' },
    take: 2,
    select: { batchId: true },
  });
  if (recent.length < 2) {
    return { ok: false as const, reason: 'There are fewer than two completed imports for this facility, so there is nothing to compare.' };
  }
  return compareBatches({
    baselineBatchId: recent[1].batchId,
    currentBatchId: recent[0].batchId,
    generatedById,
    persist: true,
  });
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/**
 * Per-batch metrics, newest first, for the trend display.
 *
 * Durations come from the lifecycle transitions rather than from the batch's start and
 * finish, so "identity analysis took four minutes" is answerable rather than only "the
 * import took six".
 */
export async function getBatchMetrics(args: { limit: number; facility?: string }) {
  const batches = await prisma.inmateIngestionBatch.findMany({
    where: args.facility ? { facility: args.facility } : {},
    orderBy: [{ startedAt: 'desc' }, { batchId: 'asc' }],
    take: args.limit,
  });
  if (batches.length === 0) return { batches: [] };

  const batchIds = batches.map((b) => b.batchId);

  const [transitions, observationCounts, conflictCounts, reviewCounts, newCounts] = await Promise.all([
    prisma.inmateBatchTransition.findMany({
      where: { batchId: { in: batchIds } },
      select: { batchId: true, fromState: true, toState: true, durationMs: true },
    }),
    prisma.inmateBookingObservation.groupBy({
      by: ['batchId'], where: { batchId: { in: batchIds } }, _count: { observationId: true },
    }),
    prisma.inmateSourceConflict.groupBy({
      by: ['batchId'], where: { batchId: { in: batchIds } }, _count: { conflictId: true },
    }),
    prisma.inmateReviewQueueItem.groupBy({
      by: ['batchId'], where: { batchId: { in: batchIds } }, _count: { reviewId: true },
    }),
    prisma.inmateBooking.groupBy({
      by: ['sourceBatchId'], where: { sourceBatchId: { in: batchIds }, isFirstAppearance: true }, _count: { bookingId: true },
    }),
  ]);

  const observationsOf = new Map(observationCounts.map((c) => [c.batchId, c._count.observationId]));
  const conflictsOf = new Map(conflictCounts.map((c) => [c.batchId ?? '', c._count.conflictId]));
  const reviewsOf = new Map(reviewCounts.map((c) => [c.batchId, c._count.reviewId]));
  const newOf = new Map(newCounts.map((c) => [c.sourceBatchId, c._count.bookingId]));

  /** How long the batch spent in one state, from the transition that left it. */
  const stageDuration = (batchId: string, state: string): number | null => {
    const leaving = transitions.find((t) => t.batchId === batchId && t.fromState === state);
    return leaving?.durationMs ?? null;
  };

  return {
    batches: batches.map((b) => ({
      batchId: b.batchId,
      facility: b.facility,
      filename: b.sourceFilename,
      sourceType: b.sourceType,
      rosterDate: day(b.rosterDate),
      startedAt: b.startedAt.toISOString(),
      lifecycleState: b.lifecycleState,
      status: b.status,
      filesProcessed: 1,
      recordsParsed: b.recordsTotal,
      observationsCreated: observationsOf.get(b.batchId) ?? 0,
      identitiesMatched: b.recordsMatched,
      newInmates: newOf.get(b.batchId) ?? 0,
      conflictsGenerated: conflictsOf.get(b.batchId) ?? 0,
      reviewItems: reviewsOf.get(b.batchId) ?? 0,
      parserConfidence: b.parserConfidence,
      importDurationMs: b.finishedAt ? b.finishedAt.getTime() - b.startedAt.getTime() : null,
      // The stages an operator waits on.
      parsingMs: stageDuration(b.batchId, 'parsing'),
      identityAnalysisMs: stageDuration(b.batchId, 'identity_analysis'),
      intelligenceMs: stageDuration(b.batchId, 'intelligence_generation'),
    })),
  };
}

/** A day-by-day roll-up, for the trend chart. */
export async function getMetricTrend(days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const batches = await prisma.inmateIngestionBatch.findMany({
    where: { startedAt: { gte: since } },
    select: {
      batchId: true, startedAt: true, recordsTotal: true, recordsMatched: true,
      recordsForReview: true, parserConfidence: true, finishedAt: true, status: true,
    },
    orderBy: { startedAt: 'asc' },
  });

  const byDay = new Map<string, {
    date: string; imports: number; failed: number; records: number; matched: number;
    reviews: number; confidenceSum: number; confidenceCount: number; durationMsSum: number;
  }>();

  for (const b of batches) {
    const key = b.startedAt.toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? {
      date: key, imports: 0, failed: 0, records: 0, matched: 0,
      reviews: 0, confidenceSum: 0, confidenceCount: 0, durationMsSum: 0,
    };
    entry.imports += 1;
    if (b.status === 'failed') entry.failed += 1;
    entry.records += b.recordsTotal;
    entry.matched += b.recordsMatched;
    entry.reviews += b.recordsForReview;
    if (b.parserConfidence !== null) {
      entry.confidenceSum += b.parserConfidence;
      entry.confidenceCount += 1;
    }
    if (b.finishedAt) entry.durationMsSum += b.finishedAt.getTime() - b.startedAt.getTime();
    byDay.set(key, entry);
  }

  return {
    days: [...byDay.values()].map((d) => ({
      date: d.date,
      imports: d.imports,
      failed: d.failed,
      records: d.records,
      matched: d.matched,
      reviews: d.reviews,
      // Averaged over the batches that reported one, not over all batches — a batch
      // with no confidence recorded would otherwise drag the average toward zero.
      averageParserConfidence: d.confidenceCount > 0 ? Math.round(d.confidenceSum / d.confidenceCount) : null,
      averageDurationMs: d.imports > 0 ? Math.round(d.durationMsSum / d.imports) : null,
    })),
  };
}

export { money };
