// ============================================================================
// Learning Queue — no discrepancy is ever forgotten.
//
// Manual investigator comparison is ground truth. Every NIIS miss or false new
// becomes an engineering defect here. When fixed, the case becomes a permanent
// regression test under fixtures/sacramento/validation/days/.
// ============================================================================

import prisma from '../../lib/prisma.js';

export type LearningErrorType = 'missed_new' | 'false_new' | 'reconcile_failure';
export type LearningRootCause =
  | 'parser'
  | 'normalization'
  | 'identity'
  | 'classification'
  | 'report'
  | 'unknown';
export type LearningStatus = 'open' | 'in_progress' | 'fixed' | 'verified_regression';

function dayStart(isoDate: string): Date {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
}

function inferRootCause(stage?: string | null, rule?: string | null): LearningRootCause {
  const blob = `${stage ?? ''} ${rule ?? ''}`.toLowerCase();
  if (blob.includes('parse') || blob.includes('jail_scan') || blob.includes('pdf')) return 'parser';
  if (blob.includes('normal')) return 'normalization';
  if (blob.includes('identity') || blob.includes('resolve')) return 'identity';
  if (blob.includes('classif') || blob.includes('presence')) return 'classification';
  if (blob.includes('report')) return 'report';
  return 'unknown';
}

export async function enqueueDiscrepancy(args: {
  facility: string;
  opsDate: string;
  inmateName: string;
  errorType: LearningErrorType;
  stage?: string;
  rule?: string;
  evidence?: string;
  why?: string;
  rootCause?: LearningRootCause;
  certificationId?: string;
  note?: string;
}) {
  const opsDate = dayStart(args.opsDate);
  const rootCause = args.rootCause ?? inferRootCause(args.stage, args.rule);
  const name = args.inmateName.toUpperCase().replace(/\s+/g, ' ').trim();

  return prisma.inmateLearningQueueItem.upsert({
    where: {
      facility_opsDate_inmateName_errorType: {
        facility: args.facility,
        opsDate,
        inmateName: name,
        errorType: args.errorType,
      },
    },
    create: {
      facility: args.facility,
      opsDate,
      inmateName: name,
      errorType: args.errorType,
      rootCause,
      status: 'open',
      stage: args.stage ?? null,
      rule: args.rule ?? null,
      evidence: args.evidence ?? null,
      why: args.why ?? null,
      certificationId: args.certificationId ?? null,
      note: args.note ?? null,
    },
    update: {
      // Never drop an open item; refresh diagnosis if still open/in_progress.
      rootCause,
      stage: args.stage ?? undefined,
      rule: args.rule ?? undefined,
      evidence: args.evidence ?? undefined,
      why: args.why ?? undefined,
      certificationId: args.certificationId ?? undefined,
      note: args.note ?? undefined,
    },
  });
}

export async function listLearningQueue(args: {
  facility?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = {};
  if (args.facility) where.facility = args.facility;
  if (args.status) where.status = args.status;

  const [total, rows] = await Promise.all([
    prisma.inmateLearningQueueItem.count({ where }),
    prisma.inmateLearningQueueItem.findMany({
      where,
      orderBy: [{ status: 'asc' }, { opsDate: 'desc' }, { openedAt: 'desc' }],
      take: args.limit ?? 100,
      skip: args.offset ?? 0,
    }),
  ]);

  return {
    total,
    items: rows.map((r) => ({
      itemId: r.itemId,
      date: r.opsDate.toISOString().slice(0, 10),
      facility: r.facility,
      inmate: r.inmateName,
      errorType: r.errorType,
      rootCause: r.rootCause,
      status: r.status,
      stage: r.stage,
      rule: r.rule,
      evidence: r.evidence,
      why: r.why,
      regressionPath: r.regressionPath,
      openedAt: r.openedAt.toISOString(),
      fixedAt: r.fixedAt?.toISOString() ?? null,
      verifiedAt: r.verifiedAt?.toISOString() ?? null,
      note: r.note,
    })),
  };
}

export async function updateLearningQueueItem(args: {
  itemId: string;
  status?: LearningStatus;
  rootCause?: LearningRootCause;
  note?: string;
  regressionPath?: string;
}) {
  const data: Record<string, unknown> = {};
  if (args.status) {
    data.status = args.status;
    if (args.status === 'fixed') data.fixedAt = new Date();
    if (args.status === 'verified_regression') {
      data.verifiedAt = new Date();
      data.fixedAt = data.fixedAt ?? new Date();
    }
  }
  if (args.rootCause) data.rootCause = args.rootCause;
  if (args.note !== undefined) data.note = args.note;
  if (args.regressionPath !== undefined) data.regressionPath = args.regressionPath;

  return prisma.inmateLearningQueueItem.update({
    where: { itemId: args.itemId },
    data,
  });
}

/** Consecutive PASS certifications ending at the most recent ops day (readiness). */
export async function consecutivePassStreak(facility: string): Promise<{
  streak: number;
  required: number;
  productionReady: boolean;
  recent: { opsDate: string; status: string }[];
}> {
  const required = Number(process.env.SAC_CONSECUTIVE_PASS_REQUIRED ?? '10');
  const rows = await prisma.inmateDailyCertification.findMany({
    where: { facility },
    orderBy: { opsDate: 'desc' },
    take: Math.max(required, 30),
    select: { opsDate: true, status: true },
  });

  let streak = 0;
  for (const row of rows) {
    if (row.status === 'pass') streak++;
    else break;
  }

  return {
    streak,
    required,
    productionReady: streak >= required,
    recent: rows.slice(0, required).map((r) => ({
      opsDate: r.opsDate.toISOString().slice(0, 10),
      status: r.status,
    })),
  };
}
