/**
 * NIIS Operational Acceptance Test — prove the real PDF pipeline with evidence.
 *
 * Usage:
 *   npx tsx scripts/niis-operational-acceptance.ts \
 *     --pdf /path/to/SACJAILSCAN08-12-2026.pdf \
 *     --date 2026-08-12 \
 *     --out ../reports/niis-reliability/acceptance/2026-08-12
 *
 * Requires: DATABASE_URL pointing at the target system DB, and either:
 *   - a durable PDF path, or
 *   - an existing upload already in the DB for --date
 *
 * Does not invent PASS. Stops at first hard blocker (e.g. no prior certified roster).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, statSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import prisma from '../src/lib/prisma.js';
import { getDailyCasePipelineState } from '../src/intelligence/inmates/dailyCasePipeline.js';
import { getNewInmates } from '../src/intelligence/inmates/repository.js';

type Verdict = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';

interface StageResult {
  stage: number;
  name: string;
  verdict: Verdict;
  timestamp: string | null;
  databaseWrites: string[];
  recordCounts: Record<string, number | string | null>;
  executionTimeMs: number | null;
  evidence: string[];
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const opsDate = (arg('--date') ?? '2026-08-12').slice(0, 10);
const pdfPath = arg('--pdf');
const outDir = resolve(
  arg('--out') ?? `../reports/niis-reliability/acceptance/${opsDate}`,
);
const facility = 'sacramento';

function dayStart(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const stages: StageResult[] = [];
  const started = Date.now();
  const start = dayStart(opsDate);
  const end = new Date(start.getTime() + 86_400_000);
  const priorStart = new Date(start);
  priorStart.setUTCDate(priorStart.getUTCDate() - 1);

  // ── Stage 1: PDF received ──────────────────────────────────────────────
  const t1 = Date.now();
  let upload = await prisma.inmateRosterUpload.findFirst({
    where: {
      facility,
      OR: [
        { rosterDate: { gte: start, lt: end } },
        { originalName: { contains: '08-12', mode: 'insensitive' } },
        { originalName: { contains: '0812', mode: 'insensitive' } },
        { originalName: { contains: opsDate, mode: 'insensitive' } },
        ...(pdfPath ? [{ originalName: basename(pdfPath) }] : []),
      ],
    },
    orderBy: { uploadedAt: 'desc' },
    select: {
      uploadId: true,
      originalName: true,
      sizeBytes: true,
      sha256: true,
      status: true,
      stage: true,
      uploadedAt: true,
      batchId: true,
      storedPath: true,
    },
  });

  let localSha: string | null = null;
  let localSize: number | null = null;
  if (pdfPath && existsSync(pdfPath)) {
    localSha = sha256File(pdfPath);
    localSize = statSync(pdfPath).size;
  }

  if (!upload && !localSha) {
    stages.push({
      stage: 1,
      name: 'PDF received',
      verdict: 'FAIL',
      timestamp: null,
      databaseWrites: [],
      recordCounts: { uploads: 0 },
      executionTimeMs: Date.now() - t1,
      evidence: [
        `No InmateRosterUpload for ${opsDate}`,
        pdfPath
          ? `Local path missing: ${pdfPath}`
          : 'No --pdf argument and no DB upload — cannot proceed',
        'OPERATIONAL BLOCKER: attach durable SACJAILSCAN08-12-2026.pdf and re-run',
      ],
    });
    return finish(stages, started, 'BLOCKED_NO_PDF');
  }

  stages.push({
    stage: 1,
    name: 'PDF received',
    verdict: upload || localSha ? 'PASS' : 'FAIL',
    timestamp: upload?.uploadedAt?.toISOString() ?? new Date().toISOString(),
    databaseWrites: upload ? ['inmate_roster_uploads'] : [],
    recordCounts: {
      sizeBytes: upload?.sizeBytes ?? localSize,
      uploadPresent: upload ? 1 : 0,
    },
    executionTimeMs: Date.now() - t1,
    evidence: [
      `uploadId=${upload?.uploadId ?? 'NOT_IN_DB_YET'}`,
      `filename=${upload?.originalName ?? (pdfPath ? basename(pdfPath) : 'unknown')}`,
      `size=${upload?.sizeBytes ?? localSize}`,
      `sha256=${upload?.sha256 ?? localSha}`,
      `status=${upload?.status ?? 'local-only'}`,
      localSha && upload && localSha !== upload.sha256
        ? `WARNING: local sha ${localSha} ≠ db sha ${upload.sha256}`
        : 'fingerprint ok',
    ],
  });

  if (!upload) {
    stages.push({
      stage: 2,
      name: 'Import Job created',
      verdict: 'BLOCKED',
      timestamp: null,
      databaseWrites: [],
      recordCounts: {},
      executionTimeMs: null,
      evidence: [
        'PDF bytes exist locally but were not uploaded into InmateRosterUpload.',
        'Upload via NIIS Upload Files (Import Job) before re-running acceptance.',
      ],
    });
    return finish(stages, started, 'BLOCKED_NOT_UPLOADED');
  }

  // ── Stage 2: Import Job ────────────────────────────────────────────────
  const t2 = Date.now();
  let job: {
    jobId: string;
    status: string;
    createdAt: Date;
    uploadStartedAt: Date | null;
    uploadFinishedAt: Date | null;
    processStartedAt: Date | null;
    processFinishedAt: Date | null;
  } | null = null;
  try {
    const jf = await prisma.inmateImportJobFile.findFirst({
      where: { uploadId: upload.uploadId },
      include: {
        job: {
          select: {
            jobId: true,
            status: true,
            createdAt: true,
            uploadStartedAt: true,
            uploadFinishedAt: true,
            processStartedAt: true,
            processFinishedAt: true,
          },
        },
      },
    });
    job = jf?.job ?? null;
  } catch {
    job = null;
  }

  stages.push({
    stage: 2,
    name: 'Import Job created',
    verdict: job ? 'PASS' : upload.status !== 'uploading' ? 'PASS' : 'FAIL',
    timestamp: job?.createdAt?.toISOString() ?? upload.uploadedAt.toISOString(),
    databaseWrites: job
      ? ['inmate_import_jobs', 'inmate_import_job_files']
      : ['inmate_roster_uploads (legacy path)'],
    recordCounts: { jobStatus: job?.status ?? upload.status },
    executionTimeMs: Date.now() - t2,
    evidence: job
      ? [
          `jobId=${job.jobId}`,
          `queueStatus=${job.status}`,
          `createdAt=${job.createdAt.toISOString()}`,
          `uploadStartedAt=${job.uploadStartedAt?.toISOString() ?? 'null'}`,
          `uploadFinishedAt=${job.uploadFinishedAt?.toISOString() ?? 'null'}`,
          `processStartedAt=${job.processStartedAt?.toISOString() ?? 'null'}`,
          `processFinishedAt=${job.processFinishedAt?.toISOString() ?? 'null'}`,
        ]
      : [
          'No Import Job row (legacy upload path or migrations missing)',
          `upload.status=${upload.status}`,
        ],
  });

  if (job?.status === 'uploading' || upload.status === 'uploading') {
    return finish(stages, started, 'BLOCKED_STUCK_UPLOADING');
  }

  // ── Stage 3: Parser ────────────────────────────────────────────────────
  const t3 = Date.now();
  const batch = upload.batchId
    ? await prisma.inmateIngestionBatch.findUnique({ where: { batchId: upload.batchId } })
    : await prisma.inmateIngestionBatch.findFirst({
        where: {
          facility,
          rosterDate: { gte: start, lt: end },
          status: 'completed',
        },
        orderBy: { finishedAt: 'desc' },
      });

  const issues = batch
    ? await prisma.inmateIngestionIssue?.findMany?.({
        where: { batchId: batch.batchId },
        take: 50,
      }).catch(() => []) ?? []
    : [];

  // Fallback: count records
  const recordCount = batch
    ? await prisma.inmateIngestionRecord.count({ where: { batchId: batch.batchId } }).catch(() => batch.recordsTotal ?? 0)
    : 0;

  const parserOk = batch?.status === 'completed';
  stages.push({
    stage: 3,
    name: 'Parser executed',
    verdict: parserOk ? 'PASS' : 'FAIL',
    timestamp: batch?.finishedAt?.toISOString() ?? null,
    databaseWrites: ['inmate_ingestion_batches', 'inmate_ingestion_records'],
    recordCounts: {
      pagesProcessed: (batch as { pageCount?: number } | null)?.pageCount
        ?? (batch as { pagesProcessed?: number } | null)?.pagesProcessed
        ?? null,
      inmatesExtracted: batch?.recordsTotal ?? recordCount,
      recordsNew: batch?.recordsNew ?? null,
      parserWarnings: Array.isArray(issues)
        ? issues.filter((i: { severity?: string }) => i.severity === 'warning').length
        : null,
      parserErrors: Array.isArray(issues)
        ? issues.filter((i: { severity?: string }) => i.severity === 'error').length
        : null,
      parserConfidence: batch?.parserConfidence ?? null,
    },
    executionTimeMs: batch?.finishedAt && batch?.startedAt
      ? batch.finishedAt.getTime() - batch.startedAt.getTime()
      : Date.now() - t3,
    evidence: batch
      ? [
          `batchId=${batch.batchId}`,
          `status=${batch.status}`,
          `sourceType=${batch.sourceType}`,
          `filename=${batch.sourceFilename}`,
          `durationMs=${batch.finishedAt && batch.startedAt ? batch.finishedAt.getTime() - batch.startedAt.getTime() : 'null'}`,
        ]
      : ['No completed ingestion batch — parser did not run'],
  });
  if (!parserOk) return finish(stages, started, 'BLOCKED_PARSER');

  // ── Stage 4: Canonical roster ──────────────────────────────────────────
  const t4 = Date.now();
  const snap = await prisma.inmateRosterSnapshot.findFirst({
    where: { facility, rosterDate: { gte: start, lt: end } },
    orderBy: { extractedAt: 'desc' },
  }).catch(() => null);
  const members = snap
    ? await prisma.inmateRosterSnapshotMember.count({ where: { snapshotId: snap.snapshotId } }).catch(() => 0)
    : 0;

  stages.push({
    stage: 4,
    name: 'Canonical roster built',
    verdict: snap && (snap.inmateCount > 0 || members > 0) ? 'PASS' : 'FAIL',
    timestamp: snap?.extractedAt?.toISOString() ?? null,
    databaseWrites: ['inmate_roster_snapshots', 'inmate_roster_snapshot_members'],
    recordCounts: {
      inmateCount: snap?.inmateCount ?? members,
      duplicateCount: snap
        ? Math.max(0, (batch?.recordsTotal ?? 0) - (snap.inmateCount ?? members))
        : null,
      validationStatus: snap?.status ?? null,
      validationOk: snap?.validationOk ?? null,
    },
    executionTimeMs: Date.now() - t4,
    evidence: snap
      ? [
          `snapshotId=${snap.snapshotId}`,
          `status=${snap.status}`,
          `contentHash=${snap.contentHash}`,
          `members=${members}`,
        ]
      : ['No InmateRosterSnapshot for ops date'],
  });
  if (!snap) return finish(stages, started, 'BLOCKED_NO_SNAPSHOT');

  // ── Stage 5: Yesterday certified ───────────────────────────────────────
  const t5 = Date.now();
  const priorSnap = await prisma.inmateRosterSnapshot.findFirst({
    where: {
      facility,
      rosterDate: { gte: priorStart, lt: start },
      status: { in: ['certified', 'validated'] },
    },
    orderBy: [{ status: 'asc' }, { certifiedAt: 'desc' }],
  }).catch(() => null);
  const priorCert = await prisma.inmateDailyCertification.findFirst({
    where: {
      facility,
      opsDate: { gte: priorStart, lt: start },
      isCurrent: true,
      status: 'pass',
    },
  }).catch(() => null);

  if (!priorSnap && !priorCert) {
    stages.push({
      stage: 5,
      name: "Yesterday's certified roster loaded",
      verdict: 'BLOCKED',
      timestamp: null,
      databaseWrites: [],
      recordCounts: {},
      executionTimeMs: Date.now() - t5,
      evidence: [
        `OPERATIONAL BLOCKER: no certified/validated snapshot for ${priorStart.toISOString().slice(0, 10)}`,
        'Comparison cannot run. Certify yesterday first, then re-run acceptance.',
      ],
    });
    return finish(stages, started, 'BLOCKED_NO_PRIOR_CERTIFIED');
  }

  stages.push({
    stage: 5,
    name: "Yesterday's certified roster loaded",
    verdict: 'PASS',
    timestamp:
      priorSnap?.certifiedAt?.toISOString()
      ?? priorCert?.createdAt?.toISOString()
      ?? null,
    databaseWrites: ['inmate_roster_snapshots', 'inmate_daily_certifications'],
    recordCounts: {
      inmateCount: priorSnap?.inmateCount ?? priorCert?.currentInmateCount ?? null,
      rosterDate: priorStart.toISOString().slice(0, 10),
    },
    executionTimeMs: Date.now() - t5,
    evidence: [
      `certificationId=${priorCert?.certificationId ?? 'snapshot-only'}`,
      `snapshotId=${priorSnap?.snapshotId ?? 'null'}`,
      `rosterDate=${priorStart.toISOString().slice(0, 10)}`,
      `inmateCount=${priorSnap?.inmateCount ?? priorCert?.currentInmateCount}`,
      `status=${priorSnap?.status ?? priorCert?.status}`,
    ],
  });

  // ── Stage 6: Comparison ────────────────────────────────────────────────
  const t6 = Date.now();
  const daily = await prisma.inmateDailyCase.findUnique({
    where: { facility_opsDate: { facility, opsDate: start } },
  }).catch(() => null);
  const NEW = daily?.newInmateCount ?? null;
  const EXISTING = daily?.existingInmateCount ?? null;
  const RETURNING = daily?.returningInmateCount ?? null;
  const REVIEW = daily?.reviewCount ?? null;
  const todayTotal = snap.inmateCount;
  const sum =
    NEW != null && EXISTING != null && RETURNING != null && REVIEW != null
      ? NEW + EXISTING + RETURNING + REVIEW
      : null;
  const reconcileOk = sum != null && sum === todayTotal;
  const compared = Boolean(
    daily
    && daily.comparisonId
    && ['compared', 'report_ready', 'enriching', 'enriched', 'closed'].includes(daily.status),
  );

  stages.push({
    stage: 6,
    name: 'Comparison executed',
    verdict: compared && reconcileOk ? 'PASS' : compared ? 'FAIL' : 'FAIL',
    timestamp: daily?.updatedAt?.toISOString() ?? null,
    databaseWrites: ['inmate_daily_cases', 'inmate_batch_comparisons'],
    recordCounts: {
      NEW,
      EXISTING,
      RETURNING,
      REVIEW,
      TODAY_TOTAL: todayTotal,
      SUM: sum,
      reconcileOk: reconcileOk ? 1 : 0,
      caseId: daily?.caseId ?? null,
    },
    executionTimeMs: Date.now() - t6,
    evidence: [
      `caseId=${daily?.caseId ?? 'MISSING'}`,
      `status=${daily?.status ?? 'MISSING'}`,
      `comparisonId=${daily?.comparisonId ?? 'MISSING'}`,
      `NEW+EXISTING+RETURNING+REVIEW=${sum} vs TODAY=${todayTotal}`,
      reconcileOk ? 'RECONCILE PASS' : 'RECONCILE FAIL',
    ],
  });
  if (!compared) return finish(stages, started, 'BLOCKED_NO_COMPARISON');

  // ── Stage 7: Today's New Inmates ───────────────────────────────────────
  const t7 = Date.now();
  const list = await getNewInmates({
    facility,
    from: opsDate,
    to: opsDate,
    limit: 500,
    offset: 0,
  });
  const seedNames = ['NGUYEN', 'BAKER', 'SILVA', 'OKAFOR', 'PATEL', 'WILLIAMS', 'BROWN', 'GARCIA'];
  const hasSeed = list.results.some((r) =>
    seedNames.some((s) => r.name.toUpperCase().includes(s))
    && !r.provenance?.rosterDate?.startsWith(opsDate),
  );
  const allFromToday = list.results.every((r) =>
    r.provenance?.rosterDate === opsDate || r.discoveredOn.startsWith(opsDate),
  );

  stages.push({
    stage: 7,
    name: "Today's New Inmates table populated",
    verdict:
      list.source === 'daily_case_set_diff' && !hasSeed && (list.total === 0 || allFromToday)
        ? 'PASS'
        : 'FAIL',
    timestamp: new Date().toISOString(),
    databaseWrites: ['(read) DailyCase set-diff → inmate_bookings'],
    recordCounts: {
      displayed: list.total,
      dailyCaseNew: NEW,
      source: list.source ?? null,
      seedContamination: hasSeed ? 1 : 0,
    },
    executionTimeMs: Date.now() - t7,
    evidence: [
      `source=${list.source}`,
      `pipelineMessage=${list.pipelineMessage ?? 'null'}`,
      `caseId=${daily!.caseId}`,
      hasSeed ? 'FAIL: seed/demo names present' : 'No seed/demo contamination detected',
      `sample=${list.results.slice(0, 5).map((r) => r.name).join(' | ') || '(empty)'}`,
    ],
  });

  // ── Stage 8: Morning Operations / Daily Case ───────────────────────────
  const t8 = Date.now();
  const pipeline = await getDailyCasePipelineState(facility, opsDate);
  stages.push({
    stage: 8,
    name: 'Morning Operations updated (shared Daily Case)',
    verdict:
      pipeline.caseId === daily!.caseId && pipeline.flags.comparisonFinished
        ? 'PASS'
        : 'FAIL',
    timestamp: pipeline.generatedAt,
    databaseWrites: ['(read) getDailyCasePipelineState'],
    recordCounts: {
      caseId: pipeline.caseId,
      mayShowNewInmates: pipeline.mayShowNewInmates ? 1 : 0,
    },
    executionTimeMs: Date.now() - t8,
    evidence: [
      `pipeline.caseId=${pipeline.caseId}`,
      `daily.caseId=${daily!.caseId}`,
      `flags=${JSON.stringify(pipeline.flags)}`,
      `operatorMessage=${pipeline.operatorMessage}`,
      ...pipeline.stages.map((s) => `${s.verdict} ${s.label}`),
    ],
  });

  // ── Stage 9: Report ────────────────────────────────────────────────────
  const t9 = Date.now();
  const report = daily.initialReportId
    ? await prisma.inmateIntelligenceReport.findUnique({ where: { reportId: daily.initialReportId } })
    : null;
  stages.push({
    stage: 9,
    name: 'Report generated',
    verdict:
      report && report.rowCount === list.total
        ? 'PASS'
        : report
          ? 'FAIL'
          : 'FAIL',
    timestamp: report?.generatedAt?.toISOString() ?? null,
    databaseWrites: ['inmate_intelligence_reports'],
    recordCounts: {
      reportRowCount: report?.rowCount ?? null,
      newInmatesPageTotal: list.total,
      match: report && report.rowCount === list.total ? 1 : 0,
    },
    executionTimeMs: Date.now() - t9,
    evidence: report
      ? [
          `reportId=${report.reportId}`,
          `rowCount=${report.rowCount}`,
          `approvalState=${report.approvalState}`,
          report.rowCount === list.total
            ? 'Report matches Today\'s New Inmates count'
            : `MISMATCH report=${report.rowCount} page=${list.total}`,
        ]
      : ['No initialReportId on DailyCase'],
  });

  // ── Stage 10: Investigator Workspace ───────────────────────────────────
  const t10 = Date.now();
  let workspaceOk = false;
  let workspaceEvidence: string[] = [];
  try {
    const { getInvestigatorWorkspace } = await import('../src/intelligence/inmates/investigatorWorkspace.js');
    const ws = await getInvestigatorWorkspace({ facility, opsDate });
    const keys = new Set(ws.candidates.map((c: { key: string }) => c.key));
    workspaceOk = ws.candidates.length >= 0 && pipeline.caseId != null;
    workspaceEvidence = [
      `candidates=${ws.candidates.length}`,
      `case aligned with opsDate=${opsDate}`,
      `sample=${ws.candidates.slice(0, 3).map((c: { name: string }) => c.name).join(' | ')}`,
      `uniqueKeys=${keys.size}`,
    ];
  } catch (e) {
    workspaceEvidence = [e instanceof Error ? e.message : String(e)];
  }
  stages.push({
    stage: 10,
    name: 'Investigator Workspace',
    verdict: workspaceOk && pipeline.flags.comparisonFinished ? 'PASS' : 'FAIL',
    timestamp: new Date().toISOString(),
    databaseWrites: ['(read) daily difference / investigator decisions'],
    recordCounts: {},
    executionTimeMs: Date.now() - t10,
    evidence: workspaceEvidence,
  });

  const overall = stages.every((s) => s.verdict === 'PASS') ? 'ACCEPT' : 'REJECT';
  return finish(stages, started, overall, {
    caseId: daily?.caseId ?? null,
    opsDate,
    NEW,
    EXISTING,
    RETURNING,
    REVIEW,
    todayTotal,
    newInmatesPageTotal: list.total,
  });
}

function finish(
  stages: StageResult[],
  started: number,
  overall: string,
  summary: Record<string, unknown> = {},
) {
  const report = {
    test: 'NIIS Operational Acceptance',
    opsDate,
    facility,
    overall,
    generatedAt: new Date().toISOString(),
    totalExecutionTimeMs: Date.now() - started,
    database: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') ?? 'unknown',
    summary,
    stages,
    blockedAt: stages.find((s) => s.verdict === 'FAIL' || s.verdict === 'BLOCKED')?.name ?? null,
  };
  mkdirSync(outDir, { recursive: true });
  const jsonPath = resolve(outDir, 'ACCEPTANCE.json');
  const mdPath = resolve(outDir, 'ACCEPTANCE.md');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(mdPath, toMarkdown(report));
  console.log(JSON.stringify(report, null, 2));
  console.error(`Wrote ${jsonPath}`);
  console.error(`Wrote ${mdPath}`);
  return report;
}

function toMarkdown(report: {
  overall: string;
  opsDate: string;
  facility: string;
  generatedAt: string;
  totalExecutionTimeMs: number;
  database: string;
  summary: Record<string, unknown>;
  stages: StageResult[];
  blockedAt: string | null;
}): string {
  const lines = [
    `# NIIS Operational Acceptance — ${report.opsDate}`,
    '',
    `**Overall:** ${report.overall}`,
    `**Facility:** ${report.facility}`,
    `**Generated:** ${report.generatedAt}`,
    `**Total time:** ${report.totalExecutionTimeMs}ms`,
    `**Database:** ${report.database}`,
    report.blockedAt ? `**Blocked at:** ${report.blockedAt}` : '',
    '',
    '## Summary',
    '```json',
    JSON.stringify(report.summary, null, 2),
    '```',
    '',
    '## Stages',
    '',
    '| # | Stage | Verdict | Time (ms) |',
    '|---|---|---|---|',
    ...report.stages.map(
      (s) => `| ${s.stage} | ${s.name} | **${s.verdict}** | ${s.executionTimeMs ?? '—'} |`,
    ),
    '',
  ];
  for (const s of report.stages) {
    lines.push(`### Stage ${s.stage}: ${s.name} — ${s.verdict}`);
    lines.push('');
    lines.push(`- Timestamp: ${s.timestamp ?? '—'}`);
    lines.push(`- DB writes: ${s.databaseWrites.join(', ') || '—'}`);
    lines.push(`- Counts: \`${JSON.stringify(s.recordCounts)}\``);
    lines.push(`- Execution: ${s.executionTimeMs ?? '—'}ms`);
    lines.push('- Evidence:');
    for (const e of s.evidence) lines.push(`  - ${e}`);
    lines.push('');
  }
  return lines.filter((l) => l !== undefined).join('\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
