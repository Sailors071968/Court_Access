// ============================================================================
// Tests for the intelligence foundation.
//
// Weighted towards normalization and identity resolution, because those are the
// two places a mistake is silent: a bad match merges two people's arrest
// histories and a missed match makes one person look newly arrested every time.
// Both are pure functions of their input, so they can be pinned down here without
// a database.
// ============================================================================

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bookingContentHash, collapseWithinBatch } from '../src/intelligence/inmates/deduplication.js';
import {
  compareDob, editDistance, resolveIdentity, RESOLVER_VERSION,
} from '../src/intelligence/inmates/identityResolution.js';
import {
  displayNamePart, normalizeNamePart, normalizeRecord, normalizeSex, parseBoolean,
  parseCharges, parseHeightInches, parseWeightPounds,
  parseDate, parseMoneyCents, splitFullName,
} from '../src/intelligence/inmates/normalization.js';
import { deriveNameKeys } from '../src/intelligence/inmates/nameKeys.js';
import { splitCsvLine } from '../src/intelligence/inmates/parsers/csvParser.js';
import { getColumnMap, inspectHeaders } from '../src/intelligence/inmates/parsers/columnMaps.js';
import type {
  ColumnMap, InmateCandidate, NormalizedRecord, SourceDocument,
} from '../src/intelligence/inmates/types.js';

const DOC: SourceDocument = {
  batchId: 'b1', filename: 'roster.csv', sha256: 'abc', sourceType: 'csv',
};

const MAP = getColumnMap('generic') as ColumnMap;

function record(over: Partial<NormalizedRecord> = {}): NormalizedRecord {
  return {
    first: 'JOHN', last: 'SMITH', dateOfBirth: '1980-05-04',
    facility: 'generic', bookedAt: '2026-08-01T10:00:00.000Z',
    sex: 'M', charges: [], ...over,
  };
}

function candidate(over: Partial<InmateCandidate> = {}): InmateCandidate {
  return {
    inmateId: 'i1', canonicalFirst: 'JOHN', canonicalLast: 'SMITH',
    dateOfBirth: new Date('1980-05-04'), bookingCount: 1, ...over,
  };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

test('name normalization removes punctuation so the same person spelled two ways matches', () => {
  assert.equal(normalizeNamePart("O'Brien"), 'OBRIEN');
  assert.equal(normalizeNamePart('OBrien'), 'OBRIEN');
  assert.equal(normalizeNamePart('Smith-Jones'), 'SMITHJONES');
  assert.equal(normalizeNamePart('  mr.  john  '), 'JOHN');
});

test('a comma is authoritative regardless of the declared name order', () => {
  const a = splitFullName('SMITH, JOHN A', 'first_last');
  assert.deepEqual(a, { first: 'JOHN', middle: 'A', last: 'SMITH' });
  const b = splitFullName('SMITH, JOHN A', 'last_first');
  assert.deepEqual(b, { first: 'JOHN', middle: 'A', last: 'SMITH' });
});

test('generational suffixes are separated so they do not defeat a match', () => {
  assert.deepEqual(splitFullName('SMITH JR, JOHN', 'last_first'), { first: 'JOHN', last: 'SMITH', suffix: 'JR' });
});

test('multi-word surnames survive first_last order', () => {
  assert.deepEqual(splitFullName('MARIA DE LA CRUZ', 'first_last'), { first: 'MARIA', middle: 'DE LA', last: 'CRUZ' });
});

test('an ambiguous date is read under the declared format, not guessed', () => {
  assert.equal(parseDate('03/04/2020', ['mm/dd/yyyy']), '2020-03-04');
  assert.equal(parseDate('03/04/2020', ['dd/mm/yyyy']), '2020-04-03');
});

test('an impossible date is refused rather than rolled forward', () => {
  assert.equal(parseDate('02/31/2020', ['mm/dd/yyyy']), undefined);
  assert.equal(parseDate('13/01/2020', ['mm/dd/yyyy']), undefined);
  assert.equal(parseDate('01/01/1850', ['mm/dd/yyyy']), undefined);
});

test('a two-digit year resolves to the century that is not in the future', () => {
  assert.equal(parseDate('05/04/68', ['mm/dd/yyyy']), '1968-05-04');
  assert.equal(parseDate('05/04/05', ['mm/dd/yyyy']), '2005-05-04');
});

test('sex codes map to a closed vocabulary and anything else is unknown, not guessed', () => {
  assert.equal(normalizeSex('Male'), 'M');
  assert.equal(normalizeSex('f'), 'F');
  assert.equal(normalizeSex('banana'), 'unknown');
  assert.equal(normalizeSex(undefined), 'unknown');
});

test('money becomes integer cents so no total is ever a float', () => {
  assert.equal(parseMoneyCents('$25,000.00'), 2500000n);
  assert.equal(parseMoneyCents('50'), 5000n);
  assert.equal(parseMoneyCents('not a number'), undefined);
});

test('charges keep their raw text even when the statute parse fails', () => {
  const [charge] = parseCharges('PC 459 - BURGLARY (F)');
  assert.equal(charge.statuteCode, 'PEN');
  assert.equal(charge.statuteSection, '459');
  assert.equal(charge.severity, 'felony');
  assert.match(charge.rawText, /BURGLARY/);

  const [unparseable] = parseCharges('SOMETHING NOBODY CODED');
  assert.equal(unparseable.statuteCode, undefined);
  assert.equal(unparseable.rawText, 'SOMETHING NOBODY CODED');
});

test('a row without a surname or a booking date is rejected, not imported empty', () => {
  const noName = normalizeRecord({ 'Booking Date': '2026-08-01' }, MAP);
  assert.equal(noName.record, undefined);
  assert.equal(noName.issues[0].code, 'missing_name');

  const noDate = normalizeRecord({ Name: 'SMITH, JOHN' }, MAP);
  assert.equal(noDate.record, undefined);
  assert.equal(noDate.issues.some((i) => i.code === 'missing_booked_at'), true);
});

test('an unparseable date of birth is a warning, not a rejection', () => {
  const out = normalizeRecord({ Name: 'SMITH, JOHN', 'Booking Date': '2026-08-01', DOB: 'nonsense' }, MAP);
  assert.ok(out.record);
  assert.equal(out.record?.dateOfBirth, undefined);
  assert.equal(out.issues.some((i) => i.code === 'unparseable_dob'), true);
});

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

test('CSV quoting handles embedded commas and doubled quotes', () => {
  assert.deepEqual(splitCsvLine('a,"b,c",d'), ['a', 'b,c', 'd']);
  assert.deepEqual(splitCsvLine('a,"say ""hi""",c'), ['a', 'say "hi"', 'c']);
  assert.deepEqual(splitCsvLine('a,,c'), ['a', '', 'c']);
});

test('a header set missing what a booking needs fails the batch by name', () => {
  const inspection = inspectHeaders(['Name', 'Colour'], MAP);
  assert.deepEqual(inspection.missingRequired, ['bookedAt']);
  assert.deepEqual(inspection.unmapped, ['Colour']);
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

test('the booking hash ignores formatting so a re-export is not new arrests', () => {
  const a = bookingContentHash(record({ bookedAt: '2026-08-01T10:00:00.000Z' }));
  const b = bookingContentHash(record({ bookedAt: '2026-08-01T23:59:00.000Z' }));
  assert.equal(a, b, 'the same booking exported with a different time is one booking');
});

test('the facility booking number is authoritative when present', () => {
  const a = bookingContentHash(record({ externalBookingId: 'B-1', first: 'JOHN' }));
  const b = bookingContentHash(record({ externalBookingId: 'B-1', first: 'JON' }));
  assert.equal(a, b, 'a corrected spelling on the same booking number is the same booking');
});

test('rows repeated per charge collapse into one booking with all the charges', () => {
  const rows = [
    { lineNumber: 2, record: record({ externalBookingId: 'B-9', charges: parseCharges('PC 459 (F)') }) },
    { lineNumber: 3, record: record({ externalBookingId: 'B-9', charges: parseCharges('PC 496 (M)') }) },
  ];
  const collapsed = collapseWithinBatch(rows);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].record.charges.length, 2);
  assert.deepEqual(collapsed[0].mergedLines, [3]);
});

test('collapsing prefers whichever row carries more about the person', () => {
  const rows = [
    { lineNumber: 2, record: record({ externalBookingId: 'B-9', dateOfBirth: undefined, middle: undefined }) },
    { lineNumber: 3, record: record({ externalBookingId: 'B-9', dateOfBirth: '1980-05-04', middle: 'A' }) },
  ];
  const collapsed = collapseWithinBatch(rows);
  assert.equal(collapsed[0].record.dateOfBirth, '1980-05-04');
  assert.equal(collapsed[0].record.middle, 'A');
});

// ---------------------------------------------------------------------------
// Distance and date comparison
// ---------------------------------------------------------------------------

test('edit distance is bounded and stops early', () => {
  assert.equal(editDistance('JON', 'JOHN'), 1);
  assert.equal(editDistance('MICHAEL', 'MICHEAL'), 2);
  assert.ok(editDistance('JOHN', 'ELIZABETH', 4) > 4);
});

test('date of birth differences are classified as typo or genuinely different', () => {
  assert.equal(compareDob('1980-05-04', new Date('1980-05-04')), 'exact');
  assert.equal(compareDob('1980-04-05', new Date('1980-05-04')), 'typo', 'month and day swapped');
  assert.equal(compareDob('1989-05-04', new Date('1980-05-04')), 'typo', 'transposed year digits');
  assert.equal(compareDob('1975-11-22', new Date('1980-05-04')), 'different');
  assert.equal(compareDob(undefined, new Date('1980-05-04')), 'unknown');
});

// ---------------------------------------------------------------------------
// Identity resolution — the load-bearing behaviour
// ---------------------------------------------------------------------------

const NO_BOOKINGS = { existingBookingKeys: new Set<string>(), incomingBookingKey: 'k1', sourceDocument: DOC };

test('an exact identity match attaches the booking automatically', () => {
  const result = resolveIdentity({ record: record(), candidates: [candidate()], ...NO_BOOKINGS });
  assert.equal(result.outcome, 'matched');
  assert.equal(result.evidence.tier, 'exact_identity');
  assert.equal(result.evidence.humanReviewRequired, false);
  assert.ok(result.evidence.reasons.some((r) => r.code === 'dob_exact'));
  assert.equal(result.evidence.resolverVersion, RESOLVER_VERSION);
});

test('a spelling difference in the given name still matches when the date of birth is exact', () => {
  const result = resolveIdentity({
    record: record({ first: 'JON' }), candidates: [candidate({ canonicalFirst: 'JOHN' })], ...NO_BOOKINGS,
  });
  assert.equal(result.outcome, 'matched');
  assert.equal(result.evidence.tier, 'near_name');
  assert.equal(result.evidence.humanReviewRequired, false);
});

test('a near-miss date of birth is NEVER merged automatically', () => {
  const result = resolveIdentity({
    record: record({ dateOfBirth: '1980-04-05' }), candidates: [candidate()], ...NO_BOOKINGS,
  });
  assert.equal(result.evidence.tier, 'near_dob');
  assert.equal(result.outcome, 'needs_review');
  assert.equal(result.evidence.humanReviewRequired, true);
  assert.match(result.evidence.reviewRationale, /typing error and two different people/);
});

test('two strong candidates stop the decision rather than picking one', () => {
  const result = resolveIdentity({
    record: record(),
    candidates: [candidate({ inmateId: 'i1' }), candidate({ inmateId: 'i2' })],
    ...NO_BOOKINGS,
  });
  assert.equal(result.outcome, 'needs_review');
  assert.ok(result.evidence.conflicts.some((c) => c.code === 'multiple_strong_candidates'));
  assert.equal(result.evidence.rejectedCandidates.length, 1);
});

test('a different date of birth is a new person, and the rejected candidate is recorded', () => {
  const result = resolveIdentity({
    record: record({ dateOfBirth: '1975-11-22' }), candidates: [candidate()], ...NO_BOOKINGS,
  });
  assert.equal(result.outcome, 'new_inmate');
  assert.equal(result.evidence.tier, 'none');
  assert.equal(result.evidence.rejectedCandidates.length, 1);
  assert.equal(result.evidence.humanReviewRequired, false);
});

test('names matching with no date of birth anywhere goes to review, not a silent merge', () => {
  const result = resolveIdentity({
    record: record({ dateOfBirth: undefined }),
    candidates: [candidate({ dateOfBirth: null })],
    ...NO_BOOKINGS,
  });
  assert.equal(result.outcome, 'needs_review');
  assert.equal(result.evidence.tier, 'near_dob');
});

test('a booking already held is a duplicate and writes nothing', () => {
  const result = resolveIdentity({
    record: record(),
    candidates: [candidate()],
    existingBookingKeys: new Set(['k1']),
    incomingBookingKey: 'k1',
    sourceDocument: DOC,
  });
  assert.equal(result.outcome, 'duplicate');
  assert.equal(result.evidence.tier, 'exact_booking');
});

test('every decision carries the confidence model in full', () => {
  const result = resolveIdentity({ record: record(), candidates: [candidate()], ...NO_BOOKINGS });
  const e = result.evidence;
  assert.equal(typeof e.confidence, 'number');
  assert.ok(e.tier);
  assert.ok(Array.isArray(e.reasons) && e.reasons.length > 0);
  assert.ok(Array.isArray(e.conflicts));
  assert.deepEqual(e.sourceDocuments, [DOC]);
  assert.ok(Array.isArray(e.sourceRecordIds));
  assert.ok(Array.isArray(e.rejectedCandidates));
  assert.equal(typeof e.humanReviewRequired, 'boolean');
  assert.ok(e.reviewRationale.length > 0);
  assert.ok(e.decidedAt);
  assert.ok(e.resolverVersion);
});

test('a surname mismatch never matches, whatever else agrees', () => {
  const result = resolveIdentity({
    record: record({ last: 'JONES' }), candidates: [candidate({ canonicalLast: 'SMITH' })], ...NO_BOOKINGS,
  });
  assert.equal(result.outcome, 'new_inmate');
});

test('conflicting sex is recorded as evidence without blocking an otherwise exact match', () => {
  const result = resolveIdentity({
    record: record({ sex: 'F' }), candidates: [candidate({ sex: 'M' })], ...NO_BOOKINGS,
  });
  assert.equal(result.outcome, 'matched');
  assert.ok(result.evidence.conflicts.some((c) => c.code === 'sex_differs' && !c.blocking));
});

// ---------------------------------------------------------------------------
// Display names versus matching names
// ---------------------------------------------------------------------------

test('the matching form removes punctuation so two spellings are one surname', () => {
  // This is what makes O'BRIEN and OBRIEN the same person, and it must not change.
  assert.equal(normalizeNamePart("O'BRIEN"), 'OBRIEN');
  assert.equal(normalizeNamePart('GARCIA-LOPEZ'), 'GARCIALOPEZ');
});

test('the display form keeps punctuation, because a printed name must be right', () => {
  assert.equal(displayNamePart("o'brien"), "O'BRIEN");
  assert.equal(displayNamePart('garcia-lopez'), 'GARCIA-LOPEZ');
});

test('both forms still strip honorifics and stray commas', () => {
  assert.equal(displayNamePart('MR. GARCIA-LOPEZ,'), 'GARCIA-LOPEZ');
  assert.equal(normalizeNamePart('MR. GARCIA-LOPEZ,'), 'GARCIALOPEZ');
});

test('a display name is only recorded when it differs from the matching form', () => {
  // A name with no punctuation must not carry a redundant second copy of itself,
  // or every row in the repository grows three columns for nothing.
  const plain = normalizeRecord(
    {
      'Last Name': 'SMITH', 'First Name': 'JAMES', 'Booking Date': '2026-08-08',
      __lineNumber: '2',
    },
    SACRAMENTO_MAP,
  );
  assert.equal(plain.record?.displayLast, undefined);
  assert.equal(plain.record?.last, 'SMITH');

  const punctuated = normalizeRecord(
    {
      'Last Name': 'GARCIA-LOPEZ', 'First Name': 'MIGUEL', 'Booking Date': '2026-08-08',
      __lineNumber: '3',
    },
    SACRAMENTO_MAP,
  );
  assert.equal(punctuated.record?.last, 'GARCIALOPEZ', 'matching form is folded');
  assert.equal(punctuated.record?.displayLast, 'GARCIA-LOPEZ', 'display form is preserved');
});

test('the display name never becomes a matching key', () => {
  // The guarantee that adding display columns cannot change a merge decision: the
  // folded surname is what every blocking key derives from.
  const record = normalizeRecord(
    {
      'Last Name': "O'BRIEN", 'First Name': 'CATHERINE', 'Booking Date': '2026-08-08',
      __lineNumber: '4',
    },
    SACRAMENTO_MAP,
  );
  assert.equal(record.record?.last, 'OBRIEN');
  assert.equal(deriveNameKeys(record.record!.last).collapsed, deriveNameKeys('OBRIEN').collapsed);
});

/** The real Sacramento map, so these tests exercise the profile in production use. */
const SACRAMENTO_MAP = getColumnMap('sacramento')!;

// ---------------------------------------------------------------------------
// The real Sacramento columns
// ---------------------------------------------------------------------------

test('a height written four ways for the same person reads as the same inches', () => {
  // Rosters are not consistent about this even within one file.
  assert.equal(parseHeightInches(`5'11"`), 71);
  assert.equal(parseHeightInches('5-11'), 71);
  assert.equal(parseHeightInches('511'), 71);
  assert.equal(parseHeightInches('71'), 71);
});

test('an unparseable or implausible height is absent rather than guessed', () => {
  // A number carries an authority a blank does not: 511 inches is a worse answer
  // than "the roster did not say".
  assert.equal(parseHeightInches('511 cm'), undefined);
  assert.equal(parseHeightInches('999'), undefined);
  assert.equal(parseHeightInches('5-13'), undefined, 'thirteen inches is not a height');
  assert.equal(parseHeightInches(''), undefined);
});

test('weight tolerates a unit and refuses the implausible', () => {
  assert.equal(parseWeightPounds('180'), 180);
  assert.equal(parseWeightPounds('180 lbs'), 180);
  assert.equal(parseWeightPounds('1200'), undefined);
  assert.equal(parseWeightPounds('12'), undefined);
});

test('an unrecognised warrant value stays absent, because "none" is a claim', () => {
  assert.equal(parseBoolean('Y'), true);
  assert.equal(parseBoolean('NONE'), false);
  assert.equal(parseBoolean('UNKNOWN'), undefined);
  assert.equal(parseBoolean('PENDING'), undefined);
});

test('a bare double quote is a literal, so an inches mark does not eat the roster', () => {
  // RFC 4180 requires a quote inside a field to be quoted and doubled; county
  // exports write 5'11" as-is. Treating that as an opening quote swallowed every
  // following line until the file ended.
  const fields = splitCsvLine(`2026-081101,NGUYEN,5'11",180`);
  assert.deepEqual(fields, ['2026-081101', 'NGUYEN', `5'11"`, '180']);
});

test('a properly quoted field containing a comma still parses', () => {
  // The lenient rule must not break the case quoting exists for.
  const fields = splitCsvLine('2026-081101,"NGUYEN, BINH",180');
  assert.deepEqual(fields, ['2026-081101', 'NGUYEN, BINH', '180']);
});

test('a doubled quote inside a quoted field is one literal quote', () => {
  const fields = splitCsvLine('a,"he said ""stop""",c');
  assert.deepEqual(fields, ['a', 'he said "stop"', 'c']);
});

test('a projected release is not a release', () => {
  // The distinction the schema keeps: one is a forecast the jail revises, the other
  // is a fact. Merged, a forecast would put someone at liberty on paper.
  const record = normalizeRecord(
    {
      'Last Name': 'SMITH', 'First Name': 'JAMES', 'Booking Date': '08/09/2026',
      'Projected Release Date': '08/20/2026',
      __lineNumber: '2',
    },
    SACRAMENTO_MAP,
  ).record;

  assert.equal(record?.projectedReleaseAt?.slice(0, 10), '2026-08-20');
  assert.equal(record?.releasedAt, undefined, 'no actual release was stated');
});

test('the Sacramento profile maps the booking number and the X-Ref to different fields', () => {
  // One identifies a stay, the other a person. Conflating them is the worst single
  // mistake available in this map.
  const record = normalizeRecord(
    {
      'Booking Number': '2026-081101', 'X-Ref': 'XR-100001',
      'Last Name': 'NGUYEN', 'First Name': 'BINH', 'Booking Date': '08/09/2026',
      __lineNumber: '2',
    },
    SACRAMENTO_MAP,
  ).record;

  assert.equal(record?.externalBookingId, '2026-081101');
  assert.equal(record?.externalPersonId, 'XR-100001');
});
