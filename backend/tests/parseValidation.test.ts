import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildCanonicalRoster } from '../src/intelligence/inmates/canonicalRoster.ts';
import { validateCanonicalRoster } from '../src/intelligence/inmates/parseValidation.ts';

describe('Parse validation (Primary Engineering Directive Step 3)', () => {
  it('accepts a clean alphabetical roster with unique XREFs', () => {
    const roster = buildCanonicalRoster({
      facility: 'sacramento',
      rosterDate: '2026-08-11',
      pageCount: 2,
      records: [
        { Name: 'ADAMS, ANN', XREF: '100001', DOB: '01/02/1990', Gender: 'F', Housing: 'MAIN A' },
        { Name: 'BAKER, BOB', XREF: '100002', DOB: '03/04/1985', Gender: 'M', Housing: 'MAIN B' },
      ],
    });
    const result = validateCanonicalRoster(roster);
    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.inmateCount, 2);
  });

  it('fails on duplicate XREF and malformed DOB', () => {
    const roster = buildCanonicalRoster({
      facility: 'sacramento',
      rosterDate: '2026-08-11',
      pageCount: 1,
      records: [
        { Name: 'ADAMS, ANN', XREF: '100001', DOB: '13/40/1990', Gender: 'F', Housing: 'MAIN A' },
        { Name: 'ADAMS, ALICE', XREF: '100001', DOB: '01/02/1991', Gender: 'F', Housing: 'MAIN A' },
      ],
    });
    const result = validateCanonicalRoster(roster);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'duplicate_xref'));
    assert.ok(result.errors.some((e) => e.code === 'malformed_dob'));
  });

  it('fails when pages were skipped', () => {
    const roster = buildCanonicalRoster({
      facility: 'sacramento',
      rosterDate: '2026-08-11',
      pageCount: 59,
      records: [
        { Name: 'ADAMS, ANN', XREF: '100001', DOB: '01/02/1990', Gender: 'F', Housing: 'MAIN A' },
      ],
    });
    const result = validateCanonicalRoster(roster, { emptyPages: [12, 13] });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'skipped_pages'));
  });

  it('fails when zero inmates extracted', () => {
    const roster = buildCanonicalRoster({
      facility: 'sacramento',
      rosterDate: '2026-08-11',
      pageCount: 1,
      records: [],
    });
    const result = validateCanonicalRoster(roster);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'no_inmates_extracted'));
  });
});
