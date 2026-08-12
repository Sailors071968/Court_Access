import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { normalizeRecord } from '../src/intelligence/inmates/normalization.js';
import { parsePdfRoster } from '../src/intelligence/inmates/parsers/pdfParser.js';
import {
  extractJailScanRosterDate,
  isActiveInmateBasicRoster,
  parseActiveInmateBasicRoster,
} from '../src/intelligence/inmates/parsers/sacramentoJailScan.js';
import { SACRAMENTO_PDF } from '../src/intelligence/inmates/parsers/sacramento.js';

const FRAGMENT = existsSync('fixtures/sacramento/real/SACJAILSCAN08-10-2026.pdf')
  ? 'fixtures/sacramento/real/SACJAILSCAN08-10-2026.pdf'
  : join('..', 'fixtures/sacramento/real/SACJAILSCAN08-10-2026.pdf');

describe('Sacramento Active Inmate Basic Roster parser', () => {
  it('detects the roster marker', () => {
    assert.equal(isActiveInmateBasicRoster('Active Inmate Basic Roster 08/09/2026 06:20'), true);
    assert.equal(isActiveInmateBasicRoster('Booking Number|Name|DOB'), false);
  });

  it('reads the header roster date', () => {
    const text = "SACRAMENTO COUNTY SHERIFF'S OFFICE\nActive Inmate Basic Roster\n08/09/2026 06:20\n";
    assert.equal(extractJailScanRosterDate(text), '08/09/2026');
  });

  it('parses the truncated real SACJAILSCAN fragment via parsePdfRoster', async () => {
    const parsed = await parsePdfRoster(FRAGMENT, SACRAMENTO_PDF.columnMap, {
      rosterDate: '2026-08-09',
    });
    assert.ok(parsed.records.length >= 15, `expected >=15 rows, got ${parsed.records.length}`);
    assert.ok(parsed.issues.every((i) => i.severity !== 'error'), JSON.stringify(parsed.issues));

    const alfaro = parsed.records.find((r) => String(r.Name).startsWith('ALFARO'));
    assert.ok(alfaro, 'ALFARO missing');
    assert.equal(alfaro!.XREF, '4697360');
    assert.equal(alfaro!.DOB, '02/21/2002');
    assert.equal(alfaro!.Gender, 'M');
    assert.equal(alfaro!.Booked, '08/09/2026');

    const outcome = normalizeRecord(alfaro!, SACRAMENTO_PDF.columnMap);
    assert.ok(outcome.record, JSON.stringify(outcome.issues));
    assert.equal(outcome.record!.last, 'ALFARO');
    assert.equal(outcome.record!.externalPersonId, '4697360');
    assert.ok(outcome.record!.bookedAt);
  });

  it('uses fallback roster date when header date is absent', () => {
    const synthetic =
      'Active Inmate Basic Roster\nFacility: MAIN\n' +
      'Name XREF Housing Gender DOB\n' +
      'SMITH, JANE 1234567 MAIN 1 EAST 100 MEDIUM SECURITY F 01/02/1990\n';
    const result = parseActiveInmateBasicRoster(synthetic, '2026-08-10');
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0]!.Booked, '08/10/2026');
    assert.equal(result.records[0]!.Name, 'SMITH, JANE');
  });
});
