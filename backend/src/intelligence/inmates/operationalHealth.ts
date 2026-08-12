// ============================================================================
// Operational Health — the NIIS heartbeat (V1.0 Engineering Contract).
//
// Not CPU / RAM / Redis / PM2. Operational truth for this morning's run.
// ============================================================================

import prisma from '../../lib/prisma.js';
import { OPERATIONAL_NORTH_STAR } from './truthCategories.js';
import { collectMorningAlerts } from './morningAlerts.js';
import { consecutivePassStreak } from './learningQueue.js';

export interface OperationalHealthBoard {
  northStar: string;
  facility: string;
  opsDate: string;
  priorDate: string;
  todayRosterCount: number | null;
  yesterdayRosterCount: number | null;
  newCount: number | null;
  existingCount: number | null;
  returningCount: number | null;
  reviewCount: number | null;
  reconciliation: 'PASS' | 'FAIL' | 'UNKNOWN';
  precision: number | null;
  recall: number | null;
  certification: 'PASS' | 'FAIL' | 'PROVISIONAL' | 'MISSING' | 'BLOCKED';
  processingTimeMs: number | null;
  potentialClients: number | null;
  potentialClientsMissed: number | null;
  silentFailureCount: number;
  alerts: Awaited<ReturnType<typeof collectMorningAlerts>>;
  readiness: {
    consecutivePassStreak: number;
    required: number;
    productionReady: boolean;
  };
  evidencePackagePath: string | null;
  generatedAt: string;
}

function dayStart(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

export async function getOperationalHealth(
  facility = 'sacramento',
  opsDate = new Date().toISOString().slice(0, 10),
): Promise<OperationalHealthBoard> {
  const ops = opsDate.slice(0, 10);
  const opsStart = dayStart(ops);
  const prior = new Date(opsStart);
  prior.setUTCDate(prior.getUTCDate() - 1);
  const priorDate = prior.toISOString().slice(0, 10);

  const [dailyCase, cert, priorSnap, currentSnap, streak] = await Promise.all([
    prisma.inmateDailyCase.findUnique({
      where: { facility_opsDate: { facility, opsDate: opsStart } },
    }).catch(() => null),
    prisma.inmateDailyCertification.findFirst({
      where: { facility, opsDate: opsStart, isCurrent: true },
    }).catch(() => null),
    prisma.inmateRosterSnapshot.findFirst({
      where: {
        facility,
        rosterDate: prior,
        status: { in: ['certified', 'validated'] },
      },
      orderBy: [{ status: 'asc' }, { certifiedAt: 'desc' }, { validatedAt: 'desc' }],
    }).catch(() => null),
    prisma.inmateRosterSnapshot.findFirst({
      where: { facility, rosterDate: opsStart },
      orderBy: { extractedAt: 'desc' },
    }).catch(() => null),
    consecutivePassStreak(facility),
  ]);

  // Prefer comparison detail on daily case / batch comparison
  let comparisonDetail: {
    counts?: Record<string, number>;
    reconcileOk?: boolean;
  } | null = null;
  if (dailyCase?.comparisonId) {
    const cmp = await prisma.inmateBatchComparison.findUnique({
      where: { comparisonId: dailyCase.comparisonId },
      select: { detail: true, newInmates: true, returns: true },
    }).catch(() => null);
    if (cmp?.detail && typeof cmp.detail === 'object') {
      comparisonDetail = cmp.detail as { counts?: Record<string, number>; reconcileOk?: boolean };
    }
  }

  const counts = comparisonDetail?.counts ?? null;
  const newCount = counts?.new ?? cert?.newInmateCount ?? dailyCase?.newInmateCount ?? null;
  const existingCount = counts?.existing ?? cert?.existingInmateCount ?? dailyCase?.existingInmateCount ?? null;
  const returningCount = counts?.returning ?? cert?.returningInmateCount ?? dailyCase?.returningInmateCount ?? null;
  const reviewCount = counts?.review ?? cert?.reviewCount ?? dailyCase?.reviewCount ?? null;

  const todayRosterCount =
    currentSnap?.inmateCount
    ?? cert?.currentInmateCount
    ?? (newCount != null && existingCount != null && returningCount != null && reviewCount != null
      ? newCount + existingCount + returningCount + reviewCount
      : null);

  const yesterdayRosterCount =
    priorSnap?.inmateCount ?? cert?.priorInmateCount ?? null;

  let reconciliation: OperationalHealthBoard['reconciliation'] = 'UNKNOWN';
  if (comparisonDetail?.reconcileOk === true || cert?.reconcileOk === true) {
    reconciliation = 'PASS';
  } else if (comparisonDetail?.reconcileOk === false || cert?.reconcileOk === false) {
    reconciliation = 'FAIL';
  } else if (
    todayRosterCount != null
    && newCount != null && existingCount != null
    && returningCount != null && reviewCount != null
  ) {
    reconciliation =
      newCount + existingCount + returningCount + reviewCount === todayRosterCount
        ? 'PASS'
        : 'FAIL';
  }

  let certification: OperationalHealthBoard['certification'] = 'MISSING';
  if (cert?.status === 'pass') certification = 'PASS';
  else if (cert?.status === 'fail') certification = 'FAIL';
  else if (cert?.status === 'blocked') certification = 'BLOCKED';
  else if (cert || dailyCase) certification = 'PROVISIONAL';

  const { runSelfVerification } = await import('./selfVerification.js');
  let silentFailureCount = 0;
  let selfVerification = null;
  if (dailyCase?.currentPdfBatchId) {
    try {
      const sv = await runSelfVerification({
        facility,
        opsDate: ops,
        currentBatchId: dailyCase.currentPdfBatchId,
        priorBatchId: dailyCase.priorPdfBatchId,
      });
      selfVerification = {
        provisional: sv.provisional,
        failedCount: sv.failedCount,
        unknownCount: sv.unknownCount,
        checks: sv.checks,
      };
      silentFailureCount = sv.failedCount + sv.unknownCount;
      if (sv.provisional && certification === 'PASS') certification = 'PROVISIONAL';
    } catch {
      silentFailureCount = 1;
    }
  }

  const alerts = await collectMorningAlerts({
    facility,
    opsDate: ops,
    selfVerification,
    reconcileOk: reconciliation === 'PASS' ? true : reconciliation === 'FAIL' ? false : null,
    openLearningQueueItems: await prisma.inmateLearningQueueItem.count({
      where: { facility, status: { in: ['open', 'in_progress'] } },
    }).catch(() => 0),
    reviewCount: reviewCount ?? 0,
  });

  const potentialClients =
    newCount != null && returningCount != null
      ? newCount + returningCount
      : cert?.potentialClientsFound ?? newCount;

  return {
    northStar: OPERATIONAL_NORTH_STAR,
    facility,
    opsDate: ops,
    priorDate,
    todayRosterCount,
    yesterdayRosterCount,
    newCount,
    existingCount,
    returningCount,
    reviewCount,
    reconciliation,
    precision: cert?.precision ?? null,
    recall: cert?.recall ?? null,
    certification,
    processingTimeMs: cert?.processingTimeMs ?? null,
    potentialClients,
    potentialClientsMissed: cert?.potentialClientsMissed ?? null,
    silentFailureCount,
    alerts,
    readiness: {
      consecutivePassStreak: streak.streak,
      required: streak.required,
      productionReady: streak.productionReady,
    },
    evidencePackagePath: cert?.evidencePackagePath ?? null,
    generatedAt: new Date().toISOString(),
  };
}
