import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  UNKNOWN,
  evidencePercent,
  evidenceValue,
  formatCertificationEvidence,
  isUnknown,
} from '../src/intelligence/inmates/unknown.ts';

describe('UNKNOWN — Zero Assumption evidence formatting', () => {
  it('never substitutes null/undefined with blanks or zero', () => {
    assert.equal(evidenceValue(null), UNKNOWN);
    assert.equal(evidenceValue(undefined), UNKNOWN);
    assert.equal(evidencePercent(null), UNKNOWN);
    assert.equal(isUnknown(UNKNOWN), true);
    assert.equal(isUnknown(0), false);
  });

  it('formats a certification evidence block without claiming complete', () => {
    const block = formatCertificationEvidence({
      engine: 'Comparison Engine',
      testDataset: 'Sacramento PDF',
      rosterDate: '2026-08-11',
      manualGroundTruthNew: 67,
      niisResultNew: 67,
      falsePositives: 0,
      falseNegatives: 0,
      precision: 1,
      recall: 1,
      status: 'CERTIFIED',
    });
    assert.match(block, /Manual Ground Truth:\s+67/);
    assert.match(block, /Status:\s+CERTIFIED/);
    assert.doesNotMatch(block, /Complete/i);
  });

  it('uses UNKNOWN when gold truth is absent', () => {
    const block = formatCertificationEvidence({
      engine: 'Replay Mode',
      testDataset: 'Sacramento PDF',
      rosterDate: '2026-08-11',
      manualGroundTruthNew: null,
      niisResultNew: 12,
      falsePositives: null,
      falseNegatives: null,
      precision: null,
      recall: null,
      status: 'UNKNOWN',
    });
    assert.match(block, /Manual Ground Truth:\s+UNKNOWN/);
    assert.match(block, /Precision:\s+UNKNOWN/);
    assert.match(block, /Status:\s+UNKNOWN/);
  });
});
