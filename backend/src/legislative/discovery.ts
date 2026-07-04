// ============================================================================
// Stage 1 — Leginfo discovery (BFS crawl of TOC / expandedbranch / displayText)
// ============================================================================

import { getCaliforniaCode } from './caCodes.ts';
import {
  appendAuditLog,
  createAuditEntry,
  createEmptyStats,
  defaultManifestPaths,
  finalizeManifest,
  mergeSections,
  readDiscoveryCheckpoint,
  sectionKey,
  writeDiscoveryCheckpoint,
  writeDiscoveryManifest,
} from './discoveryManifest.ts';
import {
  extractLeginfoLinks,
  isDisplayTextUrl,
  isExpandedBranchUrl,
  normalizeDiscoveryUrl,
  parseAmbiguousRanges,
  parseHierarchyHeadings,
  parseSectionLinks,
  parseSectionsFromRanges,
  urlToHierarchy,
} from './htmlParsers.ts';
import { buildCodeTocUrl } from './leginfoUrls.ts';
import { closeLeginfoSession, fetchLeginfoPage } from './leginfoHttp.ts';
import type {
  DiscoveryCheckpoint,
  DiscoveryManifest,
  DiscoveryOptions,
  DiscoveredSection,
  HierarchyNode,
} from './types.ts';

export interface DiscoveryRunResult {
  manifest: DiscoveryManifest;
  manifestPath: string;
  checkpointPath: string;
  auditPath: string;
}

export async function discoverCaliforniaCode(
  options: DiscoveryOptions,
): Promise<DiscoveryRunResult> {
  const codeInfo = getCaliforniaCode(options.code);
  if (!codeInfo) {
    throw new Error(`Unknown California code: ${options.code}`);
  }

  const outputDir = options.outputDir ?? 'data/legislative/discovery';
  const paths = defaultManifestPaths(outputDir, codeInfo.abbrev);
  const sessionId = `leginfo-discovery-${codeInfo.abbrev}`;

  let checkpoint: DiscoveryCheckpoint;

  if (options.resumeFrom) {
    checkpoint = await readDiscoveryCheckpoint(options.resumeFrom);
    checkpoint.audit.push(createAuditEntry('resume', `Resumed from ${options.resumeFrom}`));
  } else {
    const startedAt = new Date().toISOString();
    checkpoint = {
      version: '1.0.0',
      code: codeInfo.abbrev,
      startedAt,
      updatedAt: startedAt,
      visitedUrls: [],
      pendingUrls: [buildCodeTocUrl(codeInfo.abbrev)],
      sections: [],
      hierarchyNodes: [],
      anomalies: [],
      stats: createEmptyStats(),
      audit: [createAuditEntry('start', `Discovery started for ${codeInfo.name}`)],
    };
  }

  const visited = new Set(checkpoint.visitedUrls);
  const queue = [...checkpoint.pendingUrls];
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;

  try {
    while (queue.length > 0 && checkpoint.stats.pagesFetched < maxPages) {
      const rawUrl = queue.shift()!;
      const url = normalizeDiscoveryUrl(rawUrl, codeInfo.abbrev);
      if (visited.has(url)) continue;
      visited.add(url);

      checkpoint.audit.push(createAuditEntry('fetch', undefined, url));
      await appendAuditLog(paths.audit, createAuditEntry('fetch', undefined, url));

      const result = await fetchLeginfoPage(url, { sessionId });
      checkpoint.stats.pagesFetched += 1;
      if (isExpandedBranchUrl(url)) checkpoint.stats.expandedBranchPages += 1;
      if (isDisplayTextUrl(url)) checkpoint.stats.displayTextPages += 1;

      const hierarchy = urlToHierarchy(codeInfo.abbrev, url) ?? { code: codeInfo.abbrev };
      const headings = parseHierarchyHeadings(result.html, codeInfo.abbrev, url);
      checkpoint.hierarchyNodes.push(...headings);

      const fromRanges = parseSectionsFromRanges(result.html, codeInfo.abbrev, hierarchy, url);
      const fromLinks = parseSectionLinks(result.html, codeInfo.abbrev, hierarchy, url);
      const newSections = [...fromRanges, ...fromLinks];

      checkpoint.stats.sectionsFromRanges += fromRanges.length;
      checkpoint.stats.sectionsFromLinks += fromLinks.length;
      checkpoint.sections = mergeSections(checkpoint.sections, newSections);

      for (const ambiguous of parseAmbiguousRanges(result.html)) {
        checkpoint.anomalies.push({
          type: 'ambiguous_range',
          message: `Non-numeric section range requires child crawl: ${ambiguous}`,
          context: { url, code: codeInfo.abbrev },
        });
      }

      for (const link of extractLeginfoLinks(result.html)) {
        const normalized = normalizeDiscoveryUrl(link, codeInfo.abbrev);
        if (!visited.has(normalized) && !queue.includes(normalized)) {
          if (isExpandedBranchUrl(normalized) || isDisplayTextUrl(normalized)) {
            queue.push(normalized);
          }
        }
      }

      checkpoint.visitedUrls = Array.from(visited);
      checkpoint.pendingUrls = [...queue];
      checkpoint.updatedAt = new Date().toISOString();
      checkpoint.stats.sectionsDiscovered = checkpoint.sections.length;
      checkpoint.stats.hierarchyNodes = checkpoint.hierarchyNodes.length;
      checkpoint.stats.anomalies = checkpoint.anomalies.length;

      await writeDiscoveryCheckpoint(paths.checkpoint, checkpoint);
    }

    const status =
      queue.length > 0 && checkpoint.stats.pagesFetched >= maxPages ? 'partial' : 'completed';

    if (status === 'partial') {
      checkpoint.audit.push(
        createAuditEntry('partial', `Stopped at maxPages=${options.maxPages}; ${queue.length} URLs remaining`),
      );
    } else {
      checkpoint.audit.push(createAuditEntry('complete', `Discovered ${checkpoint.sections.length} sections`));
    }

    const manifest = finalizeManifest({
      code: codeInfo.abbrev,
      codeName: codeInfo.name,
      discoveredAt: checkpoint.startedAt,
      status,
      audit: checkpoint.audit,
      hierarchyNodes: dedupeHierarchyNodes(checkpoint.hierarchyNodes),
      sections: checkpoint.sections,
      stats: checkpoint.stats,
      anomalies: checkpoint.anomalies,
    });

    await writeDiscoveryManifest(paths.manifest, manifest);
    await appendAuditLog(paths.audit, createAuditEntry(status, `Manifest written with ${manifest.sections.length} sections`));

    return {
      manifest,
      manifestPath: paths.manifest,
      checkpointPath: paths.checkpoint,
      auditPath: paths.audit,
    };
  } finally {
    closeLeginfoSession(sessionId);
  }
}

function dedupeHierarchyNodes(nodes: HierarchyNode[]): HierarchyNode[] {
  const seen = new Set<string>();
  const result: HierarchyNode[] = [];
  for (const node of nodes) {
    const key = `${node.level}:${node.label}:${node.sectionRange ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(node);
  }
  return result;
}

export function discoverFromHtml(
  html: string,
  code: string,
  sourceUrl: string,
): DiscoveredSection[] {
  const hierarchy = urlToHierarchy(code, sourceUrl) ?? { code: code.toUpperCase() };
  return mergeSections(
    parseSectionsFromRanges(html, code, hierarchy, sourceUrl),
    parseSectionLinks(html, code, hierarchy, sourceUrl),
  );
}

export function countUniqueSections(sections: DiscoveredSection[]): number {
  return new Set(sections.map(sectionKey)).size;
}
