// ============================================
// Epic 2A — Leginfo acquisition unit tests
// ============================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resetCrawlerSafety } from '../src/workers/crawlerSafetyService.ts';
import { acquireStatuteHtml } from '../src/legislative/acquisition.ts';
import { rawHtmlExists, readRawHtml } from '../src/legislative/rawHtmlStore.ts';
import type { DiscoveryManifest } from '../src/legislative/types.ts';

const SAMPLE_HTML = `<div id="single_law_section"><h6><b>459.</b></h6><p>Burglary statute text.</p></div>`;

describe('Leginfo acquisition', () => {
  let tempDir: string;

  before(async () => {
    resetCrawlerSafety();
    tempDir = await mkdtemp(join(tmpdir(), 'leginfo-acquire-'));
  });

  after(async () => {
    resetCrawlerSafety();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('acquires raw HTML for manifest sections with mocked fetch', async () => {
    const manifest: DiscoveryManifest = {
      version: '1.0.0',
      code: 'PEN',
      codeName: 'Penal Code',
      discoveredAt: new Date().toISOString(),
      status: 'completed',
      audit: [],
      hierarchyNodes: [],
      sections: [
        {
          code: 'PEN',
          section: '459.',
          canonicalUrl:
            'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=459.',
          hierarchy: { code: 'PEN' },
          discoveryMethod: 'range',
          flags: [],
          sourceUrl: 'http://example.com',
        },
      ],
      stats: {
        pagesFetched: 1,
        expandedBranchPages: 0,
        displayTextPages: 0,
        hierarchyNodes: 0,
        sectionsDiscovered: 1,
        sectionsFromRanges: 1,
        sectionsFromLinks: 0,
        anomalies: 0,
      },
      anomalies: [],
    };

    const manifestPath = join(tempDir, 'PEN-manifest.json');
    await import('node:fs/promises').then((fs) =>
      fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf-8'),
    );

    const fetchImpl = async () =>
      ({
        ok: true,
        status: 200,
        text: async () => SAMPLE_HTML,
      }) as Response;

    const result = await acquireStatuteHtml(
      {
        code: 'PEN',
        manifestPath,
        rawHtmlDir: join(tempDir, 'raw'),
        maxSections: 1,
      },
      { fetchImpl },
    );

    assert.equal(result.acquired, 1);
    assert.equal(result.failed, 0);
    assert.equal(await rawHtmlExists(join(tempDir, 'raw'), 'PEN', '459.'), true);
    const html = await readRawHtml(join(tempDir, 'raw'), 'PEN', '459.');
    assert.ok(html.includes('single_law_section'));
  });

  it('records acquisition index with provenance metadata', async () => {
    const indexPath = join(tempDir, 'raw', 'PEN', 'acquisition-index.jsonl');
    const content = await readFile(indexPath, 'utf-8');
    const entry = JSON.parse(content.trim().split('\n')[0]);
    assert.equal(entry.section, '459.');
    assert.equal(entry.status, 'success');
    assert.ok(entry.contentHash);
    assert.ok(entry.retrievedAt);
  });
});
