// ============================================================================
// Evidence Ledger — immutable daily record of evidence lifecycle.
//
// Every daily run appends entries. Entries are never updated or deleted.
// Audits, troubleshooting, and future replay depend on this chain.
//
// Stages (Evidence Certification Directive):
//   1. evidence_received
//   2. evidence_processed
//   3. evidence_preserved
//   4. evidence_certified
//   5. intelligence_produced
//   6. manual_verification
//   7. final_certification
// ============================================================================

import prisma from '../../lib/prisma.js';

export type EvidenceLedgerStage =
  | 'evidence_received'
  | 'evidence_processed'
  | 'evidence_preserved'
  | 'evidence_certified'
  | 'intelligence_produced'
  | 'manual_verification'
  | 'final_certification';

export const EVIDENCE_LEDGER_STAGES: readonly EvidenceLedgerStage[] = [
  'evidence_received',
  'evidence_processed',
  'evidence_preserved',
  'evidence_certified',
  'intelligence_produced',
  'manual_verification',
  'final_certification',
] as const;

function dayStart(isoDate: string): Date {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
}

export async function appendEvidenceLedger(args: {
  facility: string;
  opsDate: string;
  stage: EvidenceLedgerStage;
  summary: string;
  detail?: Record<string, unknown> | null;
  dailyCaseId?: string | null;
  uploadId?: string | null;
  batchId?: string | null;
  snapshotId?: string | null;
  certificationId?: string | null;
  corpusEntryId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
}): Promise<{ entryId: string; sequence: number }> {
  const opsDate = dayStart(args.opsDate);

  // Sequence is per facility+opsDate, append-only.
  const last = await prisma.inmateEvidenceLedger.findFirst({
    where: { facility: args.facility, opsDate },
    orderBy: { sequence: 'desc' },
    select: { sequence: true },
  });
  const sequence = (last?.sequence ?? 0) + 1;

  const row = await prisma.inmateEvidenceLedger.create({
    data: {
      facility: args.facility,
      opsDate,
      sequence,
      stage: args.stage,
      summary: args.summary,
      detail: (args.detail ?? {}) as object,
      dailyCaseId: args.dailyCaseId ?? null,
      uploadId: args.uploadId ?? null,
      batchId: args.batchId ?? null,
      snapshotId: args.snapshotId ?? null,
      certificationId: args.certificationId ?? null,
      corpusEntryId: args.corpusEntryId ?? null,
      actorId: args.actorId ?? null,
      actorName: args.actorName ?? null,
    },
    select: { entryId: true, sequence: true },
  });

  return row;
}

export async function listEvidenceLedger(args: {
  facility: string;
  opsDate?: string;
  limit?: number;
}) {
  const where: { facility: string; opsDate?: Date } = { facility: args.facility };
  if (args.opsDate) where.opsDate = dayStart(args.opsDate);

  const rows = await prisma.inmateEvidenceLedger.findMany({
    where,
    orderBy: [{ opsDate: 'desc' }, { sequence: 'asc' }],
    take: args.limit ?? 500,
  });

  return rows.map((r) => ({
    entryId: r.entryId,
    facility: r.facility,
    opsDate: r.opsDate.toISOString().slice(0, 10),
    sequence: r.sequence,
    stage: r.stage as EvidenceLedgerStage,
    summary: r.summary,
    detail: r.detail,
    dailyCaseId: r.dailyCaseId,
    uploadId: r.uploadId,
    batchId: r.batchId,
    snapshotId: r.snapshotId,
    certificationId: r.certificationId,
    corpusEntryId: r.corpusEntryId,
    actorId: r.actorId,
    actorName: r.actorName,
    recordedAt: r.recordedAt.toISOString(),
  }));
}

/** Compact stage checklist for morning board / audits. */
export async function evidenceLedgerChecklist(args: {
  facility: string;
  opsDate: string;
}): Promise<Record<EvidenceLedgerStage, { present: boolean; at: string | null; summary: string | null }>> {
  const rows = await listEvidenceLedger({
    facility: args.facility,
    opsDate: args.opsDate,
    limit: 200,
  });
  const out = {} as Record<
    EvidenceLedgerStage,
    { present: boolean; at: string | null; summary: string | null }
  >;
  for (const stage of EVIDENCE_LEDGER_STAGES) {
    const hit = rows.filter((r) => r.stage === stage).at(-1);
    out[stage] = {
      present: Boolean(hit),
      at: hit?.recordedAt ?? null,
      summary: hit?.summary ?? null,
    };
  }
  return out;
}

export function renderEvidenceLedgerMarkdown(args: {
  facility: string;
  opsDate: string;
  entries: Awaited<ReturnType<typeof listEvidenceLedger>>;
}): string {
  const lines = [
    `# Evidence Ledger — ${args.facility} — ${args.opsDate}`,
    '',
    '> Immutable. Algorithms are temporary. Evidence is permanent.',
    '',
    '| Seq | Stage | Summary | At |',
    '|---:|---|---|---|',
    ...args.entries.map(
      (e) =>
        `| ${e.sequence} | \`${e.stage}\` | ${e.summary.replace(/\|/g, '/')} | ${e.recordedAt} |`,
    ),
    '',
  ];
  return lines.join('\n');
}
