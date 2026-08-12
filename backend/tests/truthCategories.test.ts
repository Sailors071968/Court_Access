import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  explainReportableWhy,
  truthOrUnknown,
  analyticalClaim,
  OPERATIONAL_NORTH_STAR,
  HUMAN_REVIEW_IS_SUCCESS,
} from '../src/intelligence/inmates/truthCategories.js';

describe('Engineering Law #0 — truth categories', () => {
  it('explains NEW in one bail-agent sentence', () => {
    const { why, truthCategory } = explainReportableWhy({ disposition: 'new' });
    assert.match(why, /today's roster/i);
    assert.match(why, /yesterday/i);
    assert.equal(truthCategory, 'verified_conclusion');
  });

  it('explains REVIEW as UNKNOWN when evidence is insufficient', () => {
    const { why, truthCategory } = explainReportableWhy({
      disposition: 'review',
      reviewReason: 'Manual review required because DOB differs while XREF matches.',
    });
    assert.match(why, /DOB differs/);
    assert.equal(truthCategory, 'unknown');
  });

  it('never invents values — UNKNOWN instead', () => {
    assert.equal(truthOrUnknown(null), 'UNKNOWN');
    assert.equal(truthOrUnknown(undefined), 'UNKNOWN');
    assert.equal(truthOrUnknown(''), 'UNKNOWN');
    assert.equal(truthOrUnknown('SMITH, JOHN'), 'SMITH, JOHN');
  });

  it('marks analytical intelligence as Not Fact', () => {
    const claim = analyticalClaim({
      statement: 'John Smith may be a repeat offender.',
      confidencePercent: 84,
      evidence: ['2 prior bookings'],
    });
    assert.equal(claim.truthCategory, 'analytical_intelligence');
    assert.equal(claim.status, 'Not Fact');
    assert.equal(claim.confidencePercent, 84);
  });

  it('states the operational north star', () => {
    assert.match(OPERATIONAL_NORTH_STAR, /tell the truth/i);
    assert.match(HUMAN_REVIEW_IS_SUCCESS, /success/i);
  });
});
