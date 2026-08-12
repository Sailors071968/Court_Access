import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getNewInmates } from '../src/intelligence/inmates/repository.js';
import { getDailyCasePipelineState } from '../src/intelligence/inmates/dailyCasePipeline.js';

describe('Daily Case pipeline coherence', () => {
  it('refuses unscoped new-inmate queries (no seed/demo dump)', async () => {
    const bare = await getNewInmates({ limit: 50, offset: 0 });
    assert.equal(bare.source, 'unavailable');
    assert.equal(bare.total, 0);
    assert.equal(bare.results.length, 0);
    assert.match(bare.unavailableReason ?? '', /Facility and ops date/i);

    // Even if the DB has isFirstAppearance seed rows (NGUYEN @ 100%), they must not appear.
    const names = bare.results.map((r) => r.name.toUpperCase());
    assert.ok(!names.some((n) => n.includes('NGUYEN')));
  });

  it('returns unavailable — not fabricated rows — when comparison is incomplete', async () => {
    const result = await getNewInmates({
      facility: 'sacramento',
      from: '2099-01-01',
      limit: 50,
      offset: 0,
    });
    assert.equal(result.source, 'unavailable');
    assert.equal(result.total, 0);
    assert.ok(
      result.pipelineMessage === 'No certified results available'
      || result.pipelineMessage === 'Processing…'
      || result.pipelineMessage === 'Awaiting comparison…',
    );
  });

  it('exposes Daily Case pipeline stages for an ops date', async () => {
    const pipeline = await getDailyCasePipelineState('sacramento', '2099-01-01');
    assert.equal(pipeline.facility, 'sacramento');
    assert.equal(pipeline.opsDate, '2099-01-01');
    assert.equal(pipeline.mayShowNewInmates, false);
    assert.ok(pipeline.stages.length >= 8);
    assert.equal(pipeline.flags.pdfUploaded, false);
    assert.match(pipeline.operatorMessage, /Upload today's Sacramento PDF/i);
  });
});
