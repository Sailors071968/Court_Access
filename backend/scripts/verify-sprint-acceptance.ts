// The acceptance test, run against a real database through the same functions the
// dashboard calls.
//
// The steps are the ones in the sprint brief: upload today's roster, process it, look
// at the new inmates, open one, print the report, then repeat tomorrow with a new
// roster and see only the newly discovered people highlighted.
//
// It prints evidence rather than assertions so a failure is diagnosable from the
// output alone.

import { createReadStream } from 'node:fs';

import prisma from '../src/lib/prisma.js';
import { getDashboardSummary, getImportHistory } from '../src/intelligence/inmates/dashboardSummary.js';
import { getPersonDetail, searchHistorical } from '../src/intelligence/inmates/personDetail.js';
import { getNewInmates } from '../src/intelligence/inmates/repository.js';
import { generateAndPersistReport } from '../src/intelligence/inmates/reportGenerator.js';
import { decideReview, reviewQueueDetailed } from '../src/intelligence/inmates/reviewDecisions.js';
import { listUploads, processingQueue, startProcessing, storeUpload } from '../src/intelligence/inmates/rosterUploads.js';

const pass: string[] = [];
const fail: string[] = [];
const check = (ok: boolean, label: string, detail = '') => {
  (ok ? pass : fail).push(label);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

const FACILITY = 'sacramento';
const OPERATOR = 'acceptance-operator';

/** Wait for the background processor to finish, with a ceiling so a hang fails. */
async function waitForIdle(timeoutMs = 60_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const queue = await processingQueue();
    const busy = queue.active.some((u) => u.status === 'processing' || u.status === 'queued');
    if (!busy) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function uploadAndProcess(filePath: string, rosterDate: string, label: string) {
  const stored = await storeUpload({
    facility: FACILITY,
    originalName: `${label}.csv`,
    stream: createReadStream(filePath),
    uploadedById: OPERATOR,
    uploadedByName: 'Acceptance Operator',
    rosterDate,
    rosterKind: 'full_population',
  });
  if ('error' in stored) throw new Error(`upload failed: ${stored.error}`);

  const started = await startProcessing({ uploadIds: [stored.uploadId], userId: OPERATOR });
  if (started.started.length !== 1) {
    throw new Error(`processing not started: ${JSON.stringify(started.skipped)}`);
  }

  const idle = await waitForIdle();
  if (!idle) throw new Error('processing did not finish within the timeout');

  const uploads = await listUploads({ limit: 5, offset: 0 });
  const row = uploads.uploads.find((u) => u.uploadId === stored.uploadId);
  return { uploadId: stored.uploadId, upload: row };
}

console.log('=== Step 1. Sacramento County is configured ===');
const facility = await prisma.inmateFacility.findUnique({ where: { code: FACILITY } });
check(Boolean(facility), 'the facility exists', facility?.name);
const profiles = await prisma.inmateParserProfile.findMany({ where: { facility: FACILITY, active: true } });
check(profiles.length >= 1, 'a versioned parser profile is published', `${profiles.length} profile(s)`);

console.log('\n=== Step 2. Upload and process today\'s roster ===');
const day1 = await uploadAndProcess('/tmp/sac/day1.csv', '2026-08-08', 'sacramento-roster-2026-08-08');
console.log(`  upload status=${day1.upload?.status} stage=${day1.upload?.stage} duration=${day1.upload?.durationMs}ms`);
console.log(`  counts=${JSON.stringify(day1.upload?.counts)}`);
check(day1.upload?.status === 'completed', 'the roster processed to completion', day1.upload?.failureReason ?? undefined);
check(day1.upload?.stage === 'complete', 'the final stage is complete');
check(Boolean(day1.upload?.batchId), 'an import batch was recorded');
check((day1.upload?.counts?.total ?? 0) === 4, 'all four rows were read', String(day1.upload?.counts?.total));

console.log('\n=== Step 3. The dashboard reports the session ===');
const dashboard = await getDashboardSummary({});
console.log(`  session ${dashboard.session.date}: ${dashboard.session.filesProcessed} file(s), ${dashboard.session.processingTimeMs}ms`);
console.log(`  results=${JSON.stringify(dashboard.results)}`);
check(dashboard.session.filesProcessed >= 1, 'files processed is reported');
check(dashboard.results.newInmates === 4, 'four new inmates on the first roster', String(dashboard.results.newInmates));
check(dashboard.results.returningInmates === 0, 'nobody is returning on a first import');
check(dashboard.session.processingTimeMs > 0, 'processing time is measured', `${dashboard.session.processingTimeMs}ms`);
check(dashboard.uploads.length >= 1, 'the session lists its files');

console.log('\n=== Step 4. Today\'s new inmates grid ===');
const newInmates = await getNewInmates({ limit: 100, offset: 0 });
check(newInmates.total >= 4, 'the grid has rows', `${newInmates.total} total`);
const first = newInmates.results[0];
console.log(`  e.g. ${first.name} · booking ${first.externalBookingId} · ${first.charges.length} charge(s) · bail ${first.bailAmount ?? 'none'}`);
check(
  newInmates.results.every((r) => r.name && r.facility),
  'every row has a name and a facility',
);
check(
  newInmates.results.some((r) => r.externalBookingId !== null),
  'booking numbers were parsed',
);
check(
  newInmates.results.some((r) => r.charges.length > 0),
  'charges were parsed',
);
check(
  newInmates.results.some((r) => r.bailAmount !== null),
  'bail was parsed',
);
// The compound surname is the one most likely to be mangled, so it is checked by name.
const compound = newInmates.results.find((r) => r.name.startsWith('GARCIA-LOPEZ'));
check(Boolean(compound), 'a compound surname survived normalization', compound?.name);

console.log('\n=== Step 5. Click a person and see their record ===');
const detail = await getPersonDetail(first.inmateId);
check(Boolean(detail), 'the person detail loads');
if (detail) {
  console.log(`  ${detail.identity.name} · ${detail.aliases.length} alias(es) · ${detail.evidence.length} observation(s)`);
  check(detail.currentBooking !== null, 'a current booking is shown');
  check(detail.aliases.length >= 1, 'the roster spelling was recorded as an alias');
  check(detail.evidence.length >= 1, 'the evidence trail is present');
  check(
    detail.evidence.every((e) => e.document !== null && e.sourceRow !== null),
    'every observation names its document and row',
  );
  check(detail.importHistory.length >= 1, 'the import that found them is listed');
  check(detail.timeline.length >= 1, 'the timeline has entries');
  check(detail.identity.externalIds.length >= 1, "the jail's person identifier was recorded", detail.identity.externalIds[0]?.externalId);
}

console.log('\n=== Step 6. Print today\'s report ===');
const report = await generateAndPersistReport({ from: '2026-08-08', to: '2026-08-09' }, OPERATOR);
console.log(`  report ${report.reportId} · ${report.rowCount} row(s) · ${report.html.length} bytes of HTML`);
check(report.rowCount >= 4, 'the report covers the new inmates', String(report.rowCount));
check(report.html.includes('@media print'), 'the report carries a print stylesheet');
check(report.html.includes(first.name.split(',')[0]), 'a booked person appears in the report');
const persisted = await prisma.inmateIntelligenceReport.findUnique({ where: { reportId: report.reportId } });
check(Boolean(persisted), 'the report was persisted verbatim so it can be reprinted');

console.log('\n=== Step 7. Tomorrow: a new roster shows only the new discoveries ===');
const day2 = await uploadAndProcess('/tmp/sac/day2.csv', '2026-08-09', 'sacramento-roster-2026-08-09');
console.log(`  upload status=${day2.upload?.status} counts=${JSON.stringify(day2.upload?.counts)}`);
check(day2.upload?.status === 'completed', 'the second roster processed', day2.upload?.failureReason ?? undefined);

const secondDay = await getDashboardSummary({ date: new Date().toISOString().slice(0, 10) });
console.log(`  results=${JSON.stringify(secondDay.results)}`);

const newOnDay2 = await getNewInmates({ from: '2026-08-09', to: '2026-08-09', limit: 100, offset: 0 });
console.log(`  newly discovered with a 9 Aug booking: ${newOnDay2.results.map((r) => r.name).join(', ') || 'none'}`);
// WASHINGTON is on the second roster only; NGUYEN and O'BRIEN are restatements and
// SMITH is a second booking for someone already known.
check(
  newOnDay2.results.some((r) => r.name.startsWith('WASHINGTON')),
  'the person who appears only on the second roster is newly discovered',
);
check(
  !newOnDay2.results.some((r) => r.name.startsWith('NGUYEN')),
  'a person restated on the second roster is not reported as newly discovered again',
);

// The surname and given name both changed spelling between rosters. Finding one
// person rather than two is the identity engine doing its job.
const obrien = await searchHistorical({ last: 'BRIEN', limit: 20, offset: 0 });
console.log(`  searching "BRIEN": ${obrien.results.map((r) => `${r.name} (${r.bookingCount} booking(s), ${r.aliasCount} alias(es))`).join(' | ') || 'nothing'}`);
check(obrien.total >= 1, 'the alias spelling is findable', `${obrien.total} match(es)`);

const smith = await searchHistorical({ externalPersonId: 'XR-11902', limit: 10, offset: 0 });
console.log(`  searching X-Ref XR-11902: ${smith.results.map((r) => `${r.name} (${r.bookingCount} booking(s))`).join(' | ') || 'nothing'}`);
check(smith.total === 1, "search by the jail's person identifier finds exactly one person", `${smith.total}`);
check(
  smith.results[0]?.bookingCount === 2,
  'their two bookings are on one person rather than two records',
  `${smith.results[0]?.bookingCount} booking(s)`,
);

console.log('\n=== Step 8. Import history logs both runs ===');
const history = await getImportHistory({ limit: 10, offset: 0 });
const ours = history.results.filter((h) => h.facility === FACILITY);
console.log(ours.slice(0, 4).map((h) => `  ${h.rosterDate} ${h.filename}: read=${h.recordsTotal} new=${h.newInmates} matched=${h.matched} dup=${h.duplicates} review=${h.reviewRequired} ${h.durationMs}ms by ${h.operator}`).join('\n'));
check(ours.length >= 2, 'both runs are logged', `${ours.length} run(s)`);
check(ours.every((h) => h.durationMs !== null), 'every run records its duration');
check(ours.every((h) => h.operator !== null), 'every run records its operator');
check(ours.every((h) => h.parserVersion !== null), 'every run records which parser version read it');
check(ours.every((h) => h.batchId), 'every run has an import id');

console.log('\n=== Step 9. Review queue, if anything needs deciding ===');
const queue = await reviewQueueDetailed({ limit: 10, offset: 0 });
console.log(`  ${queue.total} record(s) awaiting review`);
if (queue.total > 0) {
  const item = queue.results[0];
  console.log(`  ${item.subject?.last}, ${item.subject?.first} at ${item.confidence}% — candidate: ${item.candidate?.name ?? 'none'}`);
  check(item.subject !== null, 'the queue shows what the roster said');
  check(
    item.candidate !== null || item.evidence?.reviewRationale !== undefined,
    'the queue explains either who the candidate is or why there is none',
  );

  // A rejection with no reason must be refused before anything is written.
  const refused = await decideReview({
    recordId: item.recordId,
    decision: 'reject_merge',
    reviewerId: OPERATOR,
  });
  check(!refused.ok, 'rejecting without a reason is refused', refused.reason);

  const decided = await decideReview({
    recordId: item.recordId,
    decision: item.candidate ? 'approve_merge' : 'create_new_person',
    reviewerId: OPERATOR,
    note: 'Acceptance test decision.',
  });
  check(decided.ok, 'the decision was applied', decided.reason ?? `booking ${decided.bookingId}`);
  if (decided.ok && decided.bookingId) {
    // The decision is the write ingestion deferred, so the booking must exist now
    // and must not have existed before.
    const booking = await prisma.inmateBooking.findUnique({ where: { bookingId: decided.bookingId } });
    check(Boolean(booking), 'the deferred booking now exists');
    const after = await reviewQueueDetailed({ limit: 10, offset: 0 });
    check(after.total === queue.total - 1, 'the queue shrank by one', `${queue.total} → ${after.total}`);
  }
} else {
  console.log('  (nothing needed review on this data, so the decision path is covered by unit tests)');
}

console.log('\n=== Step 10. Re-uploading the same file changes nothing ===');
const repeat = await uploadAndProcess('/tmp/sac/day2.csv', '2026-08-09', 'sacramento-roster-2026-08-09-again');
console.log(`  status=${repeat.upload?.status} counts=${JSON.stringify(repeat.upload?.counts)}`);
check(repeat.upload?.status === 'completed', 'the repeat upload was handled without error');
check((repeat.upload?.counts?.total ?? -1) === 0, 'the repeat wrote no records', String(repeat.upload?.counts?.total));

const peopleAfter = await prisma.inmate.count({ where: { mergedIntoId: null } });
console.log(`\n  repository now holds ${peopleAfter} people`);

console.log(`\n${'='.repeat(70)}\n${pass.length} passed, ${fail.length} failed`);
if (fail.length) console.log(`\nFAILED:\n${fail.map((f) => `  - ${f}`).join('\n')}`);

await prisma.$disconnect();
process.exit(fail.length === 0 ? 0 : 1);
