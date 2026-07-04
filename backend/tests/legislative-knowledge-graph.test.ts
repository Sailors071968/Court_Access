// ============================================
// Epic 2A — Statute parser + knowledge graph tests
// ============================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseLeginfoStatuteHtml } from '../src/legislative/statuteParser.ts';
import { extractCriminalKnowledge } from '../src/legislative/knowledgeGraph/intelligenceExtractor.ts';
import {
  processStatutePipeline,
  updateRepositoriesFromBundle,
  generateCoverageReport,
} from '../src/legislative/knowledgeGraph/pipeline.ts';
import { createRepositories } from '../src/legislative/knowledgeGraph/repositories.ts';

const FIXTURES = join(import.meta.dirname ?? '.', 'fixtures/leginfo');

describe('Leginfo statute parser', () => {
  it('parses PC 459 burglary section from fixture', async () => {
    const html = await readFile(join(FIXTURES, 'pen-459-section.html'), 'utf-8');
    const result = parseLeginfoStatuteHtml({
      html,
      sourceUrl:
        'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=459.',
      retrievedAt: '2026-07-04T00:00:00.000Z',
      code: 'PEN',
      section: '459.',
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.record.code, 'PEN');
    assert.equal(result.record.section, '459.');
    assert.ok(result.record.fullText.toLowerCase().includes('guilty of burglary'));
    assert.ok(result.record.hierarchy.chapter?.includes('Burglary'));
    assert.ok(result.record.subdivisions.length >= 2);
    assert.ok(result.record.contentHash.length === 64);
  });

  it('rejects HTML missing single_law_section', () => {
    const result = parseLeginfoStatuteHtml({
      html: '<html><body>no statute content</body></html>',
      sourceUrl: 'http://example.com',
      retrievedAt: '2026-07-04T00:00:00.000Z',
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.rejection.reason, 'missing_single_law_section');
  });
});

describe('Criminal intelligence extractor', () => {
  it('extracts burglary offense, mens rea, and elements from PC 459', async () => {
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

    const bundle = extractCriminalKnowledge(parsed.record);
    assert.equal(bundle.offenses.length, 1);
    assert.equal(bundle.offenses[0].name.value, 'burglary');
    assert.equal(bundle.mensRea.length, 1);
    assert.ok(bundle.mensRea[0].terms.value !== 'UNKNOWN');
    assert.ok(bundle.elements.length >= 2);
    assert.ok(bundle.crossReferences.length >= 1);
    assert.ok(bundle.calcrimLinks.length >= 1);
    assert.equal(bundle.statute.audit.sourceStatuteId, bundle.statute.id);
  });

  it('returns empty offenses for non-criminal definitional text', () => {
    const parsed = parseLeginfoStatuteHtml({
      html: `<div id="single_law_section"><h6><b>1.</b></h6><p>As used in this code, "person" means any natural person or organization.</p></div>`,
      sourceUrl: 'http://example.com',
      retrievedAt: '2026-07-04T00:00:00.000Z',
      code: 'PEN',
      section: '1.',
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const bundle = extractCriminalKnowledge(parsed.record);
    assert.equal(bundle.offenses.length, 0);
  });
});

describe('Knowledge graph repositories', () => {
  let tempDir: string;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kg-repo-'));
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('deduplicates records on unchanged re-upsert', async () => {
    const repos = createRepositories(tempDir);
    const record = { id: 'test-1', value: 'alpha' };
    assert.equal(await repos.statutes.upsert(record), 'inserted');
    assert.equal(await repos.statutes.upsert(record), 'unchanged');
    assert.equal(await repos.statutes.count(), 1);
  });

  it('generates coverage report with repository metrics', async () => {
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

    const bundle = extractCriminalKnowledge(parsed.record);
    await updateRepositoriesFromBundle(bundle, tempDir);
    const report = await generateCoverageReport(tempDir, new Set([bundle.statute.id]), 0);

    assert.ok(report.statutes.totalRecords >= 1);
    assert.ok(report.offenses.totalRecords >= 1);
    assert.ok(report.elements.totalRecords >= 1);
    assert.equal(report.criminalOffensesIdentified, 1);
  });
});

describe('Process pipeline', () => {
  let tempDir: string;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kg-pipeline-'));
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('processes acquired raw HTML files into repositories', async () => {
    const result = await processStatutePipeline({
      code: 'PEN',
      rawHtmlDir: join(import.meta.dirname ?? '.', '../data/legislative/raw'),
      repositoryDir: tempDir,
      maxSections: 3,
    });

    assert.ok(result.processed >= 1);
    assert.ok(result.offenses >= 0);
  });
});
