// ============================================================================
// Investigator Review Workspace — V1.0 Engineering Contract.
//
// Distinct from the identity Review Queue. Built around how the investigator
// actually compares yesterday vs today. One click. No typing. Every click
// feeds the learning / certification corpus.
// ============================================================================

import { mkdirSync, appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import prisma from '../../lib/prisma.js';
import { buildDailyDifferenceView, type DifferenceRow } from './dailyDifferenceViewer.js';
import { enqueueDiscrepancy } from './learningQueue.js';
import { explainReportableWhy } from './truthCategories.js';
import type { DefectCategory } from './defectCategories.js';
import {
  uncertaintyScore,
  buildManualCompareAssistant,
  computeAutomaticClassificationRate,
  type ManualCompareAssistant,
  type AutomaticClassificationRate,
} from './classificationConfidence.js';

export type InvestigatorAction =
  | 'confirm_new'
  | 'confirm_existing'
  | 'confirm_returning'
  | 'send_to_review'
  | 'mark_parser_error'
  | 'mark_identity_error'
  | 'mark_ocr_error'
  | 'mark_comparison_error';

const ACTION_TO_CLASS: Partial<Record<InvestigatorAction, string>> = {
  confirm_new: 'new',
  confirm_existing: 'existing',
  confirm_returning: 'returning',
  send_to_review: 'review',
};

const ACTION_TO_DEFECT: Partial<Record<InvestigatorAction, DefectCategory>> = {
  mark_parser_error: 'parser_defect',
  mark_identity_error: 'identity_defect',
  mark_ocr_error: 'ocr_defect',
  mark_comparison_error: 'comparison_defect',
};

export interface InvestigatorCandidate {
  key: string;
  name: string;
  niisClassification: string;
  whyHere: string;
  truthCategory: string;
  /** 0–100; higher = review first (Manual Compare Assistant). */
  uncertainty: number;
  prior: DifferenceRow['prior'];
  current: DifferenceRow['current'];
  evidence: DifferenceRow['evidence'];
  why: DifferenceRow['why'];
  inmateId: string | null;
  bookingId: string | null;
  historicalBookings: {
    bookingId: string;
    bookedAt: string;
    facility: string;
    externalBookingId: string | null;
    housingLocation: string | null;
  }[];
  decided: boolean;
  lastDecision: string | null;
}

export interface InvestigatorWorkspaceView {
  facility: string;
  opsDate: string;
  priorDate: string;
  reportCertification: string;
  reconcileOk: boolean;
  queue: {
    pending: number;
    decided: number;
    total: number;
  };
  /** Manual Compare Assistant — least confident first. */
  compareAssistant: ManualCompareAssistant;
  automaticClassification: AutomaticClassificationRate;
  candidates: InvestigatorCandidate[];
  actions: InvestigatorAction[];
}

function decisionsLogPath(opsDate: string): string {
  const dayDir = resolve(
    process.cwd(),
    '../fixtures/sacramento/validation/days',
    opsDate.slice(0, 10),
  );
  mkdirSync(dayDir, { recursive: true });
  return join(dayDir, 'investigator-decisions.jsonl');
}

async function loadDecidedKeys(facility: string, opsDate: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const rows = await prisma.inmateInvestigatorDecision.findMany({
      where: {
        facility,
        opsDate: new Date(`${opsDate.slice(0, 10)}T00:00:00.000Z`),
      },
      orderBy: { decidedAt: 'asc' },
      select: { candidateKey: true, action: true },
    });
    for (const r of rows) map.set(r.candidateKey, r.action);
  } catch {
    // Table may not be migrated yet — fall back to jsonl
    const path = decisionsLogPath(opsDate);
    if (existsSync(path)) {
      const { readFileSync } = await import('node:fs');
      for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const row = JSON.parse(line) as { key: string; action: string };
          map.set(row.key, row.action);
        } catch {
          /* skip */
        }
      }
    }
  }
  return map;
}

export async function getInvestigatorWorkspace(args: {
  facility?: string;
  opsDate?: string;
  includeDecided?: boolean;
  limit?: number;
}): Promise<InvestigatorWorkspaceView> {
  const facility = args.facility ?? 'sacramento';
  const diff = await buildDailyDifferenceView({
    facility,
    opsDate: args.opsDate,
  });

  const decided = await loadDecidedKeys(facility, diff.opsDate);
  const compareAssistant = buildManualCompareAssistant(diff.rows, 4);

  // Manual Compare Assistant: highest uncertainty first (confidence monitor).
  const sorted = [...diff.rows].sort(
    (a, b) => uncertaintyScore(b) - uncertaintyScore(a) || a.name.localeCompare(b.name),
  );

  let corrected = 0;
  try {
    corrected = await prisma.inmateInvestigatorDecision.count({
      where: {
        facility,
        opsDate: new Date(`${diff.opsDate}T00:00:00.000Z`),
        disagreesWithNiis: true,
      },
    });
  } catch {
    corrected = 0;
  }

  const humanReview = diff.counts.review + diff.counts.failed + diff.counts.unclassified;
  const automaticClassification = computeAutomaticClassificationRate({
    totalRoster: diff.current.count || diff.rows.filter((r) => r.onCurrent).length,
    humanReview,
    corrected,
  });

  const candidates: InvestigatorCandidate[] = [];
  for (const row of sorted) {
    const isDecided = decided.has(row.key);
    if (isDecided && !args.includeDecided) continue;

    // Workspace focuses on non-trivial cases unless includeDecided
    const u = uncertaintyScore(row);
    if (
      !args.includeDecided
      && ['unchanged', 'existing'].includes(row.classification)
      && u < 40
    ) {
      continue;
    }

    let historicalBookings: InvestigatorCandidate['historicalBookings'] = [];
    if (row.inmateId) {
      const bookings = await prisma.inmateBooking.findMany({
        where: { inmateId: row.inmateId },
        orderBy: { bookedAt: 'desc' },
        take: 15,
        select: {
          bookingId: true,
          bookedAt: true,
          facility: true,
          externalBookingId: true,
          housingLocation: true,
        },
      });
      historicalBookings = bookings.map((b) => ({
        bookingId: b.bookingId,
        bookedAt: b.bookedAt.toISOString(),
        facility: b.facility,
        externalBookingId: b.externalBookingId,
        housingLocation: b.housingLocation,
      }));
    }

    const disposition = (['new', 'returning', 'existing', 'review', 'failed'].includes(row.classification)
      ? row.classification
      : 'unclassified') as Parameters<typeof explainReportableWhy>[0]['disposition'];
    const explained = explainReportableWhy({ disposition });

    candidates.push({
      key: row.key,
      name: row.name,
      niisClassification: row.classification,
      whyHere: row.why.summary || explained.why,
      truthCategory: explained.truthCategory,
      uncertainty: u,
      prior: row.prior,
      current: row.current,
      evidence: row.evidence,
      why: row.why,
      inmateId: row.inmateId,
      bookingId: row.bookingId,
      historicalBookings,
      decided: isDecided,
      lastDecision: decided.get(row.key) ?? null,
    });

    if (candidates.length >= (args.limit ?? 200)) break;
  }

  const pending = candidates.filter((c) => !c.decided).length;
  const decidedCount = decided.size;

  return {
    facility,
    opsDate: diff.opsDate,
    priorDate: diff.priorDate,
    reportCertification: diff.reportCertification,
    reconcileOk: diff.reconcileOk,
    queue: {
      pending,
      decided: decidedCount,
      total: diff.rows.length,
    },
    compareAssistant,
    automaticClassification,
    candidates,
    actions: [
      'confirm_new',
      'confirm_existing',
      'confirm_returning',
      'send_to_review',
      'mark_parser_error',
      'mark_identity_error',
      'mark_ocr_error',
      'mark_comparison_error',
    ],
  };
}

export async function recordInvestigatorDecision(args: {
  facility?: string;
  opsDate: string;
  candidateKey: string;
  inmateName: string;
  niisClassification: string;
  action: InvestigatorAction;
  investigatorId?: string | null;
  investigatorName?: string | null;
  inmateId?: string | null;
  bookingId?: string | null;
}): Promise<{ decisionId: string; learningQueueItemId: string | null }> {
  const facility = args.facility ?? 'sacramento';
  const opsDate = args.opsDate.slice(0, 10);
  const confirmedClass = ACTION_TO_CLASS[args.action] ?? null;
  const defect = ACTION_TO_DEFECT[args.action] ?? null;
  const disagrees =
    confirmedClass != null
    && confirmedClass !== args.niisClassification
    && !(args.niisClassification === 'changed' && confirmedClass === 'existing');

  let decisionId = `local-${Date.now()}`;
  try {
    const row = await prisma.inmateInvestigatorDecision.create({
      data: {
        facility,
        opsDate: new Date(`${opsDate}T00:00:00.000Z`),
        candidateKey: args.candidateKey,
        inmateName: args.inmateName.toUpperCase().replace(/\s+/g, ' ').trim(),
        niisClassification: args.niisClassification,
        action: args.action,
        confirmedClassification: confirmedClass,
        defectCategory: defect,
        disagreesWithNiis: disagrees || Boolean(defect),
        inmateId: args.inmateId ?? null,
        bookingId: args.bookingId ?? null,
        investigatorId: args.investigatorId ?? null,
        investigatorName: args.investigatorName ?? null,
      },
    });
    decisionId = row.decisionId;
  } catch {
    // Persist to jsonl even if migration not applied yet.
  }

  const logLine = {
    decisionId,
    at: new Date().toISOString(),
    facility,
    opsDate,
    key: args.candidateKey,
    inmateName: args.inmateName,
    niisClassification: args.niisClassification,
    action: args.action,
    confirmedClassification: confirmedClass,
    defectCategory: defect,
    disagreesWithNiis: disagrees || Boolean(defect),
    investigatorName: args.investigatorName ?? null,
  };
  const logPath = decisionsLogPath(opsDate);
  appendFileSync(logPath, `${JSON.stringify(logLine)}\n`);

  // Also append under evidence package if present
  const pkgDir = resolve(
    process.cwd(),
    '../fixtures/sacramento/evidence-packages',
    opsDate,
  );
  if (existsSync(pkgDir)) {
    const certDir = join(pkgDir, 'certification');
    mkdirSync(certDir, { recursive: true });
    appendFileSync(join(certDir, 'investigator-decisions.jsonl'), `${JSON.stringify(logLine)}\n`);
  }

  let learningQueueItemId: string | null = null;

  try {
    if (defect) {
      const item = await enqueueDiscrepancy({
        facility,
        opsDate,
        inmateName: args.inmateName,
        errorType: args.niisClassification === 'new' || args.action === 'confirm_existing'
          ? 'false_new'
          : 'missed_new',
        stage: 'Investigator Workspace',
        rule: args.action,
        evidence: `Investigator marked ${defect} for ${args.inmateName}`,
        why: `One-click defect from Investigator Review Workspace (${args.action})`,
        rootCause: defect,
      });
      learningQueueItemId = item.itemId;
    } else if (disagrees && confirmedClass) {
      const errorType =
        confirmedClass === 'new' && args.niisClassification !== 'new' && args.niisClassification !== 'returning'
          ? 'missed_new'
          : (args.niisClassification === 'new' || args.niisClassification === 'returning')
              && (confirmedClass === 'existing')
            ? 'false_new'
            : 'missed_new';
      const item = await enqueueDiscrepancy({
        facility,
        opsDate,
        inmateName: args.inmateName,
        errorType,
        stage: 'Investigator Workspace',
        rule: `${args.niisClassification} → ${confirmedClass}`,
        evidence: `Investigator confirmed ${confirmedClass}; NIIS said ${args.niisClassification}`,
        why: 'Classification disagreement — entered Learning Queue (Permanent Regression Rule)',
        rootCause: 'comparison_defect',
      });
      learningQueueItemId = item.itemId;
    }
  } catch {
    // Learning queue table may be absent in some environments; jsonl/regression stubs still persist.
  }

  // Permanent Regression Rule: materialize a tiny regression stub for disagreements
  if (disagrees || defect) {
    const regDir = resolve(
      process.cwd(),
      '../fixtures/sacramento/validation/days',
      opsDate,
      'regression',
      args.candidateKey.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80),
    );
    mkdirSync(regDir, { recursive: true });
    writeFileSync(
      join(regDir, 'case.json'),
      JSON.stringify({
        ...logLine,
        permanentRegressionRule: true,
        note: 'Every defect fixed becomes one regression test, one replay case, one certification case.',
      }, null, 2),
    );
  }

  return { decisionId, learningQueueItemId };
}
