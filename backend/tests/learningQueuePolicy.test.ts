import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderEngineeringCertificationMarkdown } from '../src/intelligence/inmates/engineeringCertification.js';

describe('Engineering Certification Report rendering', () => {
  it('includes business metrics and PASS status', () => {
    const md = renderEngineeringCertificationMarkdown({
      facility: 'sacramento',
      priorDate: '2026-08-10',
      currentDate: '2026-08-11',
      priorInmateCount: 1400,
      currentInmateCount: 1487,
      newInmates: 67,
      existingInmates: 1400,
      returningInmates: 10,
      reviewRequired: 10,
      reconcileOk: true,
      precision: 1,
      recall: 1,
      potentialClientsFound: 67,
      potentialClientsMissed: 0,
      processingTimeMs: 12345,
      status: 'pass',
      misses: [],
      extras: [],
    });
    assert.match(md, /Potential New Clients Found/);
    assert.match(md, /Potential New Clients Missed/);
    assert.match(md, /\*\*Status:\*\* PASS/);
    assert.match(md, /1487/);
  });
});
