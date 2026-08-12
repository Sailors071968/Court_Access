// ============================================================================
// Engineering Certification Report — admin/developer only.
//
// Distinct from the Operational (revenue) New Inmate Report staff use each
// morning. This report answers: can we trust NIIS today?
// ============================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import prisma from '../../lib/prisma.js';
import { enqueueDiscrepancy, type LearningErrorType } from './learningQueue.js';

export interface EngineeringMiss {
  name: string;
  stage?: string;
  rule?: string;
  evidence?: string;
  why?: string;
}

export interface EngineeringCertificationInput {
  facility: string;
  priorDate: string;
  currentDate: string;
  priorInmateCount: number | null;
  currentInmateCount: number | null;
  newInmates: number | null;
  existingInmates: number | null;
  returningInmates: number | null;
  reviewRequired: number | null;
  reconcileOk: boolean | null;
  precision: number | null;
  recall: number | null;
  potentialClientsFound: number | null;
  potentialClientsMissed: number | null;
  processingTimeMs: number;
  /** pass | fail | blocked | pending_manual_truth */
  status: string;
  misses?: EngineeringMiss[];
  extras?: EngineeringMiss[];
  stageLedger?: { stage: string; count: number; note?: string }[];
  operationalReportId?: string | null;
  dailyCaseId?: string | null;
  /** When false, do not write markdown under reports/ (tests). Default true. */
  writeFiles?: boolean;
  reportDir?: string;
}

function dayStart(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

/**
 * Persist engineering certification, enqueue learning-queue items for every
 * discrepancy, and write the admin-facing markdown/json reports.
 */
export async function recordEngineeringCertification(input: EngineeringCertificationInput) {
  const opsDate = dayStart(input.currentDate);
  const priorRosterDate = input.priorDate ? dayStart(input.priorDate) : null;

  const summary = {
    misses: input.misses ?? [],
    extras: input.extras ?? [],
    stageLedger: input.stageLedger ?? [],
    business: {
      potentialClientsFound: input.potentialClientsFound,
      potentialClientsMissed: input.potentialClientsMissed,
    },
    technical: {
      precision: input.precision,
      recall: input.recall,
    },
  };

  const row = await prisma.inmateDailyCertification.upsert({
    where: {
      facility_opsDate: { facility: input.facility, opsDate },
    },
    create: {
      facility: input.facility,
      opsDate,
      priorRosterDate,
      status: input.status,
      priorInmateCount: input.priorInmateCount,
      currentInmateCount: input.currentInmateCount,
      newInmateCount: input.newInmates,
      existingInmateCount: input.existingInmates,
      returningInmateCount: input.returningInmates,
      reviewCount: input.reviewRequired,
      reconcileOk: input.reconcileOk,
      precision: input.precision,
      recall: input.recall,
      potentialClientsFound: input.potentialClientsFound,
      potentialClientsMissed: input.potentialClientsMissed,
      processingTimeMs: input.processingTimeMs,
      summary: summary as object,
      dailyCaseId: input.dailyCaseId ?? null,
      operationalReportId: input.operationalReportId ?? null,
    },
    update: {
      priorRosterDate,
      status: input.status,
      priorInmateCount: input.priorInmateCount,
      currentInmateCount: input.currentInmateCount,
      newInmateCount: input.newInmates,
      existingInmateCount: input.existingInmates,
      returningInmateCount: input.returningInmates,
      reviewCount: input.reviewRequired,
      reconcileOk: input.reconcileOk,
      precision: input.precision,
      recall: input.recall,
      potentialClientsFound: input.potentialClientsFound,
      potentialClientsMissed: input.potentialClientsMissed,
      processingTimeMs: input.processingTimeMs,
      summary: summary as object,
      dailyCaseId: input.dailyCaseId ?? undefined,
      operationalReportId: input.operationalReportId ?? undefined,
    },
  });

  for (const miss of input.misses ?? []) {
    await enqueueDiscrepancy({
      facility: input.facility,
      opsDate: input.currentDate,
      inmateName: miss.name,
      errorType: 'missed_new' satisfies LearningErrorType,
      stage: miss.stage,
      rule: miss.rule,
      evidence: miss.evidence,
      why: miss.why,
      certificationId: row.certificationId,
    });
  }
  for (const extra of input.extras ?? []) {
    await enqueueDiscrepancy({
      facility: input.facility,
      opsDate: input.currentDate,
      inmateName: extra.name,
      errorType: 'false_new' satisfies LearningErrorType,
      stage: extra.stage,
      rule: extra.rule,
      evidence: extra.evidence,
      why: extra.why,
      certificationId: row.certificationId,
    });
  }
  if (input.reconcileOk === false) {
    await enqueueDiscrepancy({
      facility: input.facility,
      opsDate: input.currentDate,
      inmateName: '(RECONCILIATION)',
      errorType: 'reconcile_failure',
      stage: 'Classification',
      rule: 'New+Existing+Returning+Review = N',
      evidence: `N=${input.currentInmateCount} new=${input.newInmates} existing=${input.existingInmates} returning=${input.returningInmates} review=${input.reviewRequired}`,
      why: 'Roster disposition totals do not reconcile; inmates disappeared or were double-counted without explanation.',
      certificationId: row.certificationId,
    });
  }

  // Promote today's validated snapshot to engineering-certified on PASS so
  // tomorrow's comparison uses an immutable certified baseline (Directive §5/§14).
  if (input.status === 'pass') {
    try {
      const snap = await prisma.inmateRosterSnapshot.findFirst({
        where: {
          facility: input.facility,
          rosterDate: opsDate,
          status: { in: ['validated', 'certified'] },
          validationOk: true,
        },
        orderBy: { validatedAt: 'desc' },
        select: { snapshotId: true, status: true },
      });
      if (snap && snap.status !== 'certified') {
        const { certifyRosterSnapshot } = await import('./rosterSnapshot.js');
        await certifyRosterSnapshot(snap.snapshotId);
      }
    } catch {
      // Snapshot table may not be migrated yet on older hosts.
    }
  }

  const md = renderEngineeringCertificationMarkdown(input);
  if (input.writeFiles !== false) {
    const dir = input.reportDir ?? join(process.cwd(), '../reports/niis-reliability');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'ENGINEERING_CERTIFICATION_REPORT.md'), md);
    writeFileSync(
      join(dir, 'ENGINEERING_CERTIFICATION_REPORT.json'),
      JSON.stringify({ certificationId: row.certificationId, ...input, summary }, null, 2),
    );
  }

  return { certificationId: row.certificationId, markdown: md };
}

export function renderEngineeringCertificationMarkdown(input: EngineeringCertificationInput): string {
  const reconSum =
    input.newInmates != null && input.existingInmates != null
    && input.returningInmates != null && input.reviewRequired != null
      ? input.newInmates + input.existingInmates + input.returningInmates + input.reviewRequired
      : null;

  return [
    '# Engineering Certification Report',
    '',
    '> Admin / developer only — not the staff revenue report.',
    '> Manual investigator comparison is the gold standard. Discrepancies are defects.',
    '',
    `**Status:** ${input.status.toUpperCase()}`,
    `**Facility:** ${input.facility}`,
    `**Pair:** ${input.priorDate} → ${input.currentDate}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Totals',
    '',
    `| Field | Value |`,
    `|---|---:|`,
    `| Total inmates processed (N) | ${input.currentInmateCount ?? '—'} |`,
    `| Previous inmate count | ${input.priorInmateCount ?? '—'} |`,
    `| New | ${input.newInmates ?? '—'} |`,
    `| Existing | ${input.existingInmates ?? '—'} |`,
    `| Returning | ${input.returningInmates ?? '—'} |`,
    `| Review required | ${input.reviewRequired ?? '—'} |`,
    `| Reconciliation sum | ${reconSum ?? '—'} |`,
    `| Reconciliation OK | ${input.reconcileOk == null ? '—' : input.reconcileOk ? 'YES' : 'NO'} |`,
    `| Processing time | ${(input.processingTimeMs / 1000).toFixed(1)}s |`,
    '',
    '## Technical metrics',
    '',
    `| Metric | Value |`,
    `|---|---:|`,
    `| Precision | ${input.precision == null ? '—' : `${(input.precision * 100).toFixed(1)}%`} |`,
    `| Recall | ${input.recall == null ? '—' : `${(input.recall * 100).toFixed(1)}%`} |`,
    '',
    '## Business metrics',
    '',
    `| Metric | Value |`,
    `|---|---:|`,
    `| Potential New Clients Found | ${input.potentialClientsFound ?? '—'} |`,
    `| Potential New Clients Missed | ${input.potentialClientsMissed ?? '—'} |`,
    '',
    '## Missing inmates (Potential New Clients Missed)',
    '',
    ...(input.misses?.length
      ? input.misses.flatMap((m, i) => [
          `${i + 1}. **${m.name}**`,
          `   - Stage: ${m.stage ?? '—'}`,
          `   - Rule: ${m.rule ?? '—'}`,
          `   - Root cause hint: ${m.why ?? '—'}`,
          '',
        ])
      : ['*(none)*', '']),
    '## Extra inmates (false new)',
    '',
    ...(input.extras?.length
      ? input.extras.flatMap((m, i) => [
          `${i + 1}. **${m.name}**`,
          `   - Rule: ${m.rule ?? '—'}`,
          `   - Why NIIS believed new: ${m.why ?? '—'}`,
          '',
        ])
      : ['*(none)*', '']),
    '## Stage ledger',
    '',
    ...(input.stageLedger?.length
      ? [
          `| Stage | Count | Note |`,
          `|---|---:|---|`,
          ...input.stageLedger.map((s) => `| ${s.stage} | ${s.count} | ${s.note ?? ''} |`),
          '',
        ]
      : ['*(not recorded)*', '']),
    'Every discrepancy is also in the Learning Queue — no discrepancy is forgotten.',
    '',
  ].join('\n');
}
