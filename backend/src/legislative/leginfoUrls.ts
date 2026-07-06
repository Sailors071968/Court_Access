// ============================================================================
// Leginfo URL builders and parsers
// ============================================================================

import { LEGINFO_BASE_URL } from './caCodes.ts';
import type { StatuteHierarchy } from './types.ts';

const FACES_PREFIX = '/faces/';

export interface LeginfoQueryParams {
  tocCode?: string;
  lawCode?: string;
  division?: string;
  title?: string;
  part?: string;
  chapter?: string;
  article?: string;
  sectionNum?: string;
  nodetreepath?: string;
  goUp?: string;
}

function normalizeParam(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined;
  return value;
}

export function buildLeginfoUrl(path: string, params: LeginfoQueryParams = {}): string {
  const url = new URL(`${FACES_PREFIX}${path}`, LEGINFO_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    const normalized = normalizeParam(value);
    if (normalized !== undefined) {
      url.searchParams.set(key, normalized);
    }
  }
  return url.toString();
}

export function buildCodeTocUrl(code: string): string {
  return buildLeginfoUrl('codesTOCSelected.xhtml', { tocCode: code.toUpperCase() });
}

export function buildExpandedBranchUrl(code: string, hierarchy: Partial<StatuteHierarchy> = {}): string {
  return buildLeginfoUrl('codes_displayexpandedbranch.xhtml', {
    tocCode: code.toUpperCase(),
    division: hierarchy.division ?? '',
    title: hierarchy.title ?? '',
    part: hierarchy.part ?? '',
    chapter: hierarchy.chapter ?? '',
    article: hierarchy.article ?? '',
    nodetreepath: hierarchy.article ? undefined : undefined,
  });
}

export function buildDisplayTextUrl(hierarchy: StatuteHierarchy): string {
  return buildLeginfoUrl('codes_displayText.xhtml', {
    lawCode: hierarchy.code.toUpperCase(),
    division: hierarchy.division ?? '',
    title: hierarchy.title ?? '',
    part: hierarchy.part ?? '',
    chapter: hierarchy.chapter ?? '',
    article: hierarchy.article ?? '',
  });
}

export function buildSectionUrl(code: string, sectionNum: string): string {
  const normalized = normalizeSectionNumber(sectionNum);
  return buildLeginfoUrl('codes_displaySection.xhtml', {
    lawCode: code.toUpperCase(),
    sectionNum: normalized,
  });
}

export function normalizeSectionNumber(section: string): string {
  const trimmed = section.trim().replace(/\.$/, '');
  if (!trimmed) return section;
  return `${trimmed}.`;
}

export function parseLeginfoUrl(rawUrl: string): {
  path: string;
  params: LeginfoQueryParams;
} | null {
  try {
    const url = rawUrl.startsWith('http')
      ? new URL(rawUrl)
      : new URL(rawUrl, LEGINFO_BASE_URL);
    const path = url.pathname.replace(FACES_PREFIX, '');
    const params: LeginfoQueryParams = {};
    for (const [key, value] of url.searchParams.entries()) {
      (params as Record<string, string>)[key] = value;
    }
    return { path, params };
  } catch {
    return null;
  }
}

export function hierarchyFromParams(
  code: string,
  params: LeginfoQueryParams,
): StatuteHierarchy {
  return {
    code: code.toUpperCase(),
    division: normalizeParam(params.division),
    title: normalizeParam(params.title),
    part: normalizeParam(params.part),
    chapter: normalizeParam(params.chapter),
    article: normalizeParam(params.article),
  };
}

export function canonicalizeLeginfoUrl(rawUrl: string): string {
  const parsed = parseLeginfoUrl(rawUrl);
  if (!parsed) return rawUrl;
  return buildLeginfoUrl(parsed.path, parsed.params);
}
