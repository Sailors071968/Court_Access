// ============================================
// Epic 2A — Leginfo discovery unit tests
// ============================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resetCrawlerSafety } from '../src/workers/crawlerSafetyService.ts';
import {
  CALIFORNIA_CODES,
  getCaliforniaCode,
  getCriminalPriorityCodes,
} from '../src/legislative/caCodes.ts';
import {
  buildCodeTocUrl,
  buildSectionUrl,
  normalizeSectionNumber,
} from '../src/legislative/leginfoUrls.ts';
import {
  expandSectionRange,
  extractLeginfoLinks,
  parseHierarchyHeadings,
  parseSectionLinks,
  parseSectionRange,
  parseSectionsFromRanges,
} from '../src/legislative/htmlParsers.ts';
import { discoverFromHtml, countUniqueSections } from '../src/legislative/discovery.ts';
import { mergeSections, sectionKey } from '../src/legislative/discoveryManifest.ts';

const FIXTURES = resolve(import.meta.dirname ?? '.', 'fixtures/leginfo');

describe('California code registry', () => {
  it('lists 30 California codes from leginfo', () => {
    assert.equal(CALIFORNIA_CODES.length, 30);
  });

  it('marks criminal-priority codes', () => {
    const criminal = getCriminalPriorityCodes().map((c) => c.abbrev).sort();
    assert.deepEqual(criminal, ['BPC', 'EVID', 'HSC', 'PEN', 'VEH']);
  });

  it('resolves PEN', () => {
    const pen = getCaliforniaCode('pen');
    assert.ok(pen);
    assert.equal(pen.abbrev, 'PEN');
    assert.equal(pen.criminalPriority, true);
  });
});

describe('Leginfo URL helpers', () => {
  it('builds TOC URL', () => {
    assert.equal(
      buildCodeTocUrl('PEN'),
      'https://leginfo.legislature.ca.gov/faces/codesTOCSelected.xhtml?tocCode=PEN',
    );
  });

  it('normalizes section numbers with trailing dot', () => {
    assert.equal(normalizeSectionNumber('459'), '459.');
    assert.equal(normalizeSectionNumber('459.'), '459.');
    assert.equal(normalizeSectionNumber('10.5'), '10.5.');
  });

  it('builds section URL', () => {
    assert.equal(
      buildSectionUrl('PEN', '459'),
      'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=459.',
    );
  });
});

describe('HTML parsers', () => {
  it('parses numeric section ranges', () => {
    const range = parseSectionRange('CHAPTER 2. Burglary [458 - 465]');
    assert.ok(range);
    assert.equal(range.start, '458');
    assert.equal(range.end, '465');
    assert.equal(range.expandable, true);
    assert.deepEqual(expandSectionRange(range), [
      '458.', '459.', '460.', '461.', '462.', '463.', '464.', '465.',
    ]);
  });

  it('flags non-expandable alpha suffix ranges', () => {
    const range = parseSectionRange('TITLE 13. OF CRIMES AGAINST PROPERTY [450 - 593g]');
    assert.ok(range);
    assert.equal(range.expandable, false);
    assert.deepEqual(expandSectionRange(range), []);
  });

  it('extracts expandedbranch and displayText links from PEN TOC fixture', async () => {
    const html = await readFile(resolve(FIXTURES, 'pen-toc.html'), 'utf-8');
    const links = extractLeginfoLinks(html);
    assert.ok(links.some((l) => l.includes('codes_displayexpandedbranch.xhtml?tocCode=PEN')));
    assert.ok(links.length >= 5);
  });

  it('parses hierarchy headings from chapter branch fixture', async () => {
    const html = await readFile(resolve(FIXTURES, 'pen-chapter2-branch.html'), 'utf-8');
    const nodes = parseHierarchyHeadings(
      html,
      'PEN',
      'https://leginfo.legislature.ca.gov/faces/codes_displayexpandedbranch.xhtml?tocCode=PEN',
    );
    const chapter = nodes.find((n) => n.label.includes('Burglary'));
    assert.ok(chapter);
    assert.equal(chapter.sectionRange, '[458 - 465]');
    assert.equal(chapter.level, 'chapter');
  });

  it('discovers burglary sections 458-465 from chapter branch fixture', async () => {
    const html = await readFile(resolve(FIXTURES, 'pen-chapter2-branch.html'), 'utf-8');
    const sourceUrl =
      'https://leginfo.legislature.ca.gov/faces/codes_displayexpandedbranch.xhtml?tocCode=PEN&chapter=2.';
    const sections = discoverFromHtml(html, 'PEN', sourceUrl);
    assert.ok(countUniqueSections(sections) >= 8);
    const pc459 = sections.find((s) => s.section === '459.');
    assert.ok(pc459);
    assert.equal(pc459!.discoveryMethod, 'range');
    assert.ok(pc459!.canonicalUrl.includes('sectionNum=459.'));
    assert.ok(sections.some((s) => s.section === '459.5.'));
  });

  it('extracts displayText links from part 1 branch fixture', async () => {
    const html = await readFile(resolve(FIXTURES, 'pen-part1-branch.html'), 'utf-8');
    const links = extractLeginfoLinks(html);
    assert.ok(links.some((l) => l.includes('codes_displayText.xhtml?lawCode=PEN')));
    assert.ok(links.some((l) => l.includes('title=13.') && l.includes('chapter=2.')));
  });

  it('parses section links when present in HTML', () => {
    const html = `
      <a href="/faces/codes_displaySection.xhtml?lawCode=PEN&amp;sectionNum=187.">187</a>
      <h6><b>459. </b></h6>
    `;
    const sections = parseSectionLinks(html, 'PEN', { code: 'PEN' }, 'http://example.com');
    assert.equal(sections.length, 2);
    assert.ok(sections.some((s) => s.section === '187.'));
    assert.ok(sections.some((s) => s.section === '459.'));
  });

  it('deduplicates merged sections', () => {
    const base = {
      code: 'PEN',
      section: '459.',
      canonicalUrl: buildSectionUrl('PEN', '459'),
      hierarchy: { code: 'PEN' },
      discoveryMethod: 'range' as const,
      flags: [],
      sourceUrl: 'http://example.com',
    };
    const merged = mergeSections([base], [{ ...base, discoveryMethod: 'link' }]);
    assert.equal(merged.length, 1);
    assert.equal(sectionKey(merged[0]), 'PEN:459.');
  });
});

describe('Section range expansion from display text', () => {
  it('expands decimal section ranges', () => {
    const range = parseSectionRange('[10.5 - 11]');
    assert.ok(range?.expandable);
    const expanded = expandSectionRange(range!);
    assert.ok(expanded.includes('10.5.'));
    assert.ok(expanded.includes('11.'));
  });

  it('parses sections from HTML with embedded chapter ranges', () => {
    const html = '<h5><b>CHAPTER 2. Burglary [458 - 460]</b></h5>';
    const sections = parseSectionsFromRanges(html, 'PEN', { code: 'PEN' }, 'http://example.com');
    assert.equal(sections.length, 3);
  });
});

before(() => {
  resetCrawlerSafety();
});

after(() => {
  resetCrawlerSafety();
});
