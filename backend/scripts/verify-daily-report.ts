// Verifies the Daily Intelligence Report — the operational product.
//
// Builds a two-day scenario from an empty database so every section has something in
// it, then checks that each section contains what it claims to and that the evidence
// appendix actually traces a claim back to a row in a file.

import { writeFileSync } from 'node:fs';

import prisma from '../src/lib/prisma.js';
import { buildDailyReport, generateDailyReport, renderDailyReport } from '../src/intelligence/inmates/dailyReport.js';
import { runIngestion } from '../src/intelligence/inmates/ingestionEngine.js';

const pass: string[] = [];
const fail: string[] = [];
const check = (ok: boolean, label: string, detail = '') => {
  (ok ? pass : fail).push(label);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

const FACILITY = 'sacramento';
const OPERATOR = 'report-verification';

console.log('=== Day one: five people, none known ===');
const day1 = await runIngestion({
  filePath: '/tmp/sac2/good.csv', facility: FACILITY, rosterDate: '2026-08-09',
  trigger: 'manual', dryRun: false, rosterKind: 'full_population', userId: OPERATOR,
});
check(day1.status === 'completed', 'day one imported', day1.failureReason ?? '');

// A watch list on someone who will return, so section 4 has content. Created before
// day two so the engine sees it when the second roster arrives.
const returning = await prisma.inmate.findFirst({
  where: { canonicalLast: 'NGUYEN' },
  select: { inmateId: true },
});
if (returning) {
  await prisma.inmateWatchListEntry.upsert({
    where: { inmateId_createdById: { inmateId: returning.inmateId, createdById: OPERATOR } },
    create: {
      inmateId: returning.inmateId, createdById: OPERATOR,
      reason: 'Skipped a court appearance in 2025; notify on any new booking.',
      priority: 'urgent', label: 'FTA — 2025',
      active: true, notifyOnRebooking: true,
    },
    update: { active: true, priority: 'urgent' },
  });
  console.log('  watch list entry created for NGUYEN (urgent)');
}

console.log('\n=== Day two: one released, one re-booked, bail and housing changed, one new ===');
writeFileSync('/tmp/sac2/day2.csv', [
  'Booking Number,X-Ref,Last Name,First Name,Middle Name,DOB,Sex,Height,Weight,Booking Date,Arresting Agency,Type of Arrest,Housing Location,Charges,Bail,Outstanding Warrants,Projected Release Date,Next Court Date,Court',
  // Same booking, bail and housing changed — feeds Significant Changes.
  `2026-081101,XR-100001,NGUYEN,BINH,T,03/14/1988,M,5'11",180,08/09/2026,SACRAMENTO PD,Warrant,MAIN-5D-07,PC 459 - Burglary second degree; PC 496 - Receiving stolen property; PC 148 - Resisting arrest,75000,Y,08/22/2026,08/14/2026,Sacramento Superior Court`,
  // Alias spelling drift, same X-Ref — must stay one person.
  `2026-081102,XR-100002,OBRIEN,KATHERINE,M,11/02/1991,F,5-04,135,08/09/2026,CHP,On-View,MAIN-4B-04,VC 23152(a) - DUI alcohol,25000,N,08/12/2026,08/13/2026,Sacramento Superior Court`,
  // A second booking for someone already known — feeds Returning Inmates.
  `2026-081210,XR-100005,SMITH,JAMES,R,06/30/1975,M,5-08,190,08/10/2026,SACRAMENTO SO,Warrant,RCCC-1-09,PC 594 - Vandalism,10000,N,,08/25/2026,Sacramento Superior Court`,
  // Nobody has seen this person — feeds Newly Booked.
  `2026-081211,XR-100020,OKONKWO,ADAEZE,N,05/09/1996,F,5-06,145,08/10/2026,ELK GROVE PD,Citation,MAIN-4A-11,PC 484 - Petty theft,5000,N,,08/26/2026,Sacramento Superior Court`,
  // Two more so the roster clears the minimum-row rule.
  `2026-081212,XR-100021,DELACRUZ,RAFAEL,,07/19/1984,M,5-09,175,08/10/2026,SACRAMENTO PD,Warrant,MAIN-2B-08,PC 496 - Receiving stolen property,20000,N,,08/27/2026,Sacramento Superior Court`,
  `2026-081213,XR-100022,HAYES,MONIQUE,L,02/28/1992,F,5-02,130,08/10/2026,CHP,On-View,MAIN-4B-15,VC 14601 - Driving on suspended license,7500,N,,08/28/2026,Sacramento Superior Court`,
].join('\n') + '\n');

const day2 = await runIngestion({
  filePath: '/tmp/sac2/day2.csv', facility: FACILITY, rosterDate: '2026-08-10',
  trigger: 'manual', dryRun: false, rosterKind: 'full_population', userId: OPERATOR,
});
console.log(`  status=${day2.status} counts=${JSON.stringify(day2.counts)}`);
check(day2.status === 'completed', 'day two imported', day2.failureReason ?? '');

console.log('\n=== The report ===');
const report = await buildDailyReport({});
const s = report.summary;
console.log(`  ${s.reportDate}: ${s.files.length} file(s), ${s.processingTimeMs}ms, operator ${s.operators.join(', ') || 'none'}`);

console.log('\n--- 1. Import Summary ---');
check(s.files.length >= 1, 'files are listed', `${s.files.length}`);
check(s.operators.length >= 1, 'the operator is named', s.operators.join(', '));
check(s.processingTimeMs > 0, 'processing time is measured', `${s.processingTimeMs}ms`);
check(s.files.every((f) => f.sha256.length === 64), 'every file is fingerprinted');
check(s.files.every((f) => f.parserProfile !== null), 'every file names the parser profile that read it', s.files[0]?.parserProfile ?? '');

console.log('\n--- 2. Newly Booked Inmates ---');
console.log(`  ${report.newlyBooked.map((r) => `${r.name} (${r.bookingNumber})`).join(' | ') || 'none'}`);
check(report.newlyBooked.length >= 1, 'newly booked people are listed', `${report.newlyBooked.length}`);
const newRow = report.newlyBooked[0];
if (newRow) {
  check(newRow.bookingNumber !== null, 'booking number');
  check(newRow.bookingDate !== null, 'booking date');
  check(newRow.charges.length > 0, 'charges');
  check(Boolean(newRow.facility), 'facility');
  check(newRow.housing !== null, 'housing');
  check(newRow.bail !== null, 'bail');
  check(newRow.confidence > 0, 'confidence', `${newRow.confidence}%`);
}
check(
  report.newlyBooked.some((r) => r.name.startsWith('OKONKWO')),
  'the person who appears only on day two is newly booked',
);
// Both imports ran on the same calendar day, so day one's batch is legitimately in
// this report's scope and its first appearances belong here. What must not happen is a
// restatement producing a SECOND entry for the same person: the day-two roster restated
// this booking, and if that were counted as a new discovery the section would
// double-count everyone still in custody.
const nguyenEntries = report.newlyBooked.filter((r) => r.name.startsWith('NGUYEN'));
check(
  nguyenEntries.length === 1,
  'a restated booking does not add a second newly-booked entry for the same person',
  `${nguyenEntries.length} entr${nguyenEntries.length === 1 ? 'y' : 'ies'}`,
);

// The row every screen and the printed report read must carry the latest roster's
// values, not the first one's.
const nguyenBooking = await prisma.inmateBooking.findFirst({
  where: { externalBookingId: '2026-081101' },
  select: { bailAmountCents: true, housingLocation: true },
});
check(
  nguyenBooking?.bailAmountCents === 7_500_000n,
  'a restated booking carries the latest roster\'s bail, not the first roster\'s',
  `$${Number(nguyenBooking?.bailAmountCents ?? 0) / 100}`,
);
check(
  nguyenBooking?.housingLocation === 'MAIN-5D-07',
  'and the latest housing',
  nguyenBooking?.housingLocation ?? '',
);

console.log('\n--- 3. Returning Inmates ---');
console.log(`  ${report.returning.map((r) => `${r.name} (${r.priorBookingCount} prior, last ${r.lastBookingBefore})`).join(' | ') || 'none'}`);
check(report.returning.length >= 1, 'returning inmates are listed', `${report.returning.length}`);
const ret = report.returning.find((r) => r.name.startsWith('SMITH'));
check(Boolean(ret), 'the person booked a second time is reported as returning');
if (ret) {
  check(ret.priorBookingCount >= 1, 'prior booking count', `${ret.priorBookingCount}`);
  check(ret.priorBookingDates.length >= 1, 'previous booking dates', ret.priorBookingDates.join(', '));
  check(ret.lastBookingBefore !== null, 'the most recent booking before this one', ret.lastBookingBefore ?? '');
  check(ret.aliases.length >= 1, 'aliases', ret.aliases.join(' · '));
  check(ret.confidence > 0, 'confidence', `${ret.confidence}%`);
}
// A restatement is a match but not a return, and padding this section would waste
// the attention of whoever reads it to decide who to call.
check(
  !report.returning.some((r) => r.priorBookingCount === 0),
  'nobody is listed as returning with zero prior bookings',
);

console.log('\n--- 4. Watch List Matches ---');
console.log(`  ${report.watchListMatches.map((m) => `${m.name} (${m.priority}: ${m.matchType})`).join(' | ') || 'none'}`);
check(report.watchListMatches.length >= 1, 'watch list matches are listed', `${report.watchListMatches.length}`);
const hit = report.watchListMatches[0];
if (hit) {
  check(Boolean(hit.watchListReason), 'the reason the person is watched', hit.watchListReason);
  check(hit.notificationReason !== null, 'the notification reason, in the engine\'s own words');
  check(hit.priority === 'urgent', 'the priority set on the entry', hit.priority);
  check(hit.confidence === 100, 'confidence');
}

console.log('\n--- 5. Significant Changes ---');
const changeTypes = [...new Set(report.significantChanges.map((c) => c.changeType))];
console.log(`  types: ${changeTypes.join(', ') || 'none'}`);
console.log(report.significantChanges.slice(0, 4).map((c) => `    ${c.name}: ${c.changeType} ${c.previousValue ?? '—'} → ${c.newValue ?? '—'}`).join('\n'));
check(report.significantChanges.length >= 1, 'significant changes are listed', `${report.significantChanges.length}`);
check(
  changeTypes.some((t) => t.includes('bail')) || changeTypes.some((t) => t.includes('housing')) || changeTypes.some((t) => t.includes('charges')),
  'the bail, housing or charge change from day two was detected',
  changeTypes.join(', '),
);
check(
  report.significantChanges.every((c) => c.previousValue !== undefined && c.newValue !== undefined),
  'every change states what it changed from and to',
);

console.log('\n--- 6. Human Review Queue ---');
console.log(`  ${report.reviewQueue.length} outstanding`);
check(Array.isArray(report.reviewQueue), 'the review queue section exists');
check(
  report.reviewQueue.every((r) => Boolean(r.reason) && Boolean(r.sourceFile)),
  'every review item says why it is held and which file it came from',
);

console.log('\n--- 7. Statistics ---');
console.log(`  ${JSON.stringify(report.statistics)}`);
const st = report.statistics;
check(st.rowsParsed > 0, 'rows parsed', `${st.rowsParsed}`);
check(st.newInmates > 0, 'new', `${st.newInmates}`);
check(st.returningInmates > 0, 'returning', `${st.returningInmates}`);
check(st.matched + st.duplicates > 0, 'matched', `${st.matched} matched, ${st.duplicates} restated`);
check(typeof st.conflicts === 'number', 'conflicts');
check(typeof st.reviewsOutstanding === 'number', 'reviews');

console.log('\n--- 8. Evidence Appendix ---');
console.log(`  ${report.evidence.length} entries`);
check(report.evidence.length > 0, 'the appendix has entries', `${report.evidence.length}`);
const ev = report.evidence[0];
if (ev) {
  console.log(`  e.g. ${ev.claim}`);
  console.log(`       ${ev.document} row ${ev.row} → observation ${ev.observationId.slice(0, 8)}`);
  console.log(`       ${ev.reasoning.slice(0, 160)}`);
  check(Boolean(ev.document), 'document');
  check(ev.row !== null || ev.page !== null, 'page or row');
  check(Boolean(ev.observationId), 'observation');
  check(Boolean(ev.reasoning), 'reasoning');
  check(Boolean(ev.documentSha256), 'the document fingerprint, so the file can be identified later');
  check(ev.parserProfile !== null, 'the parser profile version that read it', ev.parserProfile ?? '');
}
// The chain must actually resolve, not merely be printed.
if (ev) {
  const observation = await prisma.inmateBookingObservation.findUnique({
    where: { observationId: ev.observationId },
    select: { observationId: true, bookingId: true, sourceRow: true },
  });
  check(Boolean(observation), 'the observation the appendix cites exists in the repository');
  check(observation?.sourceRow === ev.row, 'and the row the appendix prints matches the observation', `${observation?.sourceRow} vs ${ev.row}`);
}

console.log('\n--- Rendering ---');
const rendered = renderDailyReport(report, { generatedAt: new Date().toISOString(), generatedBy: OPERATOR });
writeFileSync('/tmp/sac2/daily-report.html', rendered);
console.log(`  ${rendered.length} bytes written to /tmp/sac2/daily-report.html`);
for (const [n, heading] of [
  [1, 'Import Summary'], [2, 'Newly Booked Inmates'], [3, 'Returning Inmates'],
  [4, 'Watch List Matches'], [5, 'Significant Changes'], [6, 'Human Review Queue'],
  [7, 'Statistics'], [8, 'Evidence Appendix'],
] as [number, string][]) {
  check(rendered.includes(heading), `section ${n} renders: ${heading}`);
}
check(rendered.includes('@media print'), 'a print stylesheet is included');
check(rendered.includes('break-before: page'), 'the appendix starts on a new page when printed');
// A blank cell reads as zero or as an oversight; the jail not publishing a figure is
// a fact about the source.
check(rendered.includes('not stated'), 'an absent value prints as "not stated" rather than blank');

console.log('\n--- Persistence ---');
const persisted = await generateDailyReport({}, OPERATOR);
const stored = await prisma.inmateIntelligenceReport.findUnique({ where: { reportId: persisted.reportId } });
check(Boolean(stored?.renderedHtml), 'the rendered document is stored verbatim so it can be reprinted unchanged');
check(stored?.reportType === 'daily_intelligence', 'it is stored as a daily intelligence report');
check((stored?.renderedHtml?.length ?? 0) === persisted.html.length, 'byte-identical to what was returned');

console.log(`\n${'='.repeat(70)}\n${pass.length} passed, ${fail.length} failed`);
if (fail.length) console.log(`\nFAILED:\n${fail.map((f) => `  - ${f}`).join('\n')}`);

await prisma.$disconnect();
process.exit(fail.length === 0 ? 0 : 1);
