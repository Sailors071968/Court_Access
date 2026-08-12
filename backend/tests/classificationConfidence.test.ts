import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeAutomaticClassificationRate,
  uncertaintyScore,
  buildManualCompareAssistant,
  featureWorkGate,
} from '../src/intelligence/inmates/classificationConfidence.js';
import type { DifferenceRow } from '../src/intelligence/inmates/dailyDifferenceViewer.js';

function row(partial: Partial<DifferenceRow> & { classification: DifferenceRow['classification']; name: string }): DifferenceRow {
  return {
    key: partial.key ?? partial.name,
    name: partial.name,
    color: 'green',
    classification: partial.classification,
    onPrior: partial.onPrior ?? false,
    onCurrent: partial.onCurrent ?? true,
    inmateId: null,
    bookingId: null,
    prior: partial.prior ?? null,
    current: partial.current ?? {
      recordId: 'r1',
      lineNumber: 1,
      name: partial.name,
      bookingNumber: null,
      housing: null,
      bail: null,
      charges: null,
      bookedAt: null,
      resolution: 'matched',
      confidence: partial.current?.confidence ?? 95,
      matchTier: 'strong',
      sourcePage: 1,
      inmateId: null,
      bookingId: null,
    },
    why: partial.why ?? { summary: 'test', rules: [], presence: null, identity: null, attributeChanges: [] },
    evidence: partial.evidence ?? [],
  };
}

describe('Automatic Classification Rate', () => {
  it('computes rate from total, review, and corrected', () => {
    const r = computeAutomaticClassificationRate({
      totalRoster: 1493,
      humanReview: 6,
      corrected: 1,
    });
    assert.equal(r.automaticallyCertified, 1486);
    assert.equal(r.ratePercent, 99.5);
    assert.match(r.summary, /99\.5%/);
  });

  it('returns UNKNOWN when roster total missing', () => {
    const r = computeAutomaticClassificationRate({ totalRoster: null, humanReview: 0, corrected: 0 });
    assert.equal(r.ratePercent, null);
  });
});

describe('Manual Compare Assistant — uncertainty ranking', () => {
  it('ranks review above clear new', () => {
    const review = row({
      name: 'UNCERTAIN, PERSON',
      classification: 'review',
      current: {
        recordId: 'r', lineNumber: 1, name: 'UNCERTAIN, PERSON', bookingNumber: null,
        housing: null, bail: null, charges: null, bookedAt: null, resolution: 'review',
        confidence: 55, matchTier: 'weak', sourcePage: 1, inmateId: null, bookingId: null,
      },
    });
    const clearNew = row({ name: 'CLEAR, NEW', classification: 'new' });
    assert.ok(uncertaintyScore(review) > uncertaintyScore(clearNew));

    const assistant = buildManualCompareAssistant([clearNew, review], 4);
    assert.equal(assistant.leastConfident[0]!.name, 'UNCERTAIN, PERSON');
    assert.match(assistant.message, /least confident/i);
  });
});

describe('Feature work gate', () => {
  it('locks features before 30 consecutive days', () => {
    const g = featureWorkGate(12, 30);
    assert.equal(g.allowed, false);
    assert.match(g.message, /30/);
  });

  it('allows after required streak', () => {
    assert.equal(featureWorkGate(30, 30).allowed, true);
  });
});
