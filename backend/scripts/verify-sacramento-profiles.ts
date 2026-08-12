// Verifies the Sacramento profiles do what a profile is for: read the document they
// describe, and refuse one they do not.
//
// The refusal is the point. A parser that accepts a changed export and produces
// mostly-empty rows is worse than one that fails, because an empty roster is
// indistinguishable from a quiet day at the jail.

import prisma from '../src/lib/prisma.js';
import { runIngestion } from '../src/intelligence/inmates/ingestionEngine.js';
import { normalizeRecord, parseHeightInches, parseWeightPounds, parseBoolean } from '../src/intelligence/inmates/normalization.js';
import { SACRAMENTO_CSV, compareHeaders } from '../src/intelligence/inmates/parsers/sacramento.js';
import { resolveProfile } from '../src/intelligence/platform/parserProfiles.js';

const pass: string[] = [];
const fail: string[] = [];
const check = (ok: boolean, label: string, detail = '') => {
  (ok ? pass : fail).push(label);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

const FACILITY = 'sacramento';

console.log('=== 1. The profile carries what Phase 2 requires ===');
const profile = await resolveProfile({ facility: FACILITY, sourceType: 'csv', rosterDate: new Date('2026-08-09') });
console.log(`  v${profile.version}: ${profile.label}`);
check(profile.version !== null, 'a version');
check(!profile.fallback, 'resolved from a published profile, not the compiled-in map');
check((profile.expectedHeaders?.length ?? 0) >= 15, 'expected headers', `${profile.expectedHeaders?.length ?? 0}`);
check(Boolean(profile.columnMap), 'field mappings');
check(Boolean(profile.normalizationVersion), 'a normalization version', profile.normalizationVersion ?? '');
check(Boolean(profile.validationRules), 'validation rules');

const stored = await prisma.inmateParserProfile.findFirst({
  where: { facility: FACILITY, sourceType: 'csv', active: true },
  orderBy: { version: 'desc' },
});
check((stored?.normalizationRules.length ?? 0) >= 5, 'normalization rules recorded as prose', `${stored?.normalizationRules.length ?? 0} rules`);
check(stored?.effectiveFrom !== null, 'an effective date', stored?.effectiveFrom?.toISOString().slice(0, 10) ?? '');

const pdfProfile = await resolveProfile({ facility: FACILITY, sourceType: 'pdf_text', rosterDate: new Date('2026-08-09') });
check(!pdfProfile.fallback && pdfProfile.version !== null, 'a separate profile for the PDF roster', `v${pdfProfile.version}`);
// The two documents are different, so holding the PDF to the CSV's standard would
// fail real rosters.
const csvRules = profile.validationRules as { maximumRowFailurePercent: number };
const pdfRules = pdfProfile.validationRules as { maximumRowFailurePercent: number };
check(
  pdfRules.maximumRowFailurePercent > csvRules.maximumRowFailurePercent,
  'the PDF profile tolerates more row failure than the CSV, because reassembling a page loses fields',
  `pdf ${pdfRules.maximumRowFailurePercent}% vs csv ${csvRules.maximumRowFailurePercent}%`,
);

console.log('\n=== 2. Field normalization for the real Sacramento columns ===');
// Height arrives written several ways for the same person.
check(parseHeightInches(`5'11"`) === 71, "5'11\" reads as 71 inches");
check(parseHeightInches('5-11') === 71, '5-11 reads as 71 inches');
check(parseHeightInches('511') === 71, '511 (packed notation) reads as 71 inches');
check(parseHeightInches('71') === 71, 'a plain inch count reads as itself');
// A mis-parse would be worse than an absence: a number carries authority a blank does not.
check(parseHeightInches('511 cm') === undefined, 'an unparseable height is absent rather than guessed');
check(parseHeightInches('999') === undefined, 'an implausible height is refused');
check(parseWeightPounds('180 lbs') === 180, 'weight with a unit');
check(parseWeightPounds('1200') === undefined, 'an implausible weight is refused');
check(parseBoolean('Y') === true && parseBoolean('N') === false, 'yes/no warrants parse');
check(parseBoolean('UNKNOWN') === undefined, '"unknown" warrants stay absent, because "no warrants" and "not stated" are different claims');

console.log('\n=== 3. A good roster reads completely ===');
const facility = await prisma.inmateFacility.findUnique({ where: { code: FACILITY } });
check(Boolean(facility), 'the facility is registered');

const good = await runIngestion({
  filePath: '/tmp/sac2/good.csv', facility: FACILITY, rosterDate: '2026-08-09',
  trigger: 'cli', dryRun: false, rosterKind: 'full_population',
});
console.log(`  status=${good.status} counts=${JSON.stringify(good.counts)}`);
if (good.issues.length) console.log(`  issues: ${good.issues.map((i) => `${i.severity}:${i.code}`).join(', ')}`);
check(good.status === 'completed', 'the roster imported', good.failureReason ?? '');
check(good.counts.total === 5, 'all five rows became bookings', String(good.counts.total));

// The new fields must actually reach the repository, not just parse.
const booking = await prisma.inmateBooking.findFirst({
  where: { externalBookingId: '2026-081101' },
  select: {
    heightInches: true, weightPounds: true, arrestType: true, courtName: true,
    courtDate: true, projectedReleaseAt: true, outstandingWarrants: true, releasedAt: true,
  },
});
console.log(`  booking 2026-081101: ${JSON.stringify(booking)}`);
check(booking?.heightInches === 71, 'height persisted as inches');
check(booking?.weightPounds === 180, 'weight persisted');
check(booking?.arrestType === 'Warrant', 'arrest type persisted');
check(booking?.courtName === 'Sacramento Superior Court', 'court name persisted');
check(booking?.courtDate !== null, 'court date persisted');
check(booking?.outstandingWarrants === true, 'outstanding warrants persisted');
// The distinction that matters most: a forecast must not become a release.
check(booking?.projectedReleaseAt !== null, 'projected release persisted');
check(booking?.releasedAt === null, 'a projected release did NOT become a recorded release', 'releasedAt is null');

// "NO BAIL" is not zero bail.
const noBail = await prisma.inmateBooking.findFirst({
  where: { externalBookingId: '2026-081105' },
  select: { bailAmountCents: true },
});
check(noBail?.bailAmountCents === null, '"NO BAIL" recorded as absent, not as zero', String(noBail?.bailAmountCents));

console.log('\n=== 4. A renamed layout is refused, not half-imported ===');
const beforeRenamed = await prisma.inmateBooking.count();
const renamed = await runIngestion({
  filePath: '/tmp/sac2/renamed.csv', facility: FACILITY, rosterDate: '2026-08-10',
  trigger: 'cli', dryRun: false, rosterKind: 'full_population',
});
const afterRenamed = await prisma.inmateBooking.count();
console.log(`  status=${renamed.status} reason=${renamed.failureReason ?? 'none'}`);
console.log(`  issues: ${renamed.issues.map((i) => `${i.severity}:${i.code}`).join(', ') || 'none'}`);
check(renamed.status === 'failed', 'a document whose columns were all renamed fails the batch');
check(afterRenamed === beforeRenamed, 'nothing was written', `${beforeRenamed} → ${afterRenamed}`);
check(
  renamed.issues.some((i) => i.severity === 'error'),
  'the failure names what was wrong rather than reporting an empty roster',
);

console.log('\n=== 5. A truncated download is refused ===');
const truncated = await runIngestion({
  filePath: '/tmp/sac2/truncated.csv', facility: FACILITY, rosterDate: '2026-08-11',
  trigger: 'cli', dryRun: false, rosterKind: 'full_population',
});
console.log(`  status=${truncated.status} issues=${truncated.issues.map((i) => i.code).join(', ')}`);
check(truncated.status === 'failed', 'a two-row roster is refused as a truncated download');
check(
  truncated.issues.some((i) => i.code === 'roster_too_small'),
  'and says so specifically, rather than importing two rows as the day\'s population',
);

console.log('\n=== 6. Header drift is detectable before it becomes a failure ===');
const drift = compareHeaders(SACRAMENTO_CSV.expectedHeaders, [
  'Booking Number', 'X-Ref', 'Last Name', 'First Name', 'DOB', 'Sex',
  'Booking Date', 'Housing Location', 'Charges', 'Bail', 'New Column Nobody Expected',
]);
console.log(`  matched=${drift.matched} missing=${drift.missing.length} unexpected=${drift.unexpected.join(', ')}`);
check(drift.matched >= 10, 'a mostly-matching header row is recognised');
check(drift.unexpected.includes('New Column Nobody Expected'), 'a new column is reported');
check(drift.missing.length > 0, 'columns the profile expected but did not find are reported');

console.log(`\n${'='.repeat(70)}\n${pass.length} passed, ${fail.length} failed`);
if (fail.length) console.log(`\nFAILED:\n${fail.map((f) => `  - ${f}`).join('\n')}`);

await prisma.$disconnect();
process.exit(fail.length === 0 ? 0 : 1);
