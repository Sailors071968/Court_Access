// ============================================================================
// Engineering Certification Report — admin/developer only.
//
// Distinct from the Operational (revenue) New Inmate Report staff use each
// morning. This report answers: can we trust NIIS today?
//
// Immutable Operational Truth: NEVER overwrite a prior certification.
// Corrections create a superseding revision:
//   Original → Correction → Reason → Reviewer → Timestamp → Superseding Cert
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
  /** Required when superseding a prior certification for the same day. */
  correctionReason?: string | null;
  reviewerId?: string | null;
  reviewerName?: string | null;
  evidencePackagePath?: string | null;
  /** When false, do not write markdown under reports/ (tests). Default true. */
  writeFiles?: boolean;
  reportDir?: string;
}

function dayStart(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

/**
 * Persist engineering certification as an append-only revision.
 * Enqueue learning-queue items for every discrepancy.
 * Write admin-facing markdown/json reports (latest view only under reports/).
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
    immutable: true,
  };

  // Find current revision (if any) — never update it; supersede instead.
  const prior = await prisma.inmateDailyCertification.findFirst({
    where: { facility: input.facility, opsDate, isCurrent: true },
    orderBy: { revision: 'desc' },
  });

  const revision = (prior?.revision ?? 0) + 1;
  if (prior && !input.correctionReason && revision > 1) {
    // Allow silent first re-record only when prior exists without reason by
    // auto-labeling — still preserves history.
    input = {
      ...input,
      correctionReason:
        input.correctionReason
        ?? `Superseding revision ${prior.revision} (status was ${prior.status})`,
    };
  }

  if (prior) {
    await prisma.inmateDailyCertification.update({
      where: { certificationId: prior.certificationId },
      data: { isCurrent: false },
    });
  }

  const row = await prisma.inmateDailyCertification.create({
    data: {
      facility: input.facility,
      opsDate,
      priorRosterDate,
      revision,
      isCurrent: true,
      supersedesId: prior?.certificationId ?? null,
      correctionReason: revision === 1 ? null : (input.correctionReason ?? null),
      reviewerId: input.reviewerId ?? null,
      reviewerName: input.reviewerName ?? null,
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
      evidencePackagePath: input.evidencePackagePath ?? null,
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

  const md = renderEngineeringCertificationMarkdown({
    ...input,
    revision,
    supersedesId: prior?.certificationId ?? null,
  });
  if (input.writeFiles !== false) {
    const dir = input.reportDir ?? join(process.cwd(), '../reports/niis-reliability');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'ENGINEERING_CERTIFICATION_REPORT.md'), md);
    writeFileSync(
      join(dir, 'ENGINEERING_CERTIFICATION_REPORT.json'),
      JSON.stringify({
        certificationId: row.certificationId,
        revision,
        supersedesId: prior?.certificationId ?? null,
        ...input,
        summary,
      }, null, 2),
    );
  }

  return {
    certificationId: row.certificationId,
    revision,
    supersedesId: prior?.certificationId ?? null,
    markdown: md,
  };
}

/** Full certification history for one ops day (oldest → newest). */
export async function listCertificationRevisions(facility: string, opsDate: string) {
  const day = dayStart(opsDate);
  const rows = await prisma.inmateDailyCertification.findMany({
    where: { facility, opsDate: day },
    orderBy: { revision: 'asc' },
  });
  return rows.map((r) => ({
    certificationId: r.certificationId,
    revision: r.revision,
    isCurrent: r.isCurrent,
    supersedesId: r.supersedesId,
    correctionReason: r.correctionReason,
    reviewerName: r.reviewerName,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    precision: r.precision,
    recall: r.recall,
    evidencePackagePath: r.evidencePackagePath,
  }));
}

export function renderEngineeringCertificationMarkdown(
  input: EngineeringCertificationInput & { revision?: number; supersedesId?: string | null },
): string {
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
    '> Immutable: this report never overwrites a prior certification — it may supersede it.',
    '',
    `**Status:** ${input.status.toUpperCase()}`,
    `**Facility:** ${input.facility}`,
    `**Pair:** ${input.priorDate} → ${input.currentDate}`,
    `**Revision:** ${input.revision ?? 1}`,
    `**Supersedes:** ${input.supersedesId ?? '(original)'}`,
    input.correctionReason ? `**Correction reason:** ${input.correctionReason}` : '',
    input.reviewerName ? `**Reviewer:** ${input.reviewerName}` : '',
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
  ].filter((l) => l !== '').join('\n');
}
