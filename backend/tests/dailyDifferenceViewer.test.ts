import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyDifferenceColor,
  normalizePersonName,
  nameFromPayloads,
} from '../src/intelligence/inmates/dailyDifferenceViewer.ts';

describe('Daily Difference Viewer classification', () => {
  it('normalizes person names for roster join', () => {
    assert.equal(normalizePersonName('Smith,  John.'), 'SMITH, JOHN');
    assert.equal(
      nameFromPayloads({ last: 'Doe', first: 'Jane' }, null),
      'DOE, JANE',
    );
  });

  it('colors new / returning / changed / unchanged / review / departed', () => {
    assert.deepEqual(
      classifyDifferenceColor({
        onPrior: false, onCurrent: true, presence: 'new', hasAttributeChanges: false,
      }),
      { color: 'green', classification: 'new' },
    );
    assert.deepEqual(
      classifyDifferenceColor({
        onPrior: true, onCurrent: true, presence: 'returning', hasAttributeChanges: true,
      }),
      { color: 'blue', classification: 'returning' },
    );
    assert.deepEqual(
      classifyDifferenceColor({
        onPrior: true, onCurrent: true, presence: 'existing', hasAttributeChanges: true,
      }),
      { color: 'yellow', classification: 'changed' },
    );
    assert.deepEqual(
      classifyDifferenceColor({
        onPrior: true, onCurrent: true, presence: 'existing', hasAttributeChanges: false,
      }),
      { color: 'gray', classification: 'unchanged' },
    );
    assert.deepEqual(
      classifyDifferenceColor({
        onPrior: true, onCurrent: true, presence: 'review', hasAttributeChanges: false,
      }),
      { color: 'red', classification: 'review' },
    );
    assert.deepEqual(
      classifyDifferenceColor({
        onPrior: true, onCurrent: false, presence: null, hasAttributeChanges: false,
      }),
      { color: 'gray', classification: 'departed' },
    );
  });

  it('treats unclassified as red defect', () => {
    assert.deepEqual(
      classifyDifferenceColor({
        onPrior: false, onCurrent: true, presence: 'unclassified', hasAttributeChanges: false,
      }),
      { color: 'red', classification: 'unclassified' },
    );
  });
});
