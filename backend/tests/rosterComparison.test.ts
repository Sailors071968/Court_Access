import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyRosterDisposition,
  isReportableNew,
  normalizeRosterName,
  rosterJoinKeys,
} from '../src/intelligence/inmates/rosterComparison.ts';

describe('Roster Comparison Engine — operational newness', () => {
  it('normalizes names for set-diff joins', () => {
    assert.equal(normalizeRosterName('Smith,  John.'), 'SMITH, JOHN');
  });

  it('prefers XREF then inmateId then name+DOB then name', () => {
    assert.deepEqual(
      rosterJoinKeys({
        xref: '123456',
        inmateId: 'i1',
        name: 'DOE, JANE',
        dob: '1990-01-01',
      }),
      ['xref:123456', 'inmate:i1', 'namedob:DOE, JANE|1990-01-01', 'name:DOE, JANE'],
    );
  });

  it('treats absent-yesterday with no history as new (reportable)', () => {
    const d = classifyRosterDisposition({
      onPrior: false,
      resolution: 'new_inmate',
      historicalBookingCount: 0,
    });
    assert.equal(d, 'new');
    assert.equal(isReportableNew(d), true);
  });

  it('treats absent-yesterday WITH history as returning but still reportable', () => {
    // This is the accuracy gap vs isFirstAppearance: manual gold includes them.
    const d = classifyRosterDisposition({
      onPrior: false,
      resolution: 'matched',
      historicalBookingCount: 3,
    });
    assert.equal(d, 'returning');
    assert.equal(isReportableNew(d), true);
  });

  it('treats present-both-days as existing (not on new-inmate report)', () => {
    const d = classifyRosterDisposition({
      onPrior: true,
      resolution: 'matched',
      historicalBookingCount: 5,
    });
    assert.equal(d, 'existing');
    assert.equal(isReportableNew(d), false);
  });

  it('routes review and failed ahead of presence', () => {
    assert.equal(
      classifyRosterDisposition({
        onPrior: false,
        resolution: 'needs_review',
        historicalBookingCount: 0,
      }),
      'review',
    );
    assert.equal(
      classifyRosterDisposition({
        onPrior: true,
        resolution: 'failed',
        historicalBookingCount: 0,
      }),
      'failed',
    );
  });
});
