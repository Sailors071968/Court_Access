// ============================================================================
// Tests for change detection and cross-source reconciliation.
//
// Two behaviours carry most of the weight and are tested hardest:
//
//   A change is only reported when both sides are known. A source that omits a
//   field has not said the value is empty, and reporting that as a movement
//   would fill an operator's report with transfers that never happened.
//
//   A disagreement between two authoritative sources resolves to UNKNOWN unless
//   a rule genuinely applies. Preferring one silently would produce a repository
//   that looks consistent and is wrong.
// ============================================================================

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  chargeSetHash, classifyPresence, detectAttributeChanges, detectDepartures,
  type ObservationAttributes,
} from '../src/intelligence/inmates/changeDetection.js';
import {
  bestKnownValue, reconcileObservations, type ObservationForComparison,
} from '../src/intelligence/inmates/sourceReconciliation.js';
import { parseCharges } from '../src/intelligence/inmates/normalization.js';

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

test('a person with no prior bookings is new', () => {
  const c = classifyPresence({ priorBookingCount: 0, priorBookingClosed: false });
  assert.equal(c.changeType, 'new_inmate');
  assert.equal(c.material, true);
});

test('a person whose last booking ended and is booked again is returning', () => {
  const c = classifyPresence({ priorBookingCount: 2, priorBookingClosed: true });
  assert.equal(c.changeType, 'returning_inmate');
  assert.equal(c.material, true);
});

test('a person still in custody is known, and not material', () => {
  const c = classifyPresence({ priorBookingCount: 2, priorBookingClosed: false });
  assert.equal(c.changeType, 'known_inmate');
  assert.equal(c.material, false, 'someone in custody since yesterday is not an event');
});

// ---------------------------------------------------------------------------
// Attribute changes
// ---------------------------------------------------------------------------

const base: ObservationAttributes = {
  housingLocation: 'A-POD-12',
  bailAmountCents: 2500000n,
  releasedAt: null,
  courtDate: new Date('2026-09-01'),
  custodyStatus: 'in_custody',
  chargeSetHash: 'hash-a',
  chargeCount: 2,
};

test('no previous observation means nothing to compare', () => {
  assert.deepEqual(detectAttributeChanges(null, base), []);
});

test('identical observations produce no changes', () => {
  assert.deepEqual(detectAttributeChanges(base, { ...base }), []);
});

test('a housing move is reported with both values', () => {
  const changes = detectAttributeChanges(base, { ...base, housingLocation: 'B-POD-04' });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].changeType, 'housing_change');
  assert.equal(changes[0].previousValue, 'A-POD-12');
  assert.equal(changes[0].newValue, 'B-POD-04');
});

test('a field the new source does not mention is NOT a change', () => {
  const changes = detectAttributeChanges(base, { ...base, housingLocation: undefined });
  assert.deepEqual(changes, [], 'a gap in the source is not a transfer');
});

test('a field the previous source did not mention is NOT a change', () => {
  const changes = detectAttributeChanges({ ...base, bailAmountCents: undefined }, base);
  assert.equal(changes.filter((c) => c.changeType === 'bail_change').length, 0);
});

test('bail is compared as money, not as raw cents', () => {
  const changes = detectAttributeChanges(base, { ...base, bailAmountCents: 5000000n });
  assert.equal(changes[0].changeType, 'bail_change');
  assert.equal(changes[0].previousValue, '25000.00');
  assert.equal(changes[0].newValue, '50000.00');
});

test('a release is its own event, not a date moving', () => {
  const changes = detectAttributeChanges(base, { ...base, releasedAt: new Date('2026-08-05') });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].changeType, 'released');
  assert.equal(changes[0].newValue, '2026-08-05');
});

test('a court date change is reported by day', () => {
  const changes = detectAttributeChanges(base, { ...base, courtDate: new Date('2026-09-15') });
  assert.equal(changes[0].changeType, 'court_date_change');
  assert.equal(changes[0].previousValue, '2026-09-01');
  assert.equal(changes[0].newValue, '2026-09-15');
});

test('a different charge set is reported with a direction', () => {
  const added = detectAttributeChanges(base, { ...base, chargeSetHash: 'hash-b', chargeCount: 3 });
  assert.equal(added[0].changeType, 'charge_added');
  const removed = detectAttributeChanges(base, { ...base, chargeSetHash: 'hash-b', chargeCount: 1 });
  assert.equal(removed[0].changeType, 'charge_removed');
});

test('the charge set hash is order-independent so a reordered export is not a change', () => {
  const a = chargeSetHash(parseCharges('PC 459 (F);PC 496 (M)'));
  const b = chargeSetHash(parseCharges('PC 496 (M);PC 459 (F)'));
  assert.equal(a, b);
});

test('several changes at once are all reported', () => {
  const changes = detectAttributeChanges(base, {
    ...base, housingLocation: 'C-1', bailAmountCents: 100n, courtDate: new Date('2026-10-01'),
  });
  assert.equal(changes.length, 3);
});

// ---------------------------------------------------------------------------
// Departures
// ---------------------------------------------------------------------------

test('a booking missing from a full roster has departed', () => {
  const gone = detectDepartures({
    previouslyPresentBookingIds: ['b1', 'b2', 'b3'],
    observedBookingIds: new Set(['b1', 'b3']),
    rosterIsFullPopulation: true,
  });
  assert.deepEqual(gone, ['b2']);
});

test('an incremental roster can NEVER support a departure inference', () => {
  const gone = detectDepartures({
    previouslyPresentBookingIds: ['b1', 'b2'],
    observedBookingIds: new Set(['b1']),
    rosterIsFullPopulation: false,
  });
  assert.deepEqual(gone, [], 'absence from a partial list says nothing');
});

// ---------------------------------------------------------------------------
// Cross-source reconciliation
// ---------------------------------------------------------------------------

function obs(over: Partial<ObservationForComparison>): ObservationForComparison {
  return {
    observationId: 'o1', bookingId: 'bk1', sourceType: 'csv',
    rosterDate: new Date('2026-08-03'),
    housingLocation: 'A-1', bailAmountCents: 1000n,
    releasedAt: null, courtDate: null, custodyStatus: 'in_custody',
    chargeSetHash: 'h1', chargeCount: 1, ...over,
  };
}

test('two sources agreeing produce no conflict', () => {
  const conflicts = reconcileObservations([
    obs({ observationId: 'a', sourceType: 'csv' }),
    obs({ observationId: 'b', sourceType: 'pdf_text' }),
  ]);
  assert.deepEqual(conflicts, []);
});

test('two authoritative sources disagreeing resolve to UNKNOWN', () => {
  const conflicts = reconcileObservations([
    obs({ observationId: 'a', sourceType: 'csv', housingLocation: 'A-1' }),
    obs({ observationId: 'b', sourceType: 'pdf_text', housingLocation: 'B-2' }),
  ]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].field, 'housing');
  assert.equal(conflicts[0].resolution, 'unknown');
  assert.match(conflicts[0].resolutionNote, /no basis for preferring either/);
});

test('a CSV is preferred over OCR, and the conflict is still recorded', () => {
  const conflicts = reconcileObservations([
    obs({ observationId: 'a', sourceType: 'pdf_ocr', housingLocation: 'A-l' }),
    obs({ observationId: 'b', sourceType: 'csv', housingLocation: 'A-1' }),
  ]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].resolution, 'source_b');
  assert.match(conflicts[0].resolutionNote, /OCR/);
});

test('the same source twice is a change over time, not a conflict', () => {
  const conflicts = reconcileObservations([
    obs({ observationId: 'a', sourceType: 'csv', housingLocation: 'A-1' }),
    obs({ observationId: 'b', sourceType: 'csv', housingLocation: 'B-2' }),
  ]);
  assert.deepEqual(conflicts, []);
});

test('observations from different roster dates are not compared', () => {
  const conflicts = reconcileObservations([
    obs({ observationId: 'a', sourceType: 'csv', rosterDate: new Date('2026-08-03'), housingLocation: 'A-1' }),
    obs({ observationId: 'b', sourceType: 'pdf_text', rosterDate: new Date('2026-08-04'), housingLocation: 'B-2' }),
  ]);
  assert.deepEqual(conflicts, [], "yesterday's housing is not a conflict with today's");
});

test('a field one source omits is not a conflict', () => {
  const conflicts = reconcileObservations([
    obs({ observationId: 'a', sourceType: 'csv', housingLocation: 'A-1' }),
    obs({ observationId: 'b', sourceType: 'pdf_text', housingLocation: undefined }),
  ]);
  assert.equal(conflicts.filter((c) => c.field === 'housing').length, 0);
});

test('differing charge sets are a conflict reported by count', () => {
  const conflicts = reconcileObservations([
    obs({ observationId: 'a', sourceType: 'csv', chargeSetHash: 'h1', chargeCount: 2 }),
    obs({ observationId: 'b', sourceType: 'pdf_text', chargeSetHash: 'h2', chargeCount: 3 }),
  ]);
  const charges = conflicts.find((c) => c.field === 'charges');
  assert.ok(charges);
  assert.equal(charges?.valueA, '2 charge(s)');
  assert.equal(charges?.valueB, '3 charge(s)');
  assert.equal(charges?.resolution, 'unknown');
});

// ---------------------------------------------------------------------------
// UNKNOWN rather than an unsupported conclusion
// ---------------------------------------------------------------------------

test('agreeing sources give a certain value', () => {
  const r = bestKnownValue([{ value: 'A-1', sourceType: 'csv' }, { value: 'A-1', sourceType: 'pdf_text' }]);
  assert.equal(r.value, 'A-1');
  assert.equal(r.certain, true);
});

test('disagreeing authoritative sources give UNKNOWN, not a guess', () => {
  const r = bestKnownValue([{ value: 'A-1', sourceType: 'csv' }, { value: 'B-2', sourceType: 'pdf_text' }]);
  assert.equal(r.value, null);
  assert.equal(r.certain, false);
  assert.match(r.note, /Left UNKNOWN/);
});

test('when only OCR disagrees, the non-OCR consensus is used', () => {
  const r = bestKnownValue([
    { value: 'A-1', sourceType: 'csv' },
    { value: 'A-1', sourceType: 'pdf_text' },
    { value: 'A-l', sourceType: 'pdf_ocr' },
  ]);
  assert.equal(r.value, 'A-1');
  assert.equal(r.certain, true);
  assert.match(r.note, /every non-OCR source agrees/);
});

test('no source supplying the field is UNKNOWN, not empty', () => {
  const r = bestKnownValue<string>([{ value: null, sourceType: 'csv' }, { value: undefined, sourceType: 'pdf_text' }]);
  assert.equal(r.value, null);
  assert.equal(r.certain, false);
});
