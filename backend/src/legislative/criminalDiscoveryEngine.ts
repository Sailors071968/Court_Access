// ============================================================================
// Criminal Liability Discovery Engine (Program 68A)
// Targeted acquisition: discover criminal liability FIRST by acquiring known
// high-criminality sections directly (by section number) rather than crawling
// entire codes top-to-bottom. Produces a synthetic discovery manifest that the
// existing acquire → process pipeline consumes.
//
// Engineering Constitution: never fabricate criminal liability — the manifest
// only *targets* sections; the classifier scores criminality from real text.
// ============================================================================

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildSectionUrl } from './leginfoUrls.ts';
import { CRIMINAL_SEEDS } from './criminalSeeds.ts';
import type { DiscoveryManifest, DiscoveredSection } from './types.ts';

function normalizeSection(section: string): string {
  // leginfo section numbers are stored with a trailing period in manifests
  return section.endsWith('.') ? section : `${section}.`;
}

/**
 * Build a targeted "criminal-liability" discovery manifest for a code from its
 * curated seed sections. This replaces sequential crawling with direct,
 * high-criminality-first targeting.
 */
export function buildCriminalManifest(code: string): DiscoveryManifest {
  const upper = code.toUpperCase();
  const seeds = CRIMINAL_SEEDS[upper];
  if (!seeds) throw new Error(`No criminal seeds registered for code ${upper}`);

  const sections: DiscoveredSection[] = seeds.sections.map((raw) => {
    const section = normalizeSection(raw);
    return {
      code: upper,
      section,
      canonicalUrl: buildSectionUrl(upper, section),
      hierarchy: { code: upper },
      discoveryMethod: 'targeted_criminal_seed',
      flags: ['criminal_priority'],
      sourceUrl: buildSectionUrl(upper, section),
    };
  });

  const now = new Date().toISOString();
  return {
    version: '1.0.0-criminal',
    code: upper,
    codeName: seeds.codeName,
    discoveredAt: now,
    completedAt: now,
    status: 'completed',
    audit: [{ timestamp: now, action: 'criminal_seed_targeting', detail: `${sections.length} seed sections` }],
    hierarchyNodes: [],
    sections,
    stats: {
      pagesFetched: 0,
      expandedBranchPages: 0,
      displayTextPages: 0,
      hierarchyNodes: 0,
      sectionsDiscovered: sections.length,
      sectionsFromRanges: 0,
      sectionsFromLinks: 0,
      anomalies: 0,
    },
    anomalies: [],
  };
}

/**
 * Write the criminal manifest to disk under a distinct filename so it never
 * clobbers a full-crawl discovery manifest (`{CODE}-discovery-manifest.json`).
 */
export async function writeCriminalManifest(code: string, outputDir = 'data/legislative/discovery'): Promise<string> {
  const manifest = buildCriminalManifest(code);
  const path = resolve(outputDir, `${code.toUpperCase()}-criminal-manifest.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(manifest, null, 2), 'utf-8');
  return path;
}
