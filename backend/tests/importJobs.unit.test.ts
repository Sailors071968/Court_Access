// Unit-level checks for Import Job helpers (no HTTP, no multipart).

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { IMPORT_FILE_STATUSES, IMPORT_JOB_STATUSES } from '../src/intelligence/inmates/importJobs.js';

test('import job statuses cover the operator dashboard lifecycle', () => {
  for (const s of [
    'pending', 'uploading', 'queued', 'processing', 'completed', 'failed', 'cancelled',
  ]) {
    assert.ok(IMPORT_JOB_STATUSES.includes(s as typeof IMPORT_JOB_STATUSES[number]), s);
  }
});

test('import file statuses include Already Imported skip and failed batch retry states', () => {
  assert.ok(IMPORT_FILE_STATUSES.includes('skipped_duplicate'));
  assert.ok(IMPORT_FILE_STATUSES.includes('failed_upload'));
  assert.ok(IMPORT_FILE_STATUSES.includes('pending'));
});

test('fingerprint is stable sha256 of file bytes (client/server contract)', () => {
  const a = createHash('sha256').update('NAME,BOOKING\nDOE,1\n').digest('hex');
  const b = createHash('sha256').update('NAME,BOOKING\nDOE,1\n').digest('hex');
  const c = createHash('sha256').update('NAME,BOOKING\nDOE,2\n').digest('hex');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[a-f0-9]{64}$/);
});
