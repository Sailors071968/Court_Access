// Verifies the Phase 2B operational layer: batch lifecycle, morning summary, report
// approval, batch comparison and metrics.
//
// Two rosters a day apart, so the comparison has something real to compare and the
// morning summary has a yesterday to remember.

import { writeFileSync } from 'node:fs';

import prisma from '../src/lib/prisma.js';
import { cancelBatch, closeBatch, getBatchLifecycle } from '../src/intelligence/inmates/batchLifecycle.js';
import { generateDailyReport } from '../src/intelligence/inmates/dailyReport.js';
import { runIngestion } from '../src/intelligence/inmates/ingestionEngine.js';
import {
  compareBatches, getBatchMetrics, getMetricTrend, getMorningSummary,
  listReports, setReportState,
} from '../src/intelligence/inmates/operations.js';

const pass: string[] = [];
const fail: string[] = [];
const check = (ok: boolean, label: string, detail = '') => {
  (ok ? pass : fail).push(label);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

const FACILITY = 'sacramento';
const OPERATOR = 'operations-verification';
const today = new Date().toISOString().slice(0, 10);

console.log('=== 1. Morning summary before anything has been imported ===');
const cold = await getMorningSummary();
console.log(`  posture=${cold.posture}`);
console.log(`  "${cold.headline}"`);
check(cold.lastSuccessfulImport === null, 'no last successful import is claimed');
check(cold.today.processed === false, "today is reported as not processed");
check(cold.posture === 'action_required', 'the posture is action required, because a roster is missing');
check(
  cold.headline.toLowerCase().includes('not been imported'),
  'and the headline says so in a sentence rather than leaving the operator to infer it',
);
check(cold.health.database === 'ok', 'database health is reported');

console.log('\n=== 2. Import, and the lifecycle records every stage ===');
const day1 = await runIngestion({
  filePath: '/tmp/sac2/good.csv', facility: FACILITY, rosterDate: today,
  trigger: 'manual', dryRun: false, rosterKind: 'full_population', userId: OPERATOR,
});
check(day1.status === 'completed', 'the import completed', day1.failureReason ?? '');

const lifecycle = await getBatchLifecycle(day1.batchId!);
console.log(`  state=${lifecycle?.lifecycleState} step ${lifecycle?.progress.step}/${lifecycle?.progress.total}`);
console.log(lifecycle?.transitions.map((t) => `    ${t.fromState ?? '(start)'} → ${t.toState}${t.durationMs !== null ? ` (${t.durationMs}ms)` : ''}`).join('\n'));

check(lifecycle?.lifecycleState === 'completed', 'the batch ends in completed');
const states = lifecycle?.transitions.map((t) => t.toState) ?? [];
for (const expected of [
  'validation_passed', 'parsing', 'observation_creation',
  'identity_analysis', 'intelligence_generation', 'persisted', 'completed',
]) {
  check(states.includes(expected), `the lifecycle passed through ${expected}`);
}
check(
  states.indexOf('identity_analysis') > states.indexOf('parsing'),
  'and the states are recorded in order, not as a set',
);
check(
  (lifecycle?.transitions.filter((t) => t.durationMs !== null).length ?? 0) >= 5,
  'each state records how long the previous one took',
);
check(
  lifecycle?.transitions.every((t) => t.versions.parserVersion !== null) ?? false,
  'every transition carries the parser version in force at that moment',
);
check(
  lifecycle?.transitions.some((t) => t.versions.resolverVersion !== null) ?? false,
  'and the resolver version',
);
check(lifecycle?.operator === OPERATOR, 'the operator is recorded', lifecycle?.operator ?? '');
check(lifecycle?.parserProfile !== null, 'as is the parser profile', lifecycle?.parserProfile ?? '');

console.log('\n=== 3. Closing a batch is a person saying they are finished ===');
const closed = await closeBatch({ batchId: day1.batchId!, actorId: OPERATOR });
check(closed.ok, 'a completed batch can be closed', closed.reason ?? '');
const afterClose = await getBatchLifecycle(day1.batchId!);
check(afterClose?.closedAt !== null, 'and the closure is recorded with a timestamp');
check(
  (afterClose?.transitions.length ?? 0) > (lifecycle?.transitions.length ?? 0),
  'as a transition, so the audit trail shows who finished with it',
);

console.log('\n=== 4. An out-of-order transition is refused ===');
// A batch that has completed must not be walked backwards: an audit trail that can be
// edited is not an audit trail.
const { transition } = await import('../src/intelligence/inmates/batchLifecycle.js');
const backwards = await transition(prisma, { batchId: day1.batchId!, to: 'parsing' });
check(!backwards.ok, 'a completed batch cannot go back to parsing', 'reason' in backwards ? backwards.reason : '');

const cancelCompleted = await cancelBatch({ batchId: day1.batchId!, actorId: OPERATOR, reason: 'testing' });
check(!cancelCompleted.ok, 'and a completed batch cannot be cancelled', cancelCompleted.reason ?? '');
const cancelNoReason = await cancelBatch({ batchId: day1.batchId!, actorId: OPERATOR, reason: '  ' });
check(!cancelNoReason.ok, 'a cancellation without a reason is refused', cancelNoReason.reason ?? '');

console.log('\n=== 5. Second roster, then the comparison ===');
writeFileSync('/tmp/sac2/ops-day2.csv', [
  'Booking Number,X-Ref,Last Name,First Name,Middle Name,DOB,Sex,Height,Weight,Booking Date,Arresting Agency,Type of Arrest,Housing Location,Charges,Bail,Outstanding Warrants,Projected Release Date,Next Court Date,Court',
  // Bail and housing changed, charge added.
  `2026-081101,XR-100001,NGUYEN,BINH,T,03/14/1988,M,5'11",180,08/09/2026,SACRAMENTO PD,Warrant,MAIN-5D-07,PC 459 - Burglary second degree; PC 496 - Receiving stolen property; PC 148 - Resisting arrest,75000,Y,08/22/2026,08/14/2026,Sacramento Superior Court`,
  // Released.
  `2026-081102,XR-100002,OBRIEN,KATHERINE,M,11/02/1991,F,5-04,135,08/09/2026,CHP,On-View,MAIN-4B-04,VC 23152(a) - DUI alcohol,25000,N,08/12/2026,08/13/2026,Sacramento Superior Court`,
  // New person.
  `2026-081310,XR-100030,OKAFOR,CHIDI,E,10/10/1991,M,5-10,178,08/10/2026,SACRAMENTO PD,Warrant,MAIN-2C-05,PC 211 - Robbery,200000,N,,08/30/2026,Sacramento Superior Court`,
  `2026-081311,XR-100031,SILVA,MARIA,J,11/11/1987,F,5-03,128,08/10/2026,ELK GROVE PD,Citation,MAIN-4A-09,PC 484 - Petty theft,5000,N,,08/31/2026,Sacramento Superior Court`,
  `2026-081312,XR-100032,BAKER,TREVOR,,12/12/1994,M,6-01,199,08/10/2026,SACRAMENTO SO,Remand,RCCC-3-12,HS 11351 - Possession for sale,120000,Y,,09/01/2026,Sacramento Superior Court`,
].join('\n') + '\n');

const day2 = await runIngestion({
  filePath: '/tmp/sac2/ops-day2.csv', facility: FACILITY, rosterDate: today,
  trigger: 'manual', dryRun: false, rosterKind: 'full_population', userId: OPERATOR,
});
check(day2.status === 'completed', 'the second roster imported', day2.failureReason ?? '');

const comparison = await compareBatches({
  baselineBatchId: day1.batchId!,
  currentBatchId: day2.batchId!,
  generatedById: OPERATOR,
  persist: true,
});
if (comparison.ok) {
  console.log(`  counts: ${JSON.stringify(comparison.counts)}`);
  console.log(comparison.detail.slice(0, 6).map((d) => `    ${d.kind}: ${d.name} ${d.from ?? '—'} → ${d.to ?? '—'}`).join('\n'));
  check(comparison.comparisonId !== null, 'the comparison is recorded, not just computed');
  check(comparison.counts.newInmates > 0, 'new inmates are counted', String(comparison.counts.newInmates));
  check(
    comparison.counts.housingMoves > 0 || comparison.counts.bailChanges > 0 || comparison.counts.chargeChanges > 0,
    'the housing, bail or charge change is counted',
    JSON.stringify({ housing: comparison.counts.housingMoves, bail: comparison.counts.bailChanges, charges: comparison.counts.chargeChanges }),
  );
  check(comparison.counts.departures > 0, 'people who left the roster are counted', String(comparison.counts.departures));
  check(comparison.detail.every((d) => d.name !== ''), 'every difference names a person');

  // Recorded means retrievable and identical, so the comparison does not drift when the
  // repository is later corrected.
  const again = await compareBatches({
    baselineBatchId: day1.batchId!, currentBatchId: day2.batchId!, persist: true,
  });
  check(
    again.ok && again.comparisonId === comparison.comparisonId,
    'asking again returns the recorded comparison rather than recomputing it',
  );
} else {
  check(false, 'the comparison ran', comparison.reason);
}

// Direction and facility are checked, because comparing the wrong pair reports everyone
// as new.
const backwardsCompare = await compareBatches({
  baselineBatchId: day2.batchId!, currentBatchId: day1.batchId!,
});
check(!backwardsCompare.ok, 'comparing in the wrong direction is refused', 'reason' in backwardsCompare ? backwardsCompare.reason : '');
const selfCompare = await compareBatches({ baselineBatchId: day1.batchId!, currentBatchId: day1.batchId! });
check(!selfCompare.ok, 'a batch cannot be compared with itself');

console.log('\n=== 6. Morning summary once work has been done ===');
const warm = await getMorningSummary();
console.log(`  posture=${warm.posture}`);
console.log(`  "${warm.headline}"`);
check(warm.lastSuccessfulImport !== null, 'the last successful import is reported');
check(warm.lastSuccessfulImport!.hoursAgo >= 0, 'with how long ago it was', `${warm.lastSuccessfulImport!.hoursAgo}h`);
check(warm.today.processed, "today is reported as processed");
check(warm.today.todaysRosterImported, "and today's roster specifically");
check(warm.intelligence.newInmates > 0, 'new inmates are counted', String(warm.intelligence.newInmates));
check(warm.posture !== 'action_required' || warm.intelligence.unresolvedReviewItems > 0,
  'the posture is no longer action-required unless something genuinely needs action',
  `${warm.posture}`);
check(warm.health.repository.observations > 0, 'the repository figures are reported');
check(Array.isArray(warm.parserWarnings), 'parser warnings are reported as a list');

console.log('\n=== 7. Report approval moves forward and only forward ===');
const { reportId } = await generateDailyReport({ date: today }, OPERATOR);
let reports = await listReports({ limit: 5 });
check(reports[0]?.approvalState === 'draft', 'a new report starts as draft', reports[0]?.approvalState);

// Approval cannot be skipped: a report that went straight from draft to printed would
// have left the building without anyone having approved it.
const skip = await setReportState({ reportId, to: 'printed', actorId: OPERATOR });
check(!skip.ok, 'a draft cannot be printed without being reviewed and approved', skip.reason ?? '');

const reviewed = await setReportState({ reportId, to: 'reviewed', actorId: OPERATOR });
check(reviewed.ok, 'draft → reviewed');
const approved = await setReportState({ reportId, to: 'approved', actorId: OPERATOR, note: 'Checked against the roster.' });
check(approved.ok, 'reviewed → approved');
const printed = await setReportState({ reportId, to: 'printed', actorId: OPERATOR });
check(printed.ok, 'approved → printed');
check(printed.printCount === 1, 'the print is counted', String(printed.printCount));
const printedAgain = await setReportState({ reportId, to: 'printed', actorId: OPERATOR });
check(printedAgain.ok && printedAgain.printCount === 2, 'printing again is allowed and counted', String(printedAgain.printCount));

const backToDraft = await setReportState({ reportId, to: 'draft', actorId: OPERATOR, note: 'wrong day' });
check(!backToDraft.ok, 'a printed report cannot be returned to draft — it has left the building', backToDraft.reason ?? '');

reports = await listReports({ limit: 5 });
const stored = reports.find((r) => r.reportId === reportId);
check(stored?.approvedById === OPERATOR, 'who approved it is stored', stored?.approvedById ?? '');
check(stored?.approvedAt !== null, 'and when');
check(stored?.printedAt !== null, 'as is when it was printed');
check(stored?.approvalNote === 'Checked against the roster.', 'and the approval note');

const archived = await setReportState({ reportId, to: 'archived', actorId: OPERATOR });
check(archived.ok, 'printed → archived');
const afterArchive = await setReportState({ reportId, to: 'reviewed', actorId: OPERATOR });
check(!afterArchive.ok, 'an archived report is a historical record and does not change again', afterArchive.reason ?? '');

// Returning a report to draft requires a reason, because sending one back is a judgement.
const { reportId: second } = await generateDailyReport({ date: today }, OPERATOR);
await setReportState({ reportId: second, to: 'reviewed', actorId: OPERATOR });
const noReason = await setReportState({ reportId: second, to: 'draft', actorId: OPERATOR });
check(!noReason.ok, 'returning a report to draft without a reason is refused', noReason.reason ?? '');

console.log('\n=== 8. Metrics and the trend ===');
const metrics = await getBatchMetrics({ limit: 10 });
console.log(metrics.batches.slice(0, 3).map((b) => `  ${b.filename}: parsed=${b.recordsParsed} obs=${b.observationsCreated} new=${b.newInmates} conf=${b.parserConfidence}% import=${b.importDurationMs}ms identity=${b.identityAnalysisMs}ms`).join('\n'));
check(metrics.batches.length >= 2, 'metrics are reported per batch', `${metrics.batches.length}`);
const m = metrics.batches[0];
for (const [label, value] of [
  ['files processed', m.filesProcessed], ['observations created', m.observationsCreated],
  ['identities matched', m.identitiesMatched], ['conflicts generated', m.conflictsGenerated],
  ['review items', m.reviewItems],
] as [string, number][]) {
  check(typeof value === 'number', `metrics include ${label}`, String(value));
}
check(m.parserConfidence !== null, 'metrics include parser confidence', String(m.parserConfidence));
check(m.importDurationMs !== null, 'metrics include import duration', String(m.importDurationMs));
check(
  m.identityAnalysisMs !== null,
  'and per-stage duration, so "identity analysis took four minutes" is answerable',
  `${m.identityAnalysisMs}ms`,
);

const trend = await getMetricTrend(30);
console.log(`  trend: ${trend.days.map((d) => `${d.date} imports=${d.imports} conf=${d.averageParserConfidence}%`).join(' | ')}`);
check(trend.days.length >= 1, 'the trend has at least one day');
check(
  trend.days.every((d) => d.averageParserConfidence === null || (d.averageParserConfidence >= 0 && d.averageParserConfidence <= 100)),
  'average parser confidence is a percentage',
);

console.log(`\n${'='.repeat(70)}\n${pass.length} passed, ${fail.length} failed`);
if (fail.length) console.log(`\nFAILED:\n${fail.map((f) => `  - ${f}`).join('\n')}`);

await prisma.$disconnect();
process.exit(fail.length === 0 ? 0 : 1);
