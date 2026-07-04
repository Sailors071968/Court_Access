// ============================================
// Pipeline stages + attorney intelligence tests
// ============================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeLeginfoHtml, stripHtmlTags } from '../src/legislative/normalization.ts';
import { runLegislativePipeline } from '../src/legislative/pipelineStages.ts';
import { getAttorneyStatuteIntelligence } from '../src/legislative/attorneyIntelligence.ts';
import { processStatutePipeline } from '../src/legislative/knowledgeGraph/pipeline.ts';

const FIXTURES = join(import.meta.dirname ?? '.', 'fixtures/leginfo');

describe('Normalization stage', () => {
  it('normalizes PC 459 burglary HTML to canonical text', async () => {
    const html = await readFile(join(FIXTURES, 'pen-459-section.html'), 'utf-8');
    const result = normalizeLeginfoHtml({ html, code: 'PEN', section: '459.' });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.normalized.code, 'PEN');
    assert.equal(result.normalized.section, '459.');
    assert.ok(result.normalized.fullText.toLowerCase().includes('guilty of burglary'));
    assert.equal(result.normalized.normalizationVersion, '1.0.0');
  });

  it('rejects HTML missing single_law_section', () => {
    const result = normalizeLeginfoHtml({ html: '<html><body>empty</body></html>' });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.rejection.reason, 'missing_single_law_section');
  });

  it('strips HTML tags consistently', () => {
    const text = stripHtmlTags('<p>Hello&nbsp;<b>world</b></p>');
    assert.equal(text, 'Hello world');
  });
});

describe('Canonical pipeline stages', () => {
  it('runs normalization → classification → legal extraction in order', async () => {
    const html = await readFile(join(FIXTURES, 'pen-459-section.html'), 'utf-8');
    const result = runLegislativePipeline({
      html,
      sourceUrl: 'http://example.com',
      retrievedAt: '2026-07-04T00:00:00.000Z',
      code: 'PEN',
      section: '459.',
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.ok(result.normalized);
    assert.ok(result.statute);
    assert.ok(result.classification);
    assert.ok(result.bundle);
    assert.equal(result.stages.length, 3);
    assert.equal(result.stages[0].stage, 'normalization');
    assert.equal(result.stages[1].stage, 'classification');
    assert.equal(result.stages[2].stage, 'legal_extraction');
    assert.equal(result.bundle.offenses.length, 1);
    assert.equal(result.classification.confirmedOffense, true);
  });
});

describe('Attorney Intelligence', () => {
  let tempDir: string;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'attorney-intel-'));
    await processStatutePipeline({
      code: 'PEN',
      rawHtmlDir: join(import.meta.dirname ?? '.', '../data/legislative/raw'),
      repositoryDir: tempDir,
      sections: ['459.'],
    });
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('composes statute, classification, offenses, and authorities for attorneys', async () => {
    const intel = await getAttorneyStatuteIntelligence('PEN', '459.', {
      repositoryDir: tempDir,
    });

    assert.ok(intel);
    assert.equal(intel!.code, 'PEN');
    assert.equal(intel!.section, '459.');
    assert.ok(intel!.statute);
    assert.ok(intel!.classification);
    assert.ok(intel!.offenses.length >= 1);
    assert.ok(intel!.audit);
    assert.equal(intel!.confirmedOffense, true);
    assert.equal(intel!.criminalLiabilityLikely, true);
  });

  it('returns null for unknown statute', async () => {
    const intel = await getAttorneyStatuteIntelligence('PEN', '99999.', {
      repositoryDir: tempDir,
    });
    assert.equal(intel, null);
  });
});
