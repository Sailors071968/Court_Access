// ============================================================================
// Leginfo HTML parsers — regex-based, no DOM dependency
// ============================================================================

import {
  buildDisplayTextUrl,
  buildLeginfoUrl,
  buildSectionUrl,
  canonicalizeLeginfoUrl,
  hierarchyFromParams,
  normalizeSectionNumber,
  parseLeginfoUrl,
} from './leginfoUrls.ts';
import type { DiscoveredSection, HierarchyNode, SectionFlag, StatuteHierarchy } from './types.ts';

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(?:#x[0-9a-fA-F]+|#\d+|\w+);/g, (entity) => {
    if (HTML_ENTITY_MAP[entity]) return HTML_ENTITY_MAP[entity];
    if (entity.startsWith('&#x')) return String.fromCharCode(parseInt(entity.slice(3, -1), 16));
    if (entity.startsWith('&#')) return String.fromCharCode(parseInt(entity.slice(2, -1), 10));
    return entity;
  });
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function extractLeginfoLinks(html: string): string[] {
  const links = new Set<string>();
  const patterns = [
    /(?:href|action)=["'](\/faces\/[^"']+)["']/gi,
    /(?:href|action)=["'](codes_[^"']+\.xhtml[^"']*)["']/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const raw = decodeHtmlEntities(match[1]);
      const path = raw.startsWith('/faces/') ? raw.replace('/faces/', '') : raw;
      const parsed = parseLeginfoUrl(path);
      if (parsed && isDiscoveryRelevantPath(parsed.path)) {
        links.add(canonicalizeLeginfoUrl(path.startsWith('http') ? path : `/faces/${path}`));
      }
    }
  }

  return Array.from(links);
}

function isDiscoveryRelevantPath(path: string): boolean {
  return (
    path.includes('codes_displayexpandedbranch.xhtml') ||
    path.includes('codes_displayText.xhtml') ||
    path.includes('codes_displaySection.xhtml') ||
    path.includes('codesTOCSelected.xhtml')
  );
}

export interface ParsedSectionRange {
  start: string;
  end: string;
  raw: string;
  expandable: boolean;
}

export function parseSectionRange(raw: string): ParsedSectionRange | null {
  const match = raw.match(/\[(\S+)\s*-\s*(\S+)\]/);
  if (!match) return null;
  const start = match[1].trim();
  const end = match[2].trim();
  const expandable = isExpandableSectionId(start) && isExpandableSectionId(end);
  return { start, end, raw: match[0], expandable };
}

function isExpandableSectionId(id: string): boolean {
  return /^\d+(?:\.\d+)?$/.test(id);
}

export function expandSectionRange(range: ParsedSectionRange, maxSections = 200): string[] {
  if (!range.expandable) return [];

  const startNum = parseFloat(range.start);
  const endNum = parseFloat(range.end);
  if (Number.isNaN(startNum) || Number.isNaN(endNum) || endNum < startNum) return [];

  const sections: string[] = [];
  const startIsInt = /^\d+$/.test(range.start);
  const endIsInt = /^\d+$/.test(range.end);

  if (startIsInt && endIsInt) {
    for (let n = Math.ceil(startNum); n <= Math.floor(endNum); n++) {
      sections.push(normalizeSectionNumber(String(n)));
      if (sections.length >= maxSections) break;
    }
    return sections;
  }

  const hasDecimal = range.start.includes('.') || range.end.includes('.');
  if (hasDecimal && endNum - startNum <= 10) {
    const step = range.start.includes('.5') || range.end.includes('.5') ? 0.5 : 0.1;
    for (let n = startNum; n <= endNum + 0.001; n += step) {
      const normalized = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
      sections.push(normalizeSectionNumber(normalized));
      if (sections.length >= maxSections) break;
    }
  }

  return sections;
}

function detectHeadingFlags(text: string): SectionFlag[] {
  const flags: SectionFlag[] = [];
  const upper = text.toUpperCase();
  if (upper.includes('REPEALED')) flags.push('repealed');
  if (upper.includes('RESERVED')) flags.push('reserved');
  if (upper.includes('RENUMBERED')) flags.push('renumbered');
  return flags;
}

function inferHierarchyLevel(label: string): HierarchyNode['level'] {
  const upper = label.toUpperCase();
  if (upper.startsWith('DIVISION')) return 'division';
  if (upper.startsWith('TITLE')) return 'title';
  if (upper.startsWith('PART')) return 'part';
  if (upper.startsWith('CHAPTER')) return 'chapter';
  if (upper.startsWith('ARTICLE')) return 'article';
  return 'other';
}

export function parseHierarchyHeadings(
  html: string,
  code: string,
  sourceUrl: string,
): HierarchyNode[] {
  const nodes: HierarchyNode[] = [];
  const headingPattern = /<h[456][^>]*>([\s\S]*?)<\/h[456]>/gi;
  let match: RegExpExecArray | null;

  while ((match = headingPattern.exec(html)) !== null) {
    const text = stripTags(match[1]);
    if (!text || text.length < 3) continue;

    const range = parseSectionRange(text);
    const flags = detectHeadingFlags(text);

    nodes.push({
      code: code.toUpperCase(),
      level: inferHierarchyLevel(text),
      label: text.replace(/\[[^\]]+\]/, '').trim(),
      sectionRange: range?.raw,
      url: sourceUrl,
      flags,
    });
  }

  return nodes;
}

export function parseSectionLinks(
  html: string,
  code: string,
  defaultHierarchy: StatuteHierarchy,
  sourceUrl: string,
): DiscoveredSection[] {
  const sections: DiscoveredSection[] = [];
  const seen = new Set<string>();

  const linkPattern = /codes_displaySection\.xhtml\?([^"'<>\s]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const query = decodeHtmlEntities(match[1]);
    const parsed = parseLeginfoUrl(`codes_displaySection.xhtml?${query}`);
    if (!parsed?.params.sectionNum) continue;

    const section = normalizeSectionNumber(parsed.params.sectionNum);
    const key = section;
    if (seen.has(key)) continue;
    seen.add(key);

    sections.push({
      code: code.toUpperCase(),
      section,
      canonicalUrl: buildSectionUrl(code, section),
      hierarchy: { ...defaultHierarchy },
      discoveryMethod: 'link',
      flags: [],
      sourceUrl,
    });
  }

  const headingSectionPattern = /<h6[^>]*>\s*<b>(\d+(?:\.\d+)?[a-z]?)\s*\.?\s*<\/b>/gi;
  while ((match = headingSectionPattern.exec(html)) !== null) {
    const section = normalizeSectionNumber(match[1]);
    if (seen.has(section)) continue;
    seen.add(section);

    sections.push({
      code: code.toUpperCase(),
      section,
      canonicalUrl: buildSectionUrl(code, section),
      hierarchy: { ...defaultHierarchy },
      discoveryMethod: 'heading',
      flags: [],
      sourceUrl,
    });
  }

  const jsSectionPattern = /submitCodesValues\('(\d+(?:\.\d+)?[a-z]?)\.?'/gi;
  while ((match = jsSectionPattern.exec(html)) !== null) {
    const section = normalizeSectionNumber(match[1]);
    if (seen.has(section)) continue;
    seen.add(section);

    sections.push({
      code: code.toUpperCase(),
      section,
      canonicalUrl: buildSectionUrl(code, section),
      hierarchy: { ...defaultHierarchy },
      discoveryMethod: 'link',
      flags: [],
      sourceUrl,
    });
  }

  return sections;
}

export function parseSectionsFromRanges(
  html: string,
  code: string,
  hierarchy: StatuteHierarchy,
  sourceUrl: string,
): DiscoveredSection[] {
  const sections: DiscoveredSection[] = [];
  const seen = new Set<string>();

  const headingPattern = /<h[456][^>]*>([\s\S]*?)<\/h[456]>/gi;
  let match: RegExpExecArray | null;

  while ((match = headingPattern.exec(html)) !== null) {
    const headingText = stripTags(match[1]);
    const range = parseSectionRange(headingText);
    if (!range?.expandable) continue;

    // Only expand chapter/article-level ranges; skip broad part/title containers.
    const upper = headingText.toUpperCase();
    if (!upper.includes('CHAPTER') && !upper.includes('ARTICLE')) continue;

    for (const section of expandSectionRange(range)) {
      if (seen.has(section)) continue;
      seen.add(section);

      sections.push({
        code: code.toUpperCase(),
        section,
        canonicalUrl: buildSectionUrl(code, section),
        hierarchy: { ...hierarchy, heading: headingText.replace(/\[[^\]]+\]/, '').trim() },
        discoveryMethod: 'range',
        flags: detectHeadingFlags(headingText),
        sourceUrl,
      });
    }
  }

  return sections;
}

export function parseAmbiguousRanges(html: string): string[] {
  const ambiguous: string[] = [];
  const text = stripTags(html);
  const rangePattern = /\[(\S+)\s*-\s*(\S+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = rangePattern.exec(text)) !== null) {
    const range = parseSectionRange(match[0]);
    if (range && !range.expandable) {
      ambiguous.push(range.raw);
    }
  }

  return ambiguous;
}

export function urlToHierarchy(code: string, url: string): StatuteHierarchy | null {
  const parsed = parseLeginfoUrl(url);
  if (!parsed) return null;

  if (parsed.path.includes('codes_displayText.xhtml')) {
    return hierarchyFromParams(parsed.params.lawCode ?? code, parsed.params);
  }

  if (parsed.path.includes('codes_displayexpandedbranch.xhtml')) {
    return hierarchyFromParams(code, parsed.params);
  }

  return { code: code.toUpperCase() };
}

export function isExpandedBranchUrl(url: string): boolean {
  return url.includes('codes_displayexpandedbranch.xhtml');
}

export function isDisplayTextUrl(url: string): boolean {
  return url.includes('codes_displayText.xhtml');
}

export function normalizeDiscoveryUrl(url: string, code: string): string {
  const parsed = parseLeginfoUrl(url);
  if (!parsed) return url;

  if (parsed.path.includes('codes_displayexpandedbranch.xhtml')) {
    return buildLeginfoUrl('codes_displayexpandedbranch.xhtml', {
      tocCode: code.toUpperCase(),
      division: parsed.params.division ?? '',
      title: parsed.params.title ?? '',
      part: parsed.params.part ?? '',
      chapter: parsed.params.chapter ?? '',
      article: parsed.params.article ?? '',
      nodetreepath: parsed.params.nodetreepath,
    });
  }

  if (parsed.path.includes('codes_displayText.xhtml')) {
    const hierarchy = hierarchyFromParams(code, parsed.params);
    return buildDisplayTextUrl(hierarchy);
  }

  return canonicalizeLeginfoUrl(url);
}
