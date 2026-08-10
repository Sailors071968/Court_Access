#!/usr/bin/env tsx
/**
 * Sacramento Validation Suite — gold-standard acceptance test.
 *
 * Objective: given complete SACJAILSCAN rosters for 08/09/2026 and 08/10/2026,
 * NIIS must independently produce the same 67 newly booked inmates identified by
 * manual comparison.
 *
 * Pass criteria: Ground Truth 67 / NIIS 67 / Missing 0 / Extra 0
 *
 * Usage (clean DB recommended):
 *   cd backend
 *   npx tsx scripts/seed-sacramento.ts
 *   npx tsx scripts/sacramento-validation-suite.ts
 *
 * Optional env:
 *   SAC_PRIOR_PDF   path to 08/09 PDF (default fixtures/sacramento/validation/SACJAILSCAN08-09-2026.pdf)
 *   SAC_CURRENT_PDF path to 08/10 PDF (default fixtures/sacramento/validation/SACJAILSCAN08-10-2026.pdf)
 *   SAC_GOLD_LIST   path to 67-name list
 *   SAC_WIPE=1      delete Sacramento NIIS people/bookings/batches before run (destructive)
 */

import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import prisma from '../src/lib/prisma.js';
import { getNewInmates } from '../src/intelligence/inmates/repository.js';
import { generateAndPersistReport } from '../src/intelligence/inmates/reportGenerator.js';
import { listUploads, processingQueue, startProcessing, storeUpload } from '../src/intelligence/inmates/rosterUploads.js';
import { parsePdfRoster } from '../src/intelligence/inmates/parsers/pdfParser.js';
import { SACRAMENTO_PDF } from '../src/intelligence/inmates/parsers/sacramento.js';

const FACILITY = 'sacramento';
const OPERATOR = 'sacramento-validation-suite';
const ROOT = resolve(import.meta.dirname, '../..');
const VALIDATION_DIR = join(ROOT, 'fixtures/sacramento/validation');
const REPORT_DIR = join(ROOT, 'reports/niis-reliability');

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
  process.env.SAC_GOLD_LIST
    ?? join(VALIDATION_DIR, 'ground-truth-67-names.txt'),
);

function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadGoldList(path: string): string[] {
  const text = readFileSync(path, 'utf8');
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line) => line && !line.startsWith('#') && line.includes(','))
    .map(normalizeName);
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
  console.log('SAC_WIPE=1 — clearing Sacramento NIIS operational tables for facility…');
  // Delete by facility where the column exists; cascade-related rows via booking ids.
  const bookingIds = (
    await prisma.inmateBooking.findMany({ where: { facility: FACILITY }, select: { bookingId: true, inmateId: true } })
  );
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

function stageParse(label: string, filePath: string, rosterDate: string) {
  return parsePdfRoster(filePath, SACRAMENTO_PDF.columnMap, { rosterDate }).then((parsed) => {
    console.log(`\n=== Stage parse: ${label} ===`);
    console.log(`  pages=${parsed.stats.pageCount} records=${parsed.records.length} ocr=${parsed.stats.ocrUsed}`);
    for (const issue of parsed.issues.slice(0, 8)) {
      console.log(`  [${issue.severity}] ${issue.code}: ${issue.message}`);
    }
    return parsed;
  });
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  console.log('=== Sacramento Validation Suite ===');
  console.log(`prior:   ${PRIOR_PDF}`);
  console.log(`current: ${CURRENT_PDF}`);
  console.log(`gold:    ${GOLD_LIST}`);

  const missingInputs: string[] = [];
  if (!existsSync(PRIOR_PDF)) missingInputs.push(PRIOR_PDF);
  if (!existsSync(CURRENT_PDF)) missingInputs.push(CURRENT_PDF);
  if (!existsSync(GOLD_LIST)) missingInputs.push(GOLD_LIST);

  if (missingInputs.length > 0) {
    const msg = [
      'BLOCKED: required validation inputs are missing:',
      ...missingInputs.map((p) => `  - ${p}`),
      '',
      'Place the complete SACJAILSCAN PDFs under fixtures/sacramento/validation/',
      'or set SAC_PRIOR_PDF / SAC_CURRENT_PDF. Import Inspection copies are not durable.',
    ].join('\n');
    console.error(msg);
    writeFileSync(join(REPORT_DIR, 'SACRAMENTO_VALIDATION_RESULT.md'), `# Sacramento Validation Suite — BLOCKED\n\n${msg}\n`);
    process.exit(2);
  }

  const gold = loadGoldList(GOLD_LIST);
  if (gold.length !== 67) {
    console.error(`Gold list must contain exactly 67 names; found ${gold.length}`);
    process.exit(2);
  }

  const priorParse = await stageParse('08/09 prior', PRIOR_PDF, '2026-08-09');
  const currentParse = await stageParse('08/10 current', CURRENT_PDF, '2026-08-10');
  if (priorParse.records.length < 100 || currentParse.records.length < 100) {
    console.error('Parse yielded too few records for a full county roster — aborting before ingest.');
    process.exit(1);
  }

  // Offline set-diff diagnostic (not NIIS report — measures parser coverage of gold).
  const priorNames = new Set(priorParse.records.map((r) => normalizeName(String(r.Name ?? ''))));
  const currentNames = new Set(currentParse.records.map((r) => normalizeName(String(r.Name ?? ''))));
  const offlineNew = [...currentNames].filter((n) => !priorNames.has(n)).sort();
  const goldInCurrent = gold.filter((n) => currentNames.has(n));
  const goldMissingFromCurrent = gold.filter((n) => !currentNames.has(n));
  const goldAlsoOnPrior = gold.filter((n) => priorNames.has(n));
  console.log('\n=== Offline parse set-diff (diagnostic) ===');
  console.log(`  prior names: ${priorNames.size}`);
  console.log(`  current names: ${currentNames.size}`);
  console.log(`  offline new (current \\ prior): ${offlineNew.length}`);
  console.log(`  gold present on current PDF text: ${goldInCurrent.length}/67`);
  console.log(`  gold missing from current PDF text: ${goldMissingFromCurrent.length}`);
  console.log(`  gold also present on prior PDF text: ${goldAlsoOnPrior.length}`);

  if (process.env.SAC_WIPE === '1') await wipeSacramento();

  console.log('\n=== Ingest 08/09 ===');
  const day1 = await uploadAndProcess(PRIOR_PDF, '2026-08-09');
  console.log(`  status=${day1.upload?.status} stage=${day1.upload?.stage} counts=${JSON.stringify(day1.upload?.counts)}`);
  if (day1.upload?.status !== 'completed') {
    console.error('Prior roster did not complete:', day1.upload?.failureReason);
    process.exit(1);
  }

  console.log('\n=== Ingest 08/10 ===');
  const day2 = await uploadAndProcess(CURRENT_PDF, '2026-08-10');
  console.log(`  status=${day2.upload?.status} stage=${day2.upload?.stage} counts=${JSON.stringify(day2.upload?.counts)}`);
  if (day2.upload?.status !== 'completed') {
    console.error('Current roster did not complete:', day2.upload?.failureReason);
    process.exit(1);
  }

  console.log('\n=== New Inmate Report (isFirstAppearance on 08/10 roster date) ===');
  // With roster-date bookedAt, first appearances booked on 08/10 are the newly booked.
  const allNew = await getNewInmates({
    facility: FACILITY,
    from: '2026-08-10',
    to: '2026-08-11',
    limit: 5000,
    offset: 0,
  });
  const reported = allNew.results.map((r) => normalizeName(r.name));
  const reportedSet = new Set(reported);
  const goldSet = new Set(gold);

  const truePositives = gold.filter((n) => reportedSet.has(n));
  const falseNegatives = gold.filter((n) => !reportedSet.has(n));
  const falsePositives = reported.filter((n) => !goldSet.has(n));

  const tp = truePositives.length;
  const fn = falseNegatives.length;
  const fp = falsePositives.length;
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);

  let reportId: string | null = null;
  try {
    const generated = await generateAndPersistReport(
      { facility: FACILITY, from: '2026-08-10', to: '2026-08-11' },
      OPERATOR,
    );
    reportId = generated.reportId;
    console.log(`  printable report id=${generated.reportId} rows=${generated.rowCount}`);
  } catch (err) {
    console.log(`  report generation note: ${err instanceof Error ? err.message : String(err)}`);
  }

  const pass = tp === 67 && fp === 0 && fn === 0;
  const md = [
    '# Sacramento Validation Suite — Result',
    '',
    `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Run at:** ${new Date().toISOString()}`,
    '',
    '## Metrics',
    '',
    `| Metric | Value |`,
    `|---|---:|`,
    `| Ground truth | 67 |`,
    `| NIIS reported (filtered) | ${reported.length} |`,
    `| True positives | ${tp} |`,
    `| False positives | ${fp} |`,
    `| False negatives | ${fn} |`,
    `| Precision | ${(precision * 100).toFixed(1)}% |`,
    `| Recall | ${(recall * 100).toFixed(1)}% |`,
    `| Missing | ${fn} |`,
    `| Extra | ${fp} |`,
    '',
    '## Stage counts',
    '',
    `| Stage | 08/09 | 08/10 |`,
    `|---|---:|---:|`,
    `| PDF pages | ${priorParse.stats.pageCount} | ${currentParse.stats.pageCount} |`,
    `| Rows parsed | ${priorParse.records.length} | ${currentParse.records.length} |`,
    `| Upload status | ${day1.upload?.status} | ${day2.upload?.status} |`,
    `| Upload totals | ${day1.upload?.counts?.total ?? '?'} | ${day2.upload?.counts?.total ?? '?'} |`,
    '',
    '## Offline parse diagnostics',
    '',
    `- Gold present in 08/10 text: ${goldInCurrent.length}/67`,
    `- Gold missing from 08/10 text: ${goldMissingFromCurrent.length}`,
    `- Gold also on 08/09 text: ${goldAlsoOnPrior.length}`,
    `- Offline set-diff new names: ${offlineNew.length}`,
    '',
    '## False negatives (expected new, NIIS missed)',
    '',
    ...(falseNegatives.length ? falseNegatives.map((n, i) => `${i + 1}. ${n}`) : ['*(none)*']),
    '',
    '## False positives (NIIS reported, not in gold list)',
    '',
    ...(falsePositives.length ? falsePositives.map((n, i) => `${i + 1}. ${n}`) : ['*(none)*']),
    '',
    reportId ? `Printable report id: ${reportId}` : '',
    '',
  ].join('\n');

  const out = join(REPORT_DIR, 'SACRAMENTO_VALIDATION_RESULT.md');
  writeFileSync(out, md);
  console.log(`\n${md}`);
  console.log(`Wrote ${out}`);

  await prisma.$disconnect();
  process.exit(pass ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
