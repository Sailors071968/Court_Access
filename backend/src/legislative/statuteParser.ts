// ============================================================================
// Stage 3b — Leginfo HTML statute parser
// Builds canonical StatuteRecord from normalized statutory content
// ============================================================================

import { createHash } from 'node:crypto';
import type { AuditMetadata, ParseRejection, StatuteRecord } from './knowledgeGraph/types.ts';
import { buildSectionUrl, normalizeSectionNumber } from './leginfoUrls.ts';
import { normalizeLeginfoHtml, contentHash, NORMALIZATION_VERSION } from './normalization.ts';

export const PARSER_VERSION = '1.0.0';

export function statuteId(code: string, section: string): string {
  return createHash('sha256')
    .update(`${code.toUpperCase()}:${normalizeSectionNumber(section)}`)
    .digest('hex')
    .slice(0, 32);
}

export { contentHash };

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
  const normResult = normalizeLeginfoHtml({
    html: input.html,
    code: input.code,
    section: input.section,
  });

  if (!normResult.ok) {
    return {
      ok: false,
      rejection: {
        code: normResult.rejection.code,
        section: normResult.rejection.section,
        sourceUrl: input.sourceUrl,
        reason: normResult.rejection.reason,
        retrievedAt: input.retrievedAt,
        contentHash: normResult.rejection.contentHash,
      },
    };
  }

  const { normalized } = normResult;
  const id = statuteId(normalized.code, normalized.section);

  const audit: AuditMetadata = {
    extractedAt: new Date().toISOString(),
    extractorVersion: PARSER_VERSION,
    sourceStatuteId: id,
    sourceUrl: input.sourceUrl,
    contentHash: normalized.contentHash,
    parseStatus: normalized.flags.length > 0 ? 'partial' : 'success',
  };

  const record: StatuteRecord = {
    id,
    code: normalized.code,
    section: normalized.section,
    title: normalized.title,
    hierarchy: normalized.hierarchy,
    fullText: normalized.fullText,
    subdivisions: normalized.subdivisions,
    sourceUrl: input.sourceUrl || buildSectionUrl(normalized.code, normalized.section),
    retrievedAt: input.retrievedAt,
    contentHash: normalized.contentHash,
    effectiveDate: normalized.effectiveDate,
    flags: normalized.flags,
    audit,
  };

  return { ok: true, record };
}

export { NORMALIZATION_VERSION };
