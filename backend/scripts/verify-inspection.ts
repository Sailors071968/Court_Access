// Verifies Import Inspection Mode and the mapping editor — the loop that closes
// without a code deployment:
//
//   inspect an unknown export → read the suggestions → publish a profile version
//   → re-inspect → import
//
// The file used is the `renamed.csv` fixture: a Sacramento roster where every column
// has been renamed, which the existing profile refuses. That is the situation this
// whole phase exists for.

import { writeFileSync } from 'node:fs';

import prisma from '../src/lib/prisma.js';
import { runIngestion } from '../src/intelligence/inmates/ingestionEngine.js';
import { inspectFile } from '../src/intelligence/inmates/inspection/inspector.js';
import { inferColumnType } from '../src/intelligence/inmates/inspection/typeInference.js';
import { publishProfile, resolveProfile } from '../src/intelligence/platform/parserProfiles.js';
import { NORMALIZATION_VERSION } from '../src/intelligence/inmates/normalization.js';

const pass: string[] = [];
const fail: string[] = [];
const check = (ok: boolean, label: string, detail = '') => {
  (ok ? pass : fail).push(label);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

const FACILITY = 'sacramento';
const OPERATOR = 'inspection-verification';

console.log('=== 1. Type inference describes columns from their values ===');
const cases: [string, string[], string][] = [
  ['dates', ['08/09/2026', '08/10/2026', '12/31/2025'], 'date'],
  ['datetimes', ['08/09/2026 14:32', '08/10/2026 09:15', '08/11/2026 23:01'], 'datetime'],
  ['money', ['50000', '$25,000', '100000', 'NO BAIL'], 'money'],
  ['booleans', ['Y', 'N', 'Y', 'N'], 'boolean'],
  ['heights', [`5'11"`, '5-04', '6-02'], 'height'],
  ['identifiers', ['2026-081101', '2026-081102', '2026-081103'], 'identifier'],
  ['code list', ['M', 'F', 'M', 'M', 'F', 'M'], 'code_list'],
  ['weights', ['180', '135', '205', '220'], 'integer'],
  ['empty', ['', '', ''], 'empty'],
];
for (const [label, values, expected] of cases) {
  const inferred = inferColumnType(values);
  check(inferred.type === expected, `${label} infer as ${expected}`, `got ${inferred.type} at ${inferred.confidence}%`);
}

// A bail column carrying words is still bail, and the words are reported rather than
// treated as noise.
const bail = inferColumnType(['50000', '$25,000', 'NO BAIL', 'PC 1275']);
check(bail.type === 'money', 'a bail column with "NO BAIL" is still money');
check(bail.rationale.includes('NO BAIL'), 'and the words are named in the rationale rather than discarded');

// An inference on almost no data must not claim to be certain.
const thin = inferColumnType(['08/09/2026']);
check(thin.statistics.rowsPopulated === 1, 'a one-value column reports that it saw one value');
check(!thin.statistics.looksUnique, 'a single value is not reported as unique, which would be meaningless');

console.log('\n=== 2. Inspecting a file the profile cannot read ===');
const renamed = await inspectFile({
  filePath: '/tmp/sac2/renamed.csv',
  facility: FACILITY,
  originalName: 'sacramento-renamed-export.csv',
  persist: true,
  inspectedById: OPERATOR,
});

console.log(`  verdict=${renamed.compatibility.verdict} confidence=${renamed.compatibility.parserConfidence}%`);
console.log(`  headers: ${renamed.structure.headerRow.join(', ')}`);
console.log(`  recognized=${renamed.summary.recognized.length} unknown=${renamed.summary.unknown.length}`);

check(renamed.file.sha256.length === 64, 'the file is fingerprinted');
check(renamed.structure.rowsSampled === 5, 'rows were sampled', `${renamed.structure.rowsSampled}`);
check(renamed.summary.unknown.length > 0, 'the unrecognised columns are named', `${renamed.summary.unknown.length}`);
check(
  renamed.compatibility.verdict === 'would_be_refused',
  'the verdict is that an import would be refused, stated before anyone tries',
  renamed.compatibility.verdict,
);
check(
  renamed.compatibility.reasons.some((r) => r.toLowerCase().includes('booking date') || r.includes('bookedAt')),
  'and says which required column is missing',
);

// Nothing may have been written to the repository. That is the whole point.
const batchesAfterInspection = await prisma.inmateIngestionBatch.count();
const bookingsAfterInspection = await prisma.inmateBooking.count();
check(batchesAfterInspection === 0, 'inspection created no ingestion batch', `${batchesAfterInspection}`);
check(bookingsAfterInspection === 0, 'inspection created no booking', `${bookingsAfterInspection}`);
check(Boolean(renamed.inspectionId), 'the inspection itself was recorded', renamed.inspectionId ?? '');

console.log('\n=== 3. Suggestions identify the renamed columns ===');
for (const column of renamed.columns) {
  const best = column.suggestions[0];
  console.log(`  ${String(column.position).padStart(2)}. ${column.header.padEnd(16)} ${column.inference.type.padEnd(12)} ${
    column.mappedTo ? `→ ${column.mappedTo}` : best ? `? ${best.field} (${best.confidence}%)` : '—'}`);
}

const suggestionFor = (header: string) =>
  renamed.columns.find((c) => c.header === header)?.suggestions[0];

// These are the ones a person would most want identified, and each is identifiable
// from either the header or the values.
const mappingFor = (header: string) => renamed.columns.find((c) => c.header === header)?.mappedTo;
// These two the profile already recognises — 'surname' and 'birthdate' are aliases it
// carries — so a suggestion would be redundant and none is offered.
check(mappingFor('BirthDate') === 'dateOfBirth', 'BirthDate is already mapped to dateOfBirth by the profile');
check(suggestionFor('BirthDate') === undefined, 'and so carries no suggestion, because there is nothing to suggest');
check(suggestionFor('IntakeDateTime')?.field === 'bookedAt', 'IntakeDateTime → bookedAt', `${suggestionFor('IntakeDateTime')?.confidence}%`);
check(suggestionFor('BailAmt')?.field === 'bailAmount', 'BailAmt → bailAmount', `${suggestionFor('BailAmt')?.confidence}%`);
check(mappingFor('Surname') === 'last', 'Surname is already mapped to last by the profile');
check(suggestionFor('BkgNo')?.field === 'externalBookingId', 'BkgNo → externalBookingId', `${suggestionFor('BkgNo')?.confidence}%`);
check(
  renamed.summary.suggestedMappings.length >= 4,
  'enough columns are identified confidently to be worth offering as a profile update',
  `${renamed.summary.suggestedMappings.length}`,
);
check(Boolean(renamed.suggestedProfileUpdate), 'a suggested profile update was produced');
check(
  (renamed.suggestedProfileUpdate?.addedAliases.length ?? 0) >= 4,
  'the update adds aliases rather than replacing the mapping',
  `${renamed.suggestedProfileUpdate?.addedAliases.length ?? 0} added`,
);

// Every suggestion must carry a reason, or an operator is being asked to trust a number.
check(
  renamed.columns.flatMap((c) => c.suggestions).every((sg) => sg.reason.length > 10),
  'every suggestion explains itself',
);

console.log('\n=== 4. Publishing the suggestion, with no code change ===');
const before = await resolveProfile({ facility: FACILITY, sourceType: 'csv' });
const published = await publishProfile({
  facility: FACILITY,
  sourceType: 'csv',
  label: 'Sacramento CSV — from inspection',
  columnMap: renamed.suggestedProfileUpdate!.columnMap,
  normalizationVersion: NORMALIZATION_VERSION,
  expectedHeaders: renamed.structure.headerRow,
  normalizationRules: ['Unchanged from the previous version; only column aliases were added.'],
  validationRules: before.validationRules,
  effectiveFrom: new Date('2026-08-01'),
  changeNote: `Published from the inspection of ${renamed.file.filename}. The county renamed its columns.`,
  createdById: OPERATOR,
});
console.log(`  v${before.version} → v${published.version}`);
check(published.version === (before.version ?? 0) + 1, 'a new version was published, not an edit', `v${published.version}`);

const oldVersion = await prisma.inmateParserProfile.findFirst({
  where: { facility: FACILITY, sourceType: 'csv', version: before.version ?? 1 },
});
check(Boolean(oldVersion), 'the previous version still exists');
check(
  oldVersion?.effectiveTo !== null,
  'and its effective window was closed rather than the row being changed',
  oldVersion?.effectiveTo?.toISOString().slice(0, 10) ?? 'still open',
);

console.log('\n=== 5. Re-inspecting the same file with the new profile ===');
const reinspected = await inspectFile({
  filePath: '/tmp/sac2/renamed.csv',
  facility: FACILITY,
  originalName: 'sacramento-renamed-export.csv',
  persist: false,
});
console.log(`  verdict=${reinspected.compatibility.verdict} confidence=${reinspected.compatibility.parserConfidence}% (was ${renamed.compatibility.parserConfidence}%)`);
console.log(`  recognized=${reinspected.summary.recognized.length} unknown=${reinspected.summary.unknown.length}`);
check(
  reinspected.compatibility.parserConfidence > renamed.compatibility.parserConfidence,
  'the same file now reads better',
  `${renamed.compatibility.parserConfidence}% → ${reinspected.compatibility.parserConfidence}%`,
);
check(
  reinspected.compatibility.verdict !== 'would_be_refused',
  'and would no longer be refused',
  reinspected.compatibility.verdict,
);
check(
  reinspected.summary.missingRequired.length === 0,
  'the required column is now supplied',
);

console.log('\n=== 6. Importing the file the profile previously refused ===');
const imported = await runIngestion({
  filePath: '/tmp/sac2/renamed.csv', facility: FACILITY, rosterDate: '2026-08-10',
  trigger: 'manual', dryRun: false, rosterKind: 'full_population', userId: OPERATOR,
});
console.log(`  status=${imported.status} counts=${JSON.stringify(imported.counts)}`);
check(imported.status === 'completed', 'the import now succeeds', imported.failureReason ?? '');
check(imported.counts.total === 5, 'all five rows became bookings', String(imported.counts.total));

// The mapping must have actually taken effect, not merely stopped failing.
const booking = await prisma.inmateBooking.findFirst({
  where: { externalBookingId: '2026-081201' },
  select: { bailAmountCents: true, housingLocation: true, bookedAt: true, inmate: { select: { canonicalLast: true, dateOfBirth: true } } },
});
console.log(`  booking 2026-081201: ${JSON.stringify({ ...booking, bailAmountCents: String(booking?.bailAmountCents) })}`);
check(booking?.inmate.canonicalLast === 'TRAN', 'the renamed surname column was read', booking?.inmate.canonicalLast ?? '');
check(booking?.bailAmountCents === 5_000_000n, 'the renamed bail column was read', String(booking?.bailAmountCents));
check(booking?.inmate.dateOfBirth !== null, 'the renamed date of birth column was read');

console.log('\n=== 7. The validation report is stored with the batch ===');
const batch = await prisma.inmateIngestionBatch.findUnique({
  where: { batchId: imported.batchId! },
  select: { validationReport: true, parserConfidence: true, parserVersion: true },
});
const vr = batch?.validationReport as Record<string, unknown> | null;
console.log(`  parserConfidence=${batch?.parserConfidence} profileVersion=${batch?.parserVersion}`);
console.log(`  recognized=${(vr?.recognizedColumns as string[])?.length} unknown=${(vr?.unknownColumns as string[])?.length}`);

check(Boolean(vr), 'a validation report is stored with the batch');
for (const key of [
  'recognizedColumns', 'unknownColumns', 'duplicateColumns', 'emptyMappedColumns',
  'missingRequiredColumns', 'profileVersion', 'parserConfidence', 'warnings', 'errors',
]) {
  check(vr !== null && key in vr, `the report includes ${key}`);
}
check(batch?.parserConfidence !== null, 'parser confidence is on the batch so imports can be sorted by it', String(batch?.parserConfidence));
check(
  Array.isArray(vr?.warnings) && Array.isArray(vr?.errors),
  'warnings and errors are recorded even on an import that completed — nothing silently succeeds',
);

console.log('\n=== 8. A duplicate column is reported rather than silently halved ===');
writeFileSync('/tmp/sac2/dupe.csv', [
  'BkgNo,Surname,Given,BirthDate,IntakeDateTime,BailAmt,BailAmt,Pod',
  '2026-090001,MARTINEZ,LUIS,03/03/1990,08/11/2026,50000,75000,MAIN-1A',
  '2026-090002,CHEN,WEI,04/04/1988,08/11/2026,25000,30000,MAIN-1B',
  '2026-090003,DAVIS,ANGELA,05/05/1985,08/11/2026,10000,12000,MAIN-1C',
  '2026-090004,KELLY,SEAN,06/06/1979,08/11/2026,80000,90000,MAIN-1D',
  '2026-090005,ROSS,DIANA,07/07/1992,08/11/2026,15000,18000,MAIN-1E',
].join('\n') + '\n');

const dupe = await inspectFile({
  filePath: '/tmp/sac2/dupe.csv', facility: FACILITY, originalName: 'dupe.csv', persist: false,
});
console.log(`  duplicated: ${dupe.summary.duplicated.join(', ') || 'none'}`);
check(dupe.summary.duplicated.includes('BailAmt'), 'the repeated column is named');
check(
  dupe.compatibility.reasons.some((r) => r.includes('more than once')),
  'and the consequence is stated: only one of the pair would be read',
);

console.log('\n=== 9. A file that is not a roster at all ===');
writeFileSync('/tmp/sac2/notaroster.csv', [
  'invoice_number,customer,amount_due,due_date',
  'INV-001,ACME Bail Bonds,1200.00,09/01/2026',
  'INV-002,Sailors Bail Bonds,850.00,09/05/2026',
].join('\n') + '\n');

const wrong = await inspectFile({
  filePath: '/tmp/sac2/notaroster.csv', facility: FACILITY, originalName: 'invoices.csv', persist: false,
});
console.log(`  verdict=${wrong.compatibility.verdict} confidence=${wrong.compatibility.parserConfidence}%`);
check(wrong.compatibility.verdict === 'would_be_refused', 'a file that is not a roster is refused');
check(wrong.summary.recognized.length === 0, 'and none of its columns are claimed as recognised', `${wrong.summary.recognized.length}`);
check(
  wrong.suggestedProfileUpdate === null,
  'no profile update is suggested from a document that is not a roster',
);

console.log('\n=== 10. Inspection history ===');
const history = await prisma.inmateImportInspection.findMany({
  orderBy: { inspectedAt: 'desc' },
  select: { filename: true, verdict: true, parserConfidence: true, sha256: true },
});
console.log(history.map((h) => `  ${h.filename}: ${h.verdict} (${h.parserConfidence}%)`).join('\n'));
check(history.length >= 1, 'inspections are kept', `${history.length}`);
check(
  history.every((h) => h.sha256.length === 64),
  'each records the fingerprint of the file it described, so it can be matched to the import that followed',
);

console.log(`\n${'='.repeat(70)}\n${pass.length} passed, ${fail.length} failed`);
if (fail.length) console.log(`\nFAILED:\n${fail.map((f) => `  - ${f}`).join('\n')}`);

await prisma.$disconnect();
process.exit(fail.length === 0 ? 0 : 1);
