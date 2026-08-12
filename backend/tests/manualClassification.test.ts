import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseManualClassification,
  diffAgainstManual,
  summaryCounts,
} from '../src/intelligence/inmates/manualClassification.js';
import {
  inferDefectCategory,
  normalizeDefectCategory,
  defectQualityAxis,
  tallyDefects,
} from '../src/intelligence/inmates/defectCategories.js';

describe('manualClassification', () => {
  it('parses full NEW/EXISTING/RETURNING/REVIEW classification', () => {
    const text = `
Roster Date: 2026-08-11
Compared Against: 2026-08-10
Investigator: Admin
Verified At: 2026-08-11T12:00:00Z

## Manual Classification

### NEW:
1. SMITH, JOHN A | 1990-01-01
2. DOE, JANE

### EXISTING:
1. EXISTING, PERSON

### RETURNING:
1. RETURN, BOB

### REVIEW:
1. REVIEW, CASE
`;
    const c = parseManualClassification(text);
    assert.equal(c.rosterDate, '2026-08-11');
    assert.equal(c.priorDate, '2026-08-10');
    assert.equal(c.partial, false);
    assert.equal(c.new.length, 2);
    assert.equal(c.existing.length, 1);
    assert.equal(c.returning.length, 1);
    assert.equal(c.review.length, 1);
    assert.equal(c.new[0]!.name, 'SMITH, JOHN A');
    const counts = summaryCounts(c);
    assert.equal(counts.newCount, 2);
  });

  it('treats legacy NEW-only lists as partial (not a permanent target count)', () => {
    const text = `# Count = 67 for one historical day only
ALDANA, CARLOS JAMES
ANDERSON, JAMES EARL
`;
    const c = parseManualClassification(text, { defaultRosterDate: '2026-08-10' });
    assert.equal(c.partial, true);
    assert.equal(c.new.length, 2);
    assert.equal(c.existing.length, 0);
  });

  it('diffs NIIS reportable names against investigator NEW', () => {
    const manual = parseManualClassification(`
Roster Date: 2026-08-10
### NEW:
SMITH, JOHN
DOE, JANE
### EXISTING:
KEEP, ME
### RETURNING:
### REVIEW:
`);
    const diff = diffAgainstManual({
      manual,
      niisByName: new Map([
        ['SMITH, JOHN', 'new'],
        ['EXTRA, PERSON', 'new'],
        ['KEEP, ME', 'existing'],
      ]),
      niisReportableNames: ['SMITH, JOHN', 'EXTRA, PERSON'],
    });
    assert.deepEqual(diff.missedNew, ['DOE, JANE']);
    assert.deepEqual(diff.falseNew, ['EXTRA, PERSON']);
    assert.equal(diff.newPerfect, false);
  });
});

describe('defectCategories', () => {
  it('normalizes legacy root causes to directive categories', () => {
    assert.equal(normalizeDefectCategory('parser'), 'parser_defect');
    assert.equal(normalizeDefectCategory('identity'), 'identity_defect');
    assert.equal(normalizeDefectCategory('classification'), 'comparison_defect');
    assert.equal(normalizeDefectCategory('manual_review'), 'manual_review');
  });

  it('infers algorithm vs data quality axis', () => {
    assert.equal(defectQualityAxis('parser_defect'), 'algorithm');
    assert.equal(defectQualityAxis('source_defect'), 'data');
    assert.equal(defectQualityAxis('manual_review'), 'process');
    assert.equal(
      inferDefectCategory({ stage: 'Report generation', errorType: 'false_new' }),
      'comparison_defect',
    );
    assert.equal(
      inferDefectCategory({ evidence: 'page failed to parse' }),
      'parser_defect',
    );
  });

  it('tallies defects for improvement evidence', () => {
    const tallies = tallyDefects([
      { rootCause: 'parser' },
      { rootCause: 'parser_defect' },
      { category: 'source_defect' },
    ]);
    const parser = tallies.find((t) => t.category === 'parser_defect');
    assert.equal(parser?.count, 2);
  });
});
