// ============================================
// Epic 2A-007 — Criminal Liability Discovery Engine tests
// ============================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseLeginfoStatuteHtml } from '../src/legislative/statuteParser.ts';
import {
  classifyStatute,
  detectClassificationSignals,
  detectLiabilityPaths,
  shouldExtractOffense,
} from '../src/legislative/liabilityDiscovery/classificationEngine.ts';
import { collectLiabilityDiscoveryMetrics } from '../src/legislative/liabilityDiscovery/metrics.ts';
import { processStatutePipeline } from '../src/legislative/knowledgeGraph/pipeline.ts';
import { createRepositories } from '../src/legislative/knowledgeGraph/repositories.ts';

const FIXTURES = join(import.meta.dirname ?? '.', 'fixtures/leginfo');

describe('Criminal Liability Discovery Engine', () => {
  it('classifies PC 459 burglary as criminal offense with critical priority', async () => {
    const html = await readFile(join(FIXTURES, 'pen-459-section.html'), 'utf-8');
    const parsed = parseLeginfoStatuteHtml({
      html,
      sourceUrl: 'http://example.com',
      retrievedAt: '2026-07-04T00:00:00.000Z',
      code: 'PEN',
      section: '459.',
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    const classification = classifyStatute(parsed.record, { confirmedOffenseCount: 1 });
    assert.equal(classification.classification.value, 'criminal_offense');
    assert.equal(classification.discoveryPriority, 'critical');
    assert.equal(classification.confirmedOffense, true);
    assert.equal(classification.criminalLiabilityLikely, true);
    assert.ok(classification.evidence.length > 0);
    assert.ok(
      classification.liabilityPaths.value !== 'UNKNOWN' &&
        (classification.liabilityPaths.value as string[]).includes('direct_offense_language'),
    );
  });

  it('detects criminal liability in non-Penal Code text', () => {
    const text =
      'Any person who violates the provisions of this chapter shall be guilty of a misdemeanor and upon conviction shall be punished by a fine not exceeding one thousand dollars.';
    const evidence = detectClassificationSignals(text);
    const paths = detectLiabilityPaths(text, evidence);
    assert.ok(paths.includes('direct_offense_language'));
    assert.ok(paths.includes('penalty_clause'));
    assert.ok(shouldExtractOffense(text));
  });

  it('classifies definitional statutes without criminal liability', () => {
    const parsed = parseLeginfoStatuteHtml({
      html: `<div id="single_law_section"><h6><b>1.</b></h6><p>As used in this code, "person" means any natural person or organization.</p></div>`,
      sourceUrl: 'http://example.com',
      retrievedAt: '2026-07-04T00:00:00.000Z',
      code: 'PEN',
      section: '1.',
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    const classification = classifyStatute(parsed.record);
    assert.equal(classification.classification.value, 'definitions');
    assert.equal(classification.criminalLiabilityLikely, false);
    assert.equal(classification.confirmedOffense, false);
    assert.ok(['low', 'deferred'].includes(classification.discoveryPriority));
  });

  it('flags regulatory incorporation with manual review when liability paths present', () => {
    const parsed = parseLeginfoStatuteHtml({
      html: `<div id="single_law_section"><h6><b>100.</b></h6><p>Compliance with standards as set forth in the regulations adopted pursuant to Section 50 shall be required. Violation is punishable as provided in Section 200 of the Penal Code.</p></div>`,
      sourceUrl: 'http://example.com',
      retrievedAt: '2026-07-04T00:00:00.000Z',
      code: 'HSC',
      section: '100.',
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    const classification = classifyStatute(parsed.record);
    assert.ok(classification.criminalLiabilityLikely);
    assert.ok(classification.manualReviewRequired);
    const paths = classification.liabilityPaths.value;
    assert.notEqual(paths, 'UNKNOWN');
    if (paths !== 'UNKNOWN') {
      assert.ok(paths.includes('regulatory_incorporation') || paths.includes('cross_reference_to_penal'));
    }
  });

  it('assigns UNKNOWN classification when no signals match', () => {
    const parsed = parseLeginfoStatuteHtml({
      html: `<div id="single_law_section"><h6><b>99.</b></h6><p>This section shall become operative on January first following enactment.</p></div>`,
      sourceUrl: 'http://example.com',
      retrievedAt: '2026-07-04T00:00:00.000Z',
      code: 'GOV',
      section: '99.',
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    const classification = classifyStatute(parsed.record);
    assert.equal(classification.classification.value, 'unknown');
    assert.equal(classification.criminalLiabilityLikely, false);
  });
});

describe('Liability discovery repository integration', () => {
  let tempDir: string;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'liability-discovery-'));
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('stores classifications during pipeline processing', async () => {
    const result = await processStatutePipeline({
      code: 'PEN',
      rawHtmlDir: join(import.meta.dirname ?? '.', '../data/legislative/raw'),
      repositoryDir: tempDir,
      maxSections: 3,
    });

    assert.ok(result.classified >= 1);
    assert.ok(result.liabilityReportPath);

    const repos = createRepositories(tempDir);
    const count = await repos.statute_classifications.count();
    assert.ok(count >= 1);

    const metrics = await collectLiabilityDiscoveryMetrics({ repositoryDir: tempDir });
    assert.ok(metrics.statutesClassified >= 1);
    assert.ok(metrics.codesAnalyzed >= 1);
    assert.equal(metrics.byClassification.criminal_offense >= 0, true);
  });
});
