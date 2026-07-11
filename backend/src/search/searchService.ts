// ============================================================================
// Program 115 — Unified Case Search (evidence-governed, deterministic)
//
// Searches ONLY real, persisted records the requesting user is authorized to
// see: cases, evidence, OCR/extracted text (evidence chunks), timeline events,
// and case messages. Every result cites its repository source; confidence and
// hashes are surfaced only when the underlying record actually carries them
// (UNKNOWN over fabrication). Ranking is deterministic (score, then recency,
// then id) so identical inputs always produce identical output.
// ============================================================================

import prisma from '../lib/prisma.js';
import type { AuthUser } from '../membership/resourceAuthMiddleware.js';
import { buildAuthorizedCaseFilter, requireCaseAccess } from '../membership/resourceAuthMiddleware.js';

export type SearchResultType = 'case' | 'evidence' | 'ocr_text' | 'timeline_event' | 'message';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  snippet: string;
  url: string;
  caseId: string;
  confidence?: number; // 0–100, only when the record carries a real score
  repositorySource: string;
  humanReviewStatus?: 'none' | 'pending' | 'reviewed';
  auditAvailable?: boolean;
  contentHash?: string;
  score: number;
  updatedAt: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  scannedCaseCount: number;
  tookMs: number;
  types: SearchResultType[];
}

const DEFAULT_TYPES: SearchResultType[] = ['case', 'evidence', 'ocr_text', 'timeline_event', 'message'];
const PER_TYPE_CANDIDATE_LIMIT = 60;

function tokenize(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9.]+/i)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  );
}

/**
 * Deterministic relevance score for a candidate. Weighted so that a primary
 * field (title/name) full-phrase hit ranks above scattered term hits.
 */
function scoreFields(query: string, terms: string[], fields: Array<{ text: string | null | undefined; weight: number }>): number {
  const phrase = query.trim().toLowerCase();
  let score = 0;
  for (const { text, weight } of fields) {
    if (!text) continue;
    const hay = text.toLowerCase();
    if (phrase.length >= 2 && hay.includes(phrase)) score += 10 * weight;
    for (const term of terms) {
      if (hay.includes(term)) score += 2 * weight;
    }
  }
  return score;
}

function snippet(text: string | null | undefined, terms: string[], max = 180): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  const lower = clean.toLowerCase();
  let idx = -1;
  for (const term of terms) {
    const at = lower.indexOf(term);
    if (at >= 0 && (idx === -1 || at < idx)) idx = at;
  }
  if (idx === -1) return clean.slice(0, max) + (clean.length > max ? '…' : '');
  const start = Math.max(0, idx - 40);
  const end = Math.min(clean.length, start + max);
  return (start > 0 ? '…' : '') + clean.slice(start, end) + (end < clean.length ? '…' : '');
}

/** Case-insensitive OR-contains clause across the given string fields. */
function containsAny(fields: string[], phrase: string): Array<Record<string, unknown>> {
  return fields.map((f) => ({ [f]: { contains: phrase, mode: 'insensitive' } }));
}

/**
 * Resolve the set of case IDs the user may search. When a single caseId is
 * supplied it is authorized directly; otherwise the tenant-wide authorized
 * filter (including defendant-portal scoping) is applied.
 */
async function resolveAccessibleCaseIds(user: AuthUser, caseId?: string): Promise<string[]> {
  if (caseId) {
    const ok = await requireCaseAccess(user, caseId, 'view');
    return ok ? [caseId] : [];
  }
  const filter = await buildAuthorizedCaseFilter(user);
  const cases = await prisma.criminalCase.findMany({ where: filter, select: { caseId: true } });
  return cases.map((c) => c.caseId);
}

export interface SearchOptions {
  types?: SearchResultType[];
  caseId?: string;
  limit?: number;
}

export async function searchCaseData(user: AuthUser, query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  const start = Date.now();
  const phrase = query.trim();
  const terms = tokenize(phrase);
  const types = (options.types?.length ? options.types : DEFAULT_TYPES).filter((t) => DEFAULT_TYPES.includes(t));
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  if (!phrase || terms.length === 0) {
    return { query, results: [], total: 0, scannedCaseCount: 0, tookMs: Date.now() - start, types };
  }

  const caseIds = await resolveAccessibleCaseIds(user, options.caseId);
  if (caseIds.length === 0) {
    return { query, results: [], total: 0, scannedCaseCount: 0, tookMs: Date.now() - start, types };
  }
  const caseFilter = { in: caseIds };
  const results: SearchResult[] = [];

  // ── Cases ────────────────────────────────────────────────────────────────
  if (types.includes('case')) {
    const rows = await prisma.criminalCase.findMany({
      where: {
        tenantId: user.tenantId,
        caseId: caseFilter,
        deletedAt: null,
        OR: containsAny(['title', 'caseNumber', 'court', 'judge', 'jurisdiction'], phrase),
      },
      take: PER_TYPE_CANDIDATE_LIMIT,
      orderBy: { updatedAt: 'desc' },
    });
    for (const c of rows) {
      const score = scoreFields(phrase, terms, [
        { text: c.title, weight: 3 },
        { text: c.caseNumber, weight: 3 },
        { text: c.court, weight: 1 },
        { text: c.judge, weight: 1 },
        { text: c.jurisdiction, weight: 1 },
      ]);
      if (score <= 0) continue;
      results.push({
        id: c.caseId,
        type: 'case',
        title: `${c.title} (${c.caseNumber})`,
        snippet: [c.jurisdiction, c.court, c.status].filter(Boolean).join(' · '),
        url: `/cases/${c.caseId}`,
        caseId: c.caseId,
        repositorySource: 'Case Repository',
        humanReviewStatus: 'none',
        auditAvailable: true,
        score,
        updatedAt: c.updatedAt.toISOString(),
      });
    }
  }

  // ── Evidence (metadata) ────────────────────────────────────────────────────
  if (types.includes('evidence')) {
    const rows = await prisma.evidence.findMany({
      where: {
        tenantId: user.tenantId,
        caseId: caseFilter,
        OR: containsAny(['fileName', 'evidenceType'], phrase),
      },
      take: PER_TYPE_CANDIDATE_LIMIT,
      orderBy: { updatedAt: 'desc' },
    });
    for (const e of rows) {
      const score = scoreFields(phrase, terms, [
        { text: e.fileName, weight: 3 },
        { text: e.evidenceType, weight: 2 },
      ]);
      if (score <= 0) continue;
      results.push({
        id: e.evidenceId,
        type: 'evidence',
        title: e.fileName,
        snippet: `${e.evidenceType} · ${e.processingStatus}`,
        url: `/cases/${e.caseId}/evidence`,
        caseId: e.caseId,
        repositorySource: 'Evidence Repository',
        humanReviewStatus: e.processingStatus === 'failed' ? 'pending' : 'none',
        auditAvailable: true,
        score,
        updatedAt: e.updatedAt.toISOString(),
      });
    }
  }

  // ── OCR / extracted text (evidence chunks) ─────────────────────────────────
  if (types.includes('ocr_text')) {
    const chunks = await prisma.evidenceChunk.findMany({
      where: {
        tenantId: user.tenantId,
        text: { contains: phrase, mode: 'insensitive' },
      },
      take: PER_TYPE_CANDIDATE_LIMIT * 2,
      orderBy: { createdAt: 'desc' },
    });
    // Only chunks whose parent evidence is in an accessible case.
    const evidenceIds = Array.from(new Set(chunks.map((c) => c.evidenceId)));
    const parents = evidenceIds.length
      ? await prisma.evidence.findMany({
          where: { evidenceId: { in: evidenceIds }, tenantId: user.tenantId, caseId: caseFilter },
          select: { evidenceId: true, caseId: true, fileName: true },
        })
      : [];
    const parentById = new Map(parents.map((p) => [p.evidenceId, p]));
    for (const chunk of chunks) {
      const parent = parentById.get(chunk.evidenceId);
      if (!parent) continue;
      const score = scoreFields(phrase, terms, [{ text: chunk.text, weight: 2 }]);
      if (score <= 0) continue;
      results.push({
        id: chunk.id,
        type: 'ocr_text',
        title: `${parent.fileName} — extracted text`,
        snippet: snippet(chunk.text, terms),
        url: `/cases/${parent.caseId}/evidence`,
        caseId: parent.caseId,
        repositorySource: 'OCR / Extracted Text Index',
        humanReviewStatus: 'none',
        auditAvailable: true,
        contentHash: chunk.checksum,
        score,
        updatedAt: chunk.createdAt.toISOString(),
      });
    }
  }

  // ── Timeline events ────────────────────────────────────────────────────────
  if (types.includes('timeline_event')) {
    const rows = await prisma.timelineEvent.findMany({
      where: {
        caseId: caseFilter,
        OR: containsAny(['description', 'actor', 'action', 'target', 'location'], phrase),
      },
      take: PER_TYPE_CANDIDATE_LIMIT,
      orderBy: { updatedAt: 'desc' },
    });
    for (const t of rows) {
      const score = scoreFields(phrase, terms, [
        { text: t.description, weight: 3 },
        { text: t.actor, weight: 2 },
        { text: t.action, weight: 2 },
        { text: t.target, weight: 1 },
        { text: t.location, weight: 1 },
      ]);
      if (score <= 0) continue;
      results.push({
        id: t.id,
        type: 'timeline_event',
        title: t.description.slice(0, 90),
        snippet: [t.timeText, t.actor, t.action, t.location].filter(Boolean).join(' · ') || snippet(t.description, terms),
        url: `/cases/${t.caseId}/activity`,
        caseId: t.caseId,
        // Real confidence only — never fabricated.
        confidence: typeof t.confidence === 'number' ? Math.round(t.confidence * 100) : undefined,
        repositorySource: 'Case Timeline',
        humanReviewStatus: t.conflictFlag ? 'pending' : 'none',
        auditAvailable: true,
        score,
        updatedAt: t.updatedAt.toISOString(),
      });
    }
  }

  // ── Case messages ──────────────────────────────────────────────────────────
  if (types.includes('message')) {
    const rows = await prisma.caseMessage.findMany({
      where: {
        tenantId: user.tenantId,
        caseId: caseFilter,
        body: { contains: phrase, mode: 'insensitive' },
      },
      take: PER_TYPE_CANDIDATE_LIMIT,
      orderBy: { createdAt: 'desc' },
    });
    for (const m of rows) {
      const score = scoreFields(phrase, terms, [{ text: m.body, weight: 2 }]);
      if (score <= 0) continue;
      results.push({
        id: m.messageId,
        type: 'message',
        title: 'Case message',
        snippet: snippet(m.body, terms),
        url: `/cases/${m.caseId}/messages`,
        caseId: m.caseId,
        repositorySource: 'Case Messages',
        humanReviewStatus: 'none',
        auditAvailable: true,
        score,
        updatedAt: m.createdAt.toISOString(),
      });
    }
  }

  // Deterministic ordering: score desc, then recency desc, then id asc.
  results.sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));

  return {
    query,
    results: results.slice(0, limit),
    total: results.length,
    scannedCaseCount: caseIds.length,
    tookMs: Date.now() - start,
    types,
  };
}
