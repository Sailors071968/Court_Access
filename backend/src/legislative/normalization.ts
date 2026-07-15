// ============================================================================
// Stage 3 — Normalization
// Transforms acquired leginfo HTML into canonical statutory text
// ============================================================================

import { createHash } from 'node:crypto';
import type { StatuteHierarchy } from './types.ts';
import type { StatuteSubdivision } from './knowledgeGraph/types.ts';
import { normalizeSectionNumber } from './leginfoUrls.ts';

export const NORMALIZATION_VERSION = '1.0.0';

export interface NormalizeLeginfoInput {
  html: string;
  code?: string;
  section?: string;
}

export type NormalizationRejectionReason =
  | 'missing_single_law_section'
  | 'missing_code_or_section'
  | 'insufficient_text';

export interface NormalizationRejection {
  code: string;
  section: string;
  reason: NormalizationRejectionReason;
  contentHash: string;
}

export interface NormalizedStatute {
  code: string;
  section: string;
  title: string;
  hierarchy: StatuteHierarchy;
  fullText: string;
  subdivisions: StatuteSubdivision[];
  effectiveDate: string | 'UNKNOWN';
  flags: string[];
  contentHash: string;
  normalizationVersion: string;
}

export type NormalizeLeginfoResult =
  | { ok: true; normalized: NormalizedStatute }
  | { ok: false; rejection: NormalizationRejection };

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function stripHtmlTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function extractSingleLawSection(html: string): string | null {
  const match = html.match(/id="single_law_section"[^>]*>([\s\S]*?)(?:<\/div>\s*<\/div>\s*<\/form>|$)/i);
  if (match) return match[1];
  const alt = html.match(/id="codeLawSectionNoHead"[^>]*>([\s\S]*)/i);
  return alt ? alt[1] : null;
}

function parseHierarchyFromSection(html: string, code: string): StatuteHierarchy {
  const hierarchy: StatuteHierarchy = { code: code.toUpperCase() };

  const patterns: Array<{ key: keyof StatuteHierarchy; regex: RegExp }> = [
    { key: 'division', regex: /DIVISION\s+[\d.]+\s*[^<[]*/i },
    { key: 'part', regex: /PART\s+[\d.]+\s*[^<[]*/i },
    { key: 'title', regex: /TITLE\s+[\d.]+\s*[^<[]*/i },
    { key: 'chapter', regex: /CHAPTER\s+[\d.]+\s*[^<[]*/i },
    { key: 'article', regex: /ARTICLE\s+[\d.]+\s*[^<[]*/i },
  ];

  for (const { key, regex } of patterns) {
    const m = html.match(regex);
    if (m) hierarchy[key] = stripHtmlTags(m[0]);
  }

  return hierarchy;
}

function parseSectionNumber(html: string): string | null {
  const titleMatch = html.match(/<title>California Code,\s*([A-Z]+)\s+([\d.]+)<\/title>/i);
  if (titleMatch) return normalizeSectionNumber(titleMatch[2]);

  const h6 = html.match(/<h6[^>]*>\s*<b>(\d+(?:\.\d+)?[a-z]?)\s*\.?\s*<\/b>/i);
  if (h6) return normalizeSectionNumber(h6[1]);

  const param = html.match(/sectionNum['":\s=]+['"]?(\d+(?:\.\d+)?[a-z]?)\.?/i);
  if (param) return normalizeSectionNumber(param[1]);

  return null;
}

function parseCode(html: string, fallback?: string): string | null {
  const titleMatch = html.match(/<title>California Code,\s*([A-Z]+)\s+/i);
  if (titleMatch) return titleMatch[1].toUpperCase();
  const h4 = html.match(/<h4><b>([A-Za-z ]+)\s*-\s*([A-Z]+)<\/b><\/h4>/i);
  if (h4) return h4[2].toUpperCase();
  return fallback?.toUpperCase() ?? null;
}

function parseEffectiveDate(text: string): string | 'UNKNOWN' {
  const match = text.match(/Effective\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  return match ? match[1] : 'UNKNOWN';
}

function detectFlags(text: string): string[] {
  const flags: string[] = [];
  const upper = text.toUpperCase();
  if (upper.includes('REPEALED')) flags.push('repealed');
  if (upper.includes('RESERVED')) flags.push('reserved');
  if (upper.includes('RENUMBERED')) flags.push('renumbered');
  return flags;
}

function parseSubdivisions(sectionHtml: string): StatuteSubdivision[] {
  const text = stripHtmlTags(sectionHtml);
  const subdivisions: StatuteSubdivision[] = [];

  const topLevel = text.match(/\([a-z]\)\s*[^()]+/gi) ?? [];
  for (const chunk of topLevel) {
    const labelMatch = chunk.match(/^\(([a-z])\)\s*(.*)/i);
    if (!labelMatch) continue;
    subdivisions.push({
      label: `(${labelMatch[1]})`,
      text: labelMatch[2].trim(),
      children: [],
    });
  }

  if (subdivisions.length === 0 && text.length > 0) {
    subdivisions.push({ label: '(text)', text, children: [] });
  }

  return subdivisions;
}

function deriveTitle(hierarchy: StatuteHierarchy, text: string, code: string, section: string): string {
  if (hierarchy.chapter) {
    const chapterName = hierarchy.chapter.replace(/^CHAPTER\s+[\d.]+\s*/i, '').replace(/\[[^\]]+\]/, '').trim();
    if (chapterName) return chapterName;
  }
  const firstSentence = text.split(/\.\s/)[0]?.trim();
  return firstSentence && firstSentence.length < 120 ? firstSentence : `${code} ${section}`;
}

export function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function normalizeLeginfoHtml(input: NormalizeLeginfoInput): NormalizeLeginfoResult {
  const sectionHtml = extractSingleLawSection(input.html);
  if (!sectionHtml) {
    return {
      ok: false,
      rejection: {
        code: input.code ?? 'UNKNOWN',
        section: input.section ?? 'UNKNOWN',
        reason: 'missing_single_law_section',
        contentHash: contentHash(input.html),
      },
    };
  }

  const code = parseCode(input.html, input.code);
  const section = input.section ? normalizeSectionNumber(input.section) : parseSectionNumber(input.html);

  if (!code || !section) {
    return {
      ok: false,
      rejection: {
        code: code ?? 'UNKNOWN',
        section: section ?? 'UNKNOWN',
        reason: 'missing_code_or_section',
        contentHash: contentHash(input.html),
      },
    };
  }

  const fullText = stripHtmlTags(sectionHtml);
  if (fullText.length < 10) {
    return {
      ok: false,
      rejection: {
        code,
        section,
        reason: 'insufficient_text',
        contentHash: contentHash(fullText),
      },
    };
  }

  const hierarchy = parseHierarchyFromSection(sectionHtml, code);
  const flags = detectFlags(fullText);

  return {
    ok: true,
    normalized: {
      code,
      section,
      title: deriveTitle(hierarchy, fullText, code, section),
      hierarchy,
      fullText,
      subdivisions: parseSubdivisions(sectionHtml),
      effectiveDate: parseEffectiveDate(fullText),
      flags,
      contentHash: contentHash(fullText),
      normalizationVersion: NORMALIZATION_VERSION,
    },
  };
}
