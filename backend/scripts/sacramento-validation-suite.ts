#!/usr/bin/env tsx
/**
 * Sacramento Validation Suite — NIIS Accuracy Certification harness.
 *
 * Gold standard: manual investigator comparison — not the software.
 * Pipeline under test: Yesterday PDF → Today PDF → comparison → New Inmate Report
 * (CSV enrichment is out of scope for this suite; CSV must never determine newness.)
 *
 * Pass requires ALL of:
 *   - Recall 100% / Precision 100% vs the gold new-inmate list
 *   - New + Existing + Returning + Review = current roster N (no unclassified)
 *   - Stage ledger with no unexplained count drops
 *   - Every miss and every extra explained with stage / rule / evidence
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/seed-sacramento.ts
 *   SAC_WIPE=1 npx tsx scripts/sacramento-validation-suite.ts
 *
 * Env:
 *   SAC_PRIOR_PDF, SAC_CURRENT_PDF, SAC_GOLD_LIST
 *   SAC_PRIOR_DATE (default 2026-08-09), SAC_CURRENT_DATE (default 2026-08-10)
 *   SAC_EXPECTED_NEW (default 67)
 *   SAC_WIPE=1
 */

import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import prisma from '../src/lib/prisma.js';
import { normalizeRecord } from '../src/intelligence/inmates/normalization.js';
import { parsePdfRoster } from '../src/intelligence/inmates/parsers/pdfParser.js';
import { SACRAMENTO_PDF } from '../src/intelligence/inmates/parsers/sacramento.js';
import { generateAndPersistReport } from '../src/intelligence/inmates/reportGenerator.js';
import { getNewInmates } from '../src/intelligence/inmates/repository.js';
import { listUploads, processingQueue, startProcessing, storeUpload } from '../src/intelligence/inmates/rosterUploads.js';
import { classifyPresence } from '../src/intelligence/inmates/changeDetection.js';

const FACILITY = 'sacramento';
const OPERATOR = 'sacramento-validation-suite';
const ROOT = resolve(import.meta.dirname, '../..');
const VALIDATION_DIR = join(ROOT, 'fixtures/sacramento/validation');
const REPORT_DIR = join(ROOT, 'reports/niis-reliability');

const PRIOR_DATE = process.env.SAC_PRIOR_DATE ?? '2026-08-09';
const CURRENT_DATE = process.env.SAC_CURRENT_DATE ?? '2026-08-10';
const EXPECTED_NEW = Number(process.env.SAC_EXPECTED_NEW ?? '67');

type Disposition = 'new' | 'existing' | 'returning' | 'review' | 'unclassified' | 'failed';

interface StageRow {
  stage: string;
  count: number;
  note?: string;
}

interface MissExplanation {
  name: string;
  stage: string;
  rule: string;
  evidence: string;
  why: string;
}

interface ExtraExplanation {
  name: string;
  rule: string;
  evidence: string;
  why: string;
}

function firstExisting(candidates: string[], fallback: string): string {
  for (const c of candidates) {
    if (c && existsSync(c)) return resolve(c);
  }
  return resolve(fallback);
}

const PRIOR_PDF = firstExisting(
  [
    process.env.SAC_PRIOR_PDF,
    join(VALIDATION_DIR, 'SACJAILSCAN08-09-2026.pdf'),
    '/tmp/sacjail/08-09.pdf',
    '/tmp/sacjail/SACJAILSCAN08-09-2026.pdf',
  ].filter((v): v is string => Boolean(v)),
  join(VALIDATION_DIR, 'SACJAILSCAN08-09-2026.pdf'),
);

const CURRENT_PDF = firstExisting(
  [
    process.env.SAC_CURRENT_PDF,
    join(VALIDATION_DIR, 'SACJAILSCAN08-10-2026.pdf'),
    '/tmp/sacjail/08-10.pdf',
    '/tmp/sacjail/SACJAILSCAN08-10-2026.pdf',
    '/tmp/sacjail/SACJAILSCAN08-10-2026 (1)_compressed.pdf',
  ].filter((v): v is string => Boolean(v)),
  join(VALIDATION_DIR, 'SACJAILSCAN08-10-2026.pdf'),
);

const GOLD_LIST = resolve(
  process.env.SAC_GOLD_LIST ?? join(VALIDATION_DIR, 'ground-truth-67-names.md'),
);

function normalizeName(name: string): string {
  return name.toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

function loadGoldList(path: string): string[] {
  const text = readFileSync(path, 'utf8');
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line) => line && !line.startsWith('#') && line.includes(','))
    .map(normalizeName);
}

function nextDateIso(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function waitForIdle(timeoutMs = 600_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const queue = await processingQueue();
    const busy = queue.active.some((u) => u.status === 'processing' || u.status === 'queued');
    if (!busy) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function wipeSacramento(): Promise<void> {
  console.log('SAC_WIPE=1 — clearing Sacramento NIIS operational tables…');
  const bookingIds = await prisma.inmateBooking.findMany({
    where: { facility: FACILITY },
    select: { bookingId: true, inmateId: true },
  });
  const ids = bookingIds.map((b) => b.bookingId);
  const inmateIds = [...new Set(bookingIds.map((b) => b.inmateId))];
  if (ids.length) {
    await prisma.inmateChangeEvent.deleteMany({ where: { bookingId: { in: ids } } });
    await prisma.inmateBookingObservation.deleteMany({ where: { bookingId: { in: ids } } });
    await prisma.inmateBookingCharge.deleteMany({ where: { bookingId: { in: ids } } });
    await prisma.inmateBooking.deleteMany({ where: { bookingId: { in: ids } } });
  }
  if (inmateIds.length) {
    await prisma.inmate.deleteMany({ where: { inmateId: { in: inmateIds } } });
  }
  await prisma.inmateIngestionBatch.deleteMany({ where: { facility: FACILITY } });
  await prisma.inmateRosterUpload.deleteMany({ where: { facility: FACILITY } });
}

async function uploadAndProcess(filePath: string, rosterDate: string) {
  const stored = await storeUpload({
    facility: FACILITY,
    originalName: basename(filePath),
    stream: createReadStream(filePath),
    uploadedById: OPERATOR,
    uploadedByName: 'Sacramento Validation Suite',
    rosterDate,
    rosterKind: 'full_population',
  });
  if ('error' in stored) throw new Error(`upload failed: ${stored.error}`);

  const started = await startProcessing({ uploadIds: [stored.uploadId], userId: OPERATOR });
  if (started.started.length !== 1) {
    throw new Error(`processing not started: ${JSON.stringify(started.skipped)}`);
  }

  const idle = await waitForIdle();
  if (!idle) throw new Error('processing timed out');

  const uploads = await listUploads({ limit: 20, offset: 0 });
  const row = uploads.uploads.find((u) => u.uploadId === stored.uploadId);
  return { uploadId: stored.uploadId, upload: row };
}

function assertStageContinuity(stages: StageRow[]): string[] {
  const gaps: string[] = [];
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1]!;
    const cur = stages[i]!;
    if (cur.count !== prev.count && !cur.note) {
      gaps.push(
        `Silent loss/gain between "${prev.stage}" (${prev.count}) and "${cur.stage}" (${cur.count})`,
      );
    }
  }
  return gaps;
}

async function explainMiss(
  name: string,
  batchId: string | null,
  priorNames: Set<string>,
  currentParsedNames: Set<string>,
): Promise<MissExplanation> {
  if (!currentParsedNames.has(name)) {
    return {
      name,
      stage: 'Roster records parsed',
      rule: 'sacramentoJailScan / Active Inmate Basic Roster reassembly',
      evidence: 'Name not present among parsed current-roster records',
      why: 'PDF text extraction or row reassembly did not produce this inmate; they never entered normalization.',
    };
  }

  if (!batchId) {
    return {
      name,
      stage: 'Identity decisions',
      rule: 'unknown (no current batch id)',
      evidence: 'Ingest batch missing',
      why: 'Cannot attribute; current ingest did not record a batch.',
    };
  }

  const records = await prisma.inmateIngestionRecord.findMany({
    where: { batchId },
    select: {
      recordId: true,
      resolution: true,
      normalizedPayload: true,
      rawPayload: true,
      resolvedInmateId: true,
      bookingId: true,
      matchTier: true,
      confidence: true,
      matchEvidence: true,
    },
    take: 5000,
  });

  const hit = records.find((r) => {
    const n = r.normalizedPayload as { last?: string; first?: string } | null;
    const raw = r.rawPayload as { Name?: string } | null;
    const fromNorm = n?.last && n?.first ? normalizeName(`${n.last}, ${n.first}`) : '';
    const fromRaw = raw?.Name ? normalizeName(String(raw.Name)) : '';
    return fromNorm === name || fromRaw === name;
  });

  if (!hit) {
    return {
      name,
      stage: 'Normalized',
      rule: 'normalizeRecord',
      evidence: 'Parsed on current roster but no ingestion record with this name in the batch',
      why: 'Row likely failed normalization (e.g. missing bookedAt) or was dropped before identity.',
    };
  }

  if (hit.resolution === 'needs_review') {
    return {
      name,
      stage: 'Identity decisions',
      rule: 'resolveIdentity → needs_review',
      evidence:
        `ingestionRecord=${hit.recordId} resolution=needs_review inmateId=${hit.resolvedInmateId ?? 'none'} ` +
        `tier=${hit.matchTier ?? 'none'} confidence=${hit.confidence ?? 'n/a'}`,
      why: 'Identity engine deferred the person to human review; they were not classified as new_inmate for the report.',
    };
  }

  if (hit.resolution === 'failed') {
    return {
      name,
      stage: 'Identity decisions',
      rule: 'resolveIdentity / attachBooking failed',
      evidence: `ingestionRecord=${hit.recordId} resolution=failed evidence=${JSON.stringify(hit.matchEvidence)?.slice(0, 240) ?? 'n/a'}`,
      why: 'Record failed during identity or booking attach.',
    };
  }

  if (hit.resolution === 'matched' || hit.resolution === 'duplicate') {
    const priorBookings = hit.resolvedInmateId
      ? await prisma.inmateBooking.count({
          where: { inmateId: hit.resolvedInmateId, bookedAt: { lt: new Date(`${CURRENT_DATE}T00:00:00.000Z`) } },
        })
      : -1;
    const closed = hit.resolvedInmateId
      ? await prisma.inmateBooking.findFirst({
          where: {
            inmateId: hit.resolvedInmateId,
            OR: [{ releasedAt: { not: null } }, { departedRosterAt: { not: null } }],
          },
          orderBy: { bookedAt: 'desc' },
        })
      : null;
    const presence = classifyPresence({
      priorBookingCount: Math.max(0, priorBookings),
      priorBookingClosed: Boolean(closed),
    });
    const onPrior = priorNames.has(name);
    return {
      name,
      stage: 'Classification',
      rule: `classifyPresence → ${presence.changeType}`,
      evidence:
        `resolution=${hit.resolution} priorBookings=${priorBookings} ` +
        `priorClosed=${Boolean(closed)} onPriorRosterParse=${onPrior} ` +
        `tier=${hit.matchTier ?? 'none'} confidence=${hit.confidence ?? 'n/a'} ` +
        `presenceNote=${presence.newValue ?? ''}`,
      why:
        presence.changeType === 'new_inmate'
          ? 'Classified new in change detection but absent from New Inmate Report filter — report query/rule mismatch.'
          : `System treated them as ${presence.changeType} because identity matched an existing person` +
            (onPrior ? ' (also present on prior roster parse).' : ' (not on prior roster parse — possible identity over-merge).'),
    };
  }

  if (hit.resolution === 'new_inmate') {
    return {
      name,
      stage: 'Report generation',
      rule: 'getNewInmates / isFirstAppearance + bookedAt date filter',
      evidence: `resolution=new_inmate bookingId=${hit.bookingId ?? 'none'}`,
      why: 'Identity said new_inmate but the New Inmate Report query did not include them (date filter, flag, or batch linkage).',
    };
  }

  return {
    name,
    stage: 'Identity decisions',
    rule: `resolution=${hit.resolution}`,
    evidence: `ingestionRecord=${hit.recordId}`,
    why: `Unexpected resolution "${hit.resolution}" excluded them from the new-inmate report.`,
  };
}

async function explainExtra(name: string, batchId: string | null, priorNames: Set<string>): Promise<ExtraExplanation> {
  if (!batchId) {
    return {
      name,
      rule: 'unknown',
      evidence: 'no batch',
      why: 'Reported as new without a batch to inspect.',
    };
  }
  const onPrior = priorNames.has(name);
  const booking = await prisma.inmateBooking.findFirst({
    where: {
      facility: FACILITY,
      isFirstAppearance: true,
      bookedAt: {
        gte: new Date(`${CURRENT_DATE}T00:00:00.000Z`),
        lt: new Date(`${nextDateIso(CURRENT_DATE)}T00:00:00.000Z`),
      },
      inmate: {
        OR: [
          { canonicalLast: name.split(',')[0]?.trim() },
        ],
      },
    },
    include: { inmate: true, sourceBatch: true },
  });

  const presence = classifyPresence({
    priorBookingCount: 0,
    priorBookingClosed: false,
  });

  return {
    name,
    rule: 'isFirstAppearance / classifyPresence → new_inmate',
    evidence:
      `onPriorRosterParse=${onPrior} bookingId=${booking?.bookingId ?? 'n/a'} ` +
      `inmateId=${booking?.inmateId ?? 'n/a'} batch=${booking?.sourceBatchId ?? batchId} ` +
      `ruleText=${presence.newValue}`,
    why: onPrior
      ? 'Reported as first appearance even though the prior roster parse contained this name — identity failed to match the prior-day person (under-merge) or prior ingest never created them.'
      : 'Not on the administrator gold list. System saw first repository appearance on the current roster date. If the investigator says they are not new, either the gold list is incomplete for this edge case or prior-day identity evidence was insufficient.',
  };
}

async function dispositionAccounting(batchId: string): Promise<{
  byName: Map<string, Disposition>;
  counts: Record<Disposition, number>;
}> {
  const byName = new Map<string, Disposition>();
  const records = await prisma.inmateIngestionRecord.findMany({
    where: { batchId },
    select: {
      resolution: true,
      normalizedPayload: true,
      rawPayload: true,
      resolvedInmateId: true,
      bookingId: true,
    },
  });

  for (const r of records) {
    const n = r.normalizedPayload as { last?: string; first?: string } | null;
    const raw = r.rawPayload as { Name?: string } | null;
    const name = n?.last && n?.first
      ? normalizeName(`${n.last}, ${n.first}`)
      : raw?.Name
        ? normalizeName(String(raw.Name))
        : '';
    if (!name) continue;

    let disposition: Disposition = 'unclassified';
    if (r.resolution === 'needs_review') disposition = 'review';
    else if (r.resolution === 'failed') disposition = 'failed';
    else if (r.resolution === 'new_inmate') disposition = 'new';
    else if (r.resolution === 'matched' || r.resolution === 'duplicate') {
      // Distinguish existing vs returning via change events when possible.
      const event = r.bookingId
        ? await prisma.inmateChangeEvent.findFirst({
            where: {
              bookingId: r.bookingId,
              changeType: { in: ['new_inmate', 'returning_inmate', 'known_inmate'] },
            },
            orderBy: { detectedAt: 'desc' },
          })
        : null;
      if (event?.changeType === 'returning_inmate') disposition = 'returning';
      else if (event?.changeType === 'new_inmate') disposition = 'new';
      else disposition = 'existing';
    } else {
      disposition = 'unclassified';
    }
    byName.set(name, disposition);
  }

  const counts: Record<Disposition, number> = {
    new: 0,
    existing: 0,
    returning: 0,
    review: 0,
    unclassified: 0,
    failed: 0,
  };
  for (const d of byName.values()) counts[d]++;
  return { byName, counts };
}

function writeDailyCertificationSummary(args: {
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  priorDate: string;
  currentDate: string;
  priorInmateCount: number | null;
  currentInmateCount: number | null;
  newInmates: number | null;
  existingInmates: number | null;
  returningInmates: number | null;
  reviewRequired: number | null;
  reconciliationOk: boolean | null;
  processingTimeMs: number;
  potentialClientsFound: number | null;
  potentialClientsMissed: number | null;
  precision: number | null;
  recall: number | null;
  note?: string;
}) {
  const reconSum =
    args.newInmates != null && args.existingInmates != null
    && args.returningInmates != null && args.reviewRequired != null
      ? args.newInmates + args.existingInmates + args.returningInmates + args.reviewRequired
      : null;
  const md = [
    '# Daily Certification Summary',
    '',
    `**Certification status:** ${args.status}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '| Field | Value |',
    '|---|---|',
    `| Previous roster date | ${args.priorDate} |`,
    `| Current roster date | ${args.currentDate} |`,
    `| Previous inmate count | ${args.priorInmateCount ?? '—'} |`,
    `| Current inmate count (N) | ${args.currentInmateCount ?? '—'} |`,
    `| New inmates | ${args.newInmates ?? '—'} |`,
    `| Existing inmates | ${args.existingInmates ?? '—'} |`,
    `| Returning inmates | ${args.returningInmates ?? '—'} |`,
    `| Review required | ${args.reviewRequired ?? '—'} |`,
    `| Total reconciliation (New+Existing+Returning+Review) | ${reconSum ?? '—'} |`,
    `| Reconciliation = N | ${args.reconciliationOk == null ? '—' : args.reconciliationOk ? 'YES' : 'NO'} |`,
    `| Processing time | ${(args.processingTimeMs / 1000).toFixed(1)}s |`,
    '',
    '## Technical metrics',
    '',
    `| Metric | Value |`,
    `|---|---:|`,
    `| Precision | ${args.precision == null ? '—' : `${(args.precision * 100).toFixed(1)}%`} |`,
    `| Recall | ${args.recall == null ? '—' : `${(args.recall * 100).toFixed(1)}%`} |`,
    '',
    '## Business metrics',
    '',
    `| Metric | Value |`,
    `|---|---:|`,
    `| Potential New Clients Found | ${args.potentialClientsFound ?? '—'} |`,
    `| Potential New Clients Missed | ${args.potentialClientsMissed ?? '—'} |`,
    '',
    args.note ? `> ${args.note}\n` : '',
    'A missed new inmate is a potentially missed business opportunity.',
    '',
  ].join('\n');
  writeFileSync(join(REPORT_DIR, 'DAILY_CERTIFICATION_SUMMARY.md'), md);
  writeFileSync(join(REPORT_DIR, 'DAILY_CERTIFICATION_SUMMARY.json'), JSON.stringify(args, null, 2));
}

async function main() {
  const runStartedAt = Date.now();
  mkdirSync(REPORT_DIR, { recursive: true });
  console.log('=== Sacramento Validation Suite (Operational Validation Mode) ===');
  console.log('Architecture frozen. Sole objective: 100% PDF-comparison accuracy.');
  console.log('Gold standard: manual investigator comparison — not the software.');
  console.log(`prior:   ${PRIOR_PDF} (${PRIOR_DATE})`);
  console.log(`current: ${CURRENT_PDF} (${CURRENT_DATE})`);
  console.log(`gold:    ${GOLD_LIST} (expected new=${EXPECTED_NEW})`);

  const missingInputs: string[] = [];
  if (!existsSync(PRIOR_PDF)) missingInputs.push(PRIOR_PDF);
  if (!existsSync(CURRENT_PDF)) missingInputs.push(CURRENT_PDF);
  if (!existsSync(GOLD_LIST)) missingInputs.push(GOLD_LIST);

  if (missingInputs.length > 0) {
    const msg = [
      'BLOCKED: required certification inputs are missing:',
      ...missingInputs.map((p) => `  - ${p}`),
      '',
      'Place complete SACJAILSCAN PDFs under fixtures/sacramento/validation/ or /tmp/sacjail/.',
      'Manual ground truth is the gold standard; the suite cannot certify without the rosters.',
    ].join('\n');
    console.error(msg);
    writeFileSync(
      join(REPORT_DIR, 'SACRAMENTO_VALIDATION_RESULT.md'),
      `# Sacramento Validation Suite — BLOCKED\n\n${msg}\n`,
    );
    writeDailyCertificationSummary({
      status: 'BLOCKED',
      priorDate: PRIOR_DATE,
      currentDate: CURRENT_DATE,
      priorInmateCount: null,
      currentInmateCount: null,
      newInmates: null,
      existingInmates: null,
      returningInmates: null,
      reviewRequired: null,
      reconciliationOk: null,
      processingTimeMs: Date.now() - runStartedAt,
      potentialClientsFound: null,
      potentialClientsMissed: null,
      precision: null,
      recall: null,
      note: 'Durable prior/current PDFs not available. Continuous validation continues on each live morning pair — do not wait on this historical benchmark alone.',
    });
    try {
      const { recordEngineeringCertification } = await import(
        '../src/intelligence/inmates/engineeringCertification.js'
      );
      await recordEngineeringCertification({
        facility: FACILITY,
        priorDate: PRIOR_DATE,
        currentDate: CURRENT_DATE,
        priorInmateCount: null,
        currentInmateCount: null,
        newInmates: null,
        existingInmates: null,
        returningInmates: null,
        reviewRequired: null,
        reconcileOk: null,
        precision: null,
        recall: null,
        potentialClientsFound: null,
        potentialClientsMissed: null,
        processingTimeMs: Date.now() - runStartedAt,
        status: 'blocked',
        reportDir: REPORT_DIR,
      });
    } catch {
      // DB may not have migration yet — files above still written.
    }
    process.exit(2);
  }

  const gold = loadGoldList(GOLD_LIST);
  if (gold.length !== EXPECTED_NEW) {
    console.error(`Gold list must contain exactly ${EXPECTED_NEW} names; found ${gold.length}`);
    process.exit(2);
  }

  // --- Stage: PDF extracted / parsed (current day, full ledger) ------------
  const priorParse = await parsePdfRoster(PRIOR_PDF, SACRAMENTO_PDF.columnMap, { rosterDate: PRIOR_DATE });
  const currentParse = await parsePdfRoster(CURRENT_PDF, SACRAMENTO_PDF.columnMap, { rosterDate: CURRENT_DATE });

  const stages: StageRow[] = [
    { stage: 'PDF extracted (pages)', count: currentParse.stats.pageCount ?? 0 },
    {
      stage: 'Roster records parsed',
      count: currentParse.records.length,
      note: 'page count ≠ row count (expected)',
    },
  ];

  let normalizedOk = 0;
  let normalizedFail = 0;
  for (const row of currentParse.records) {
    const outcome = normalizeRecord(row, SACRAMENTO_PDF.columnMap);
    if (outcome.record) normalizedOk++;
    else normalizedFail++;
  }
  stages.push({
    stage: 'Normalized',
    count: normalizedOk,
    note: normalizedFail
      ? `${normalizedFail} failed normalizeRecord (explicit)`
      : undefined,
  });

  console.log(`\nPrior parse: pages=${priorParse.stats.pageCount} rows=${priorParse.records.length}`);
  console.log(`Current parse: pages=${currentParse.stats.pageCount} rows=${currentParse.records.length}`);
  if (currentParse.records.length < 100) {
    console.error('Current roster parse yielded too few records — aborting.');
    process.exit(1);
  }

  const priorNames = new Set(priorParse.records.map((r) => normalizeName(String(r.Name ?? ''))));
  const currentNames = new Set(currentParse.records.map((r) => normalizeName(String(r.Name ?? ''))));
  const priorInmateCount = priorNames.size;
  const rosterN = currentNames.size;

  if (process.env.SAC_WIPE === '1') await wipeSacramento();

  console.log(`\n=== Ingest prior ${PRIOR_DATE} ===`);
  const day1 = await uploadAndProcess(PRIOR_PDF, PRIOR_DATE);
  console.log(`  status=${day1.upload?.status} counts=${JSON.stringify(day1.upload?.counts)}`);
  if (day1.upload?.status !== 'completed') {
    console.error('Prior roster did not complete:', day1.upload?.failureReason);
    process.exit(1);
  }

  console.log(`\n=== Ingest current ${CURRENT_DATE} ===`);
  const day2 = await uploadAndProcess(CURRENT_PDF, CURRENT_DATE);
  console.log(`  status=${day2.upload?.status} counts=${JSON.stringify(day2.upload?.counts)}`);
  if (day2.upload?.status !== 'completed') {
    console.error('Current roster did not complete:', day2.upload?.failureReason);
    process.exit(1);
  }

  const batchId = day2.upload?.batchId ?? null;
  const priorBatchId = day1.upload?.batchId ?? null;
  const ingestTotal = day2.upload?.counts?.total ?? 0;
  stages.push({
    stage: 'Identity candidates / decisions (ingest total)',
    count: ingestTotal,
    note: ingestTotal !== normalizedOk
      ? `ingest total ${ingestTotal} vs normalized ${normalizedOk} (see upload failureReason / issues)`
      : undefined,
  });

  // Roster set-diff is the authority for daily dispositions + the New Inmate Report.
  let dispCounts: Record<Disposition, number> = {
    new: 0, existing: 0, returning: 0, review: 0, unclassified: 0, failed: 0,
  };
  let byName = new Map<string, Disposition>();
  let reported: string[] = [];

  if (priorBatchId && batchId) {
    const { compareRosterBatches, isReportableNew } = await import(
      '../src/intelligence/inmates/rosterComparison.js'
    );
    const diff = await compareRosterBatches({
      priorBatchId,
      currentBatchId: batchId,
    });
    dispCounts = { ...diff.counts };
    byName = new Map(diff.current.map((r) => [r.name, r.disposition as Disposition]));
    reported = diff.current
      .filter((r) => isReportableNew(r.disposition))
      .map((r) => r.name);
  } else if (batchId) {
    const fallback = await dispositionAccounting(batchId);
    dispCounts = fallback.counts;
    byName = fallback.byName;
  }

  const classified =
    dispCounts.new + dispCounts.existing + dispCounts.returning + dispCounts.review;
  stages.push({
    stage: 'Classification (roster set-diff dispositions)',
    count: classified,
    note:
      classified !== rosterN
        ? `classified ${classified} vs unique parsed names ${rosterN}; failed=${dispCounts.failed} unclassified=${dispCounts.unclassified}`
        : 'new = on today not yesterday; returning = same + historical bookings',
  });

  // --- New inmate report -------------------------------------------------
  const toDate = nextDateIso(CURRENT_DATE);
  if (reported.length === 0) {
    const allNew = await getNewInmates({
      facility: FACILITY,
      from: CURRENT_DATE,
      to: toDate,
      limit: 5000,
      offset: 0,
    });
    reported = allNew.results.map((r) => normalizeName(r.name));
  }
  const reportedSet = new Set(reported);
  stages.push({
    stage: 'Report generation (new inmates in date window)',
    count: reported.length,
    note: `window ${CURRENT_DATE} .. ${toDate}`,
  });

  const goldSet = new Set(gold);
  const truePositives = gold.filter((n) => reportedSet.has(n));
  const falseNegatives = gold.filter((n) => !reportedSet.has(n));
  const falsePositives = reported.filter((n) => !goldSet.has(n));
  const tp = truePositives.length;
  const fn = falseNegatives.length;
  const fp = falsePositives.length;
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);

  const missExplanations: MissExplanation[] = [];
  for (const name of falseNegatives) {
    missExplanations.push(await explainMiss(name, batchId, priorNames, currentNames));
  }
  const extraExplanations: ExtraExplanation[] = [];
  for (const name of falsePositives) {
    extraExplanations.push(await explainExtra(name, batchId, priorNames));
  }

  let reportId: string | null = null;
  try {
    const generated = await generateAndPersistReport(
      { facility: FACILITY, from: CURRENT_DATE, to: toDate },
      OPERATOR,
    );
    reportId = generated.reportId;
  } catch (err) {
    console.log(`report generation note: ${err instanceof Error ? err.message : String(err)}`);
  }

  const stageGaps = assertStageContinuity(stages);
  const accountingOk =
    dispCounts.unclassified === 0
    && classified + dispCounts.failed === ingestTotal
    && (classified === rosterN || classified === ingestTotal);
  // Strict directive: New+Existing+Returning+Review = N (failed must be zero for pass)
  const reconcileOk =
    dispCounts.failed === 0
    && dispCounts.unclassified === 0
    && classified === rosterN;

  const accuracyOk = tp === EXPECTED_NEW && fp === 0 && fn === 0 && precision === 1 && recall === 1;
  const pass = accuracyOk && reconcileOk && stageGaps.length === 0;
  const processingTimeMs = Date.now() - runStartedAt;
  // Business metrics: each true positive is a potential new client found;
  // each false negative is a potentially missed business opportunity.
  const potentialClientsFound = tp;
  const potentialClientsMissed = fn;

  writeDailyCertificationSummary({
    status: pass ? 'PASS' : 'FAIL',
    priorDate: PRIOR_DATE,
    currentDate: CURRENT_DATE,
    priorInmateCount,
    currentInmateCount: rosterN,
    newInmates: dispCounts.new,
    existingInmates: dispCounts.existing,
    returningInmates: dispCounts.returning,
    reviewRequired: dispCounts.review,
    reconciliationOk: reconcileOk,
    processingTimeMs,
    potentialClientsFound,
    potentialClientsMissed,
    precision,
    recall,
    note: pass
      ? 'Certified against manual gold standard for this pair.'
      : 'Not certified — discrepancies entered the Learning Queue.',
  });

  // Engineering Certification Report (admin/dev) + Learning Queue (no discrepancy forgotten).
  try {
    const { recordEngineeringCertification } = await import(
      '../src/intelligence/inmates/engineeringCertification.js'
    );
    await recordEngineeringCertification({
      facility: FACILITY,
      priorDate: PRIOR_DATE,
      currentDate: CURRENT_DATE,
      priorInmateCount,
      currentInmateCount: rosterN,
      newInmates: dispCounts.new,
      existingInmates: dispCounts.existing,
      returningInmates: dispCounts.returning,
      reviewRequired: dispCounts.review,
      reconcileOk,
      precision,
      recall,
      potentialClientsFound,
      potentialClientsMissed,
      processingTimeMs,
      status: pass ? 'pass' : 'fail',
      misses: missExplanations.map((m) => ({
        name: m.name, stage: m.stage, rule: m.rule, evidence: m.evidence, why: m.why,
      })),
      extras: extraExplanations.map((m) => ({
        name: m.name, stage: 'Report generation', rule: m.rule, evidence: m.evidence, why: m.why,
      })),
      stageLedger: stages,
      operationalReportId: reportId,
      reportDir: REPORT_DIR,
    });
  } catch (err) {
    console.log(`engineering certification note: ${err instanceof Error ? err.message : String(err)}`);
  }

  const md = [
    '# Sacramento Validation Suite — Accuracy Certification Result',
    '',
    `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Run at:** ${new Date().toISOString()}`,
    `**Pair:** ${PRIOR_DATE} → ${CURRENT_DATE}`,
    `**Processing time:** ${(processingTimeMs / 1000).toFixed(1)}s`,
    '',
    '> Gold standard: manual investigator comparison — not the software.',
    '> Architecture frozen — Operational Validation Mode.',
    '',
    '## Daily certification summary',
    '',
    `| Field | Value |`,
    `|---|---:|`,
    `| Previous roster date | ${PRIOR_DATE} |`,
    `| Current roster date | ${CURRENT_DATE} |`,
    `| Previous inmate count | ${priorInmateCount} |`,
    `| Current inmate count (N) | ${rosterN} |`,
    `| New inmates | ${dispCounts.new} |`,
    `| Existing inmates | ${dispCounts.existing} |`,
    `| Returning inmates | ${dispCounts.returning} |`,
    `| Review required | ${dispCounts.review} |`,
    `| Total reconciliation | ${classified} |`,
    `| Reconciliation = N | ${reconcileOk ? 'YES' : 'NO'} |`,
    `| Certification status | ${pass ? 'PASS' : 'FAIL'} |`,
    '',
    '## Technical metrics vs ground truth',
    '',
    `| Metric | Value | Required |`,
    `|---|---:|---:|`,
    `| Ground truth (new) | ${EXPECTED_NEW} | ${EXPECTED_NEW} |`,
    `| NIIS new (report) | ${reported.length} | ${EXPECTED_NEW} |`,
    `| True positives | ${tp} | ${EXPECTED_NEW} |`,
    `| False positives | ${fp} | 0 |`,
    `| False negatives | ${fn} | 0 |`,
    `| Precision | ${(precision * 100).toFixed(1)}% | 100% |`,
    `| Recall | ${(recall * 100).toFixed(1)}% | 100% |`,
    '',
    '## Business metrics',
    '',
    `| Metric | Value |`,
    `|---|---:|`,
    `| Potential New Clients Found | ${potentialClientsFound} |`,
    `| Potential New Clients Missed | ${potentialClientsMissed} |`,
    '',
    '> A miss is a potentially missed business opportunity — not only a false negative.',
    '',
    '## Full roster disposition accounting',
    '',
    `| Disposition | Count |`,
    `|---|---:|`,
    `| New | ${dispCounts.new} |`,
    `| Existing | ${dispCounts.existing} |`,
    `| Returning | ${dispCounts.returning} |`,
    `| Review required | ${dispCounts.review} |`,
    `| Failed | ${dispCounts.failed} |`,
    `| Unclassified | ${dispCounts.unclassified} |`,
    `| **Sum (New+Existing+Returning+Review)** | **${classified}** |`,
    `| Current roster unique names (N) | ${rosterN} |`,
    `| Ingest total | ${ingestTotal} |`,
    `| Reconcile N | ${reconcileOk ? 'PASS' : 'FAIL'} |`,
    '',
    '## Stage ledger (current roster)',
    '',
    `| Stage | Count | Note |`,
    `|---|---:|---|`,
    ...stages.map((s) => `| ${s.stage} | ${s.count} | ${s.note ?? ''} |`),
    '',
    stageGaps.length
      ? `### Stage continuity failures\n\n${stageGaps.map((g) => `- ${g}`).join('\n')}`
      : '### Stage continuity\n\nNo unexplained silent losses between annotated stages.',
    '',
    '## False negatives — explain every miss (Potential New Clients Missed)',
    '',
    ...(missExplanations.length === 0
      ? ['*(none)*']
      : missExplanations.flatMap((m, i) => [
          `### ${i + 1}. ${m.name}`,
          '',
          `- **Stage:** ${m.stage}`,
          `- **Rule:** ${m.rule}`,
          `- **Evidence:** ${m.evidence}`,
          `- **Why:** ${m.why}`,
          '',
        ])),
    '## False positives — explain every extra',
    '',
    ...(extraExplanations.length === 0
      ? ['*(none)*']
      : extraExplanations.flatMap((m, i) => [
          `### ${i + 1}. ${m.name}`,
          '',
          `- **Rule:** ${m.rule}`,
          `- **Evidence:** ${m.evidence}`,
          `- **Why the system believed they were new:** ${m.why}`,
          '',
        ])),
    '## Offline parse diagnostics',
    '',
    `- Gold present in current PDF text: ${gold.filter((n) => currentNames.has(n)).length}/${EXPECTED_NEW}`,
    `- Gold missing from current PDF text: ${gold.filter((n) => !currentNames.has(n)).length}`,
    `- Gold also on prior PDF text: ${gold.filter((n) => priorNames.has(n)).length}`,
    '',
    reportId ? `Printable report id: ${reportId}` : '',
    '',
    '## Disposition sample (first 20 current names)',
    '',
    ...[...byName.entries()].slice(0, 20).map(([n, d]) => `- ${n}: ${d}`),
    '',
  ].join('\n');

  const out = join(REPORT_DIR, 'SACRAMENTO_VALIDATION_RESULT.md');
  writeFileSync(out, md);
  writeFileSync(join(REPORT_DIR, 'SACRAMENTO_VALIDATION_RESULT.json'), JSON.stringify({
    pass,
    mode: 'operational_validation',
    priorDate: PRIOR_DATE,
    currentDate: CURRENT_DATE,
    expectedNew: EXPECTED_NEW,
    priorInmateCount,
    currentInmateCount: rosterN,
    processingTimeMs,
    metrics: { tp, fp, fn, precision, recall, reported: reported.length },
    business: { potentialClientsFound, potentialClientsMissed },
    dispositions: dispCounts,
    rosterN,
    ingestTotal,
    classified,
    reconcileOk,
    accountingOk,
    stages,
    stageGaps,
    missExplanations,
    extraExplanations,
    reportId,
  }, null, 2));

  console.log(`\n${md}`);
  console.log(`Wrote ${out}`);
  console.log(`Wrote ${join(REPORT_DIR, 'DAILY_CERTIFICATION_SUMMARY.md')}`);

  await prisma.$disconnect();
  process.exit(pass ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
