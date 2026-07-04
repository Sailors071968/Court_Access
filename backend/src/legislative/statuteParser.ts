// ============================================================================
// Stage 3 — Leginfo HTML statute parser
// Produces canonical StatuteRecord objects with rejection queue support
// ============================================================================

import { createHash } from 'node:crypto';
import type { StatuteHierarchy } from './types.ts';
import type { AuditMetadata, ParseRejection, StatuteRecord, StatuteSubdivision } from './knowledgeGraph/types.ts';
import { buildSectionUrl, normalizeSectionNumber } from './leginfoUrls.ts';

export const PARSER_VERSION = '1.0.0';

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

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractSingleLawSection(html: string): string | null {
  const match = html.match(/id="single_law_section"[^>]*>([\s\S]*?)(?:<\/div>\s*<\/div>\s*<\/form>|$)/i);
  if (match) return match[1];
  const alt = html.match(/id="codeLawSectionNoHead"[^>]*>([\s\S]*)/i);
  return alt ? alt[1] : null;
}

function parseHierarchyFromSection(html: string, code: string): StatuteHierarchy {
  const hierarchy: StatuteHierarchy = { code: code.toUpperCase() };

  const patterns: Array<{ key: keyof StatuteHierarchy; regex: RegExp }> = [
    { key: 'division', regex: /DIVISION\s+[\d.]+\s*[^<\[]*/i },
    { key: 'part', regex: /PART\s+[\d.]+\s*[^<\[]*/i },
    { key: 'title', regex: /TITLE\s+[\d.]+\s*[^<\[]*/i },
    { key: 'chapter', regex: /CHAPTER\s+[\d.]+\s*[^<\[]*/i },
    { key: 'article', regex: /ARTICLE\s+[\d.]+\s*[^<\[]*/i },
  ];

  for (const { key, regex } of patterns) {
    const m = html.match(regex);
    if (m) hierarchy[key] = stripTags(m[0]);
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
  const text = stripTags(sectionHtml);
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

export function statuteId(code: string, section: string): string {
  return createHash('sha256').update(`${code.toUpperCase()}:${normalizeSectionNumber(section)}`).digest('hex').slice(0, 32);
}

export function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export interface ParseStatuteInput {
  html: string;
  sourceUrl: string;
  retrievedAt: string;
  code?: string;
  section?: string;
}

export type ParseStatuteResult =
  | { ok: true; record: StatuteRecord }
  | { ok: false; rejection: ParseRejection };

export function parseLeginfoStatuteHtml(input: ParseStatuteInput): ParseStatuteResult {
  const sectionHtml = extractSingleLawSection(input.html);
  if (!sectionHtml) {
    return {
      ok: false,
      rejection: {
        code: input.code ?? 'UNKNOWN',
        section: input.section ?? 'UNKNOWN',
        sourceUrl: input.sourceUrl,
        reason: 'missing_single_law_section',
        retrievedAt: input.retrievedAt,
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
        sourceUrl: input.sourceUrl,
        reason: 'missing_code_or_section',
        retrievedAt: input.retrievedAt,
        contentHash: contentHash(input.html),
      },
    };
  }

  const fullText = stripTags(sectionHtml);
  if (fullText.length < 10) {
    return {
      ok: false,
      rejection: {
        code,
        section,
        sourceUrl: input.sourceUrl,
        reason: 'insufficient_text',
        retrievedAt: input.retrievedAt,
        contentHash: contentHash(fullText),
      },
    };
  }

  const hierarchy = parseHierarchyFromSection(sectionHtml, code);
  const flags = detectFlags(fullText);
  const hash = contentHash(fullText);
  const id = statuteId(code, section);

  const audit: AuditMetadata = {
    extractedAt: new Date().toISOString(),
    extractorVersion: PARSER_VERSION,
    sourceStatuteId: id,
    sourceUrl: input.sourceUrl,
    contentHash: hash,
    parseStatus: flags.length > 0 ? 'partial' : 'success',
  };

  const record: StatuteRecord = {
    id,
    code,
    section,
    title: deriveTitle(hierarchy, fullText, code, section),
    hierarchy,
    fullText,
    subdivisions: parseSubdivisions(sectionHtml),
    sourceUrl: input.sourceUrl || buildSectionUrl(code, section),
    retrievedAt: input.retrievedAt,
    contentHash: hash,
    effectiveDate: parseEffectiveDate(fullText),
    flags,
    audit,
  };

  return { ok: true, record };
}
