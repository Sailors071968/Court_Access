// ============================================================================
// CourtListener service layer — normalizes raw API responses into a canonical,
// evidence-governed CaseAuthority shape used across Legal Research, Authority
// Search, Citation Analysis, the Attorney Workbench, and the Knowledge Graph.
// Every authority carries its CourtListener source id + absolute URL so any
// downstream conclusion is traceable (Constitution: every conclusion auditable).
// ============================================================================

import { searchRaw, getOpinion, getDocket, citationLookup, isTokenConfigured, baseUrl, type ClResult, type ClSearchParams } from './courtListenerClient.js';

export const COURTLISTENER_SERVICE_VERSION = '1.0.0';
const WEB_BASE = 'https://www.courtlistener.com';

export interface CaseAuthority {
  source: 'courtlistener';
  opinionId: string | null;
  clusterId: string | null;
  docketId: string | null;
  caseName: string;
  citations: string[];
  court: string | null;
  dateFiled: string | null;
  url: string | null;
  snippet: string | null;
  judge: string | null;
}

function abs(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null;
  return url.startsWith('http') ? url : `${WEB_BASE}${url}`;
}

function normalize(r: Record<string, unknown>): CaseAuthority {
  const citations = Array.isArray(r.citation) ? (r.citation as unknown[]).map(String) : [];
  const opinions = Array.isArray(r.opinions) ? (r.opinions as Array<Record<string, unknown>>) : [];
  const snippet =
    (typeof r.snippet === 'string' && r.snippet) ||
    (opinions[0] && typeof opinions[0].snippet === 'string' ? (opinions[0].snippet as string) : null) ||
    null;
  return {
    source: 'courtlistener',
    opinionId: opinions[0]?.id != null ? String(opinions[0].id) : (r.id != null ? String(r.id) : null),
    clusterId: r.cluster_id != null ? String(r.cluster_id) : null,
    docketId: r.docket_id != null ? String(r.docket_id) : null,
    caseName: String(r.caseName ?? r.case_name ?? 'Unknown case'),
    citations,
    court: (r.court as string) ?? (r.court_id as string) ?? null,
    dateFiled: (r.dateFiled as string) ?? (r.date_filed as string) ?? null,
    url: abs(r.absolute_url),
    snippet: snippet ? String(snippet).replace(/<\/?[^>]+>/g, '').slice(0, 400) : null,
    judge: (r.judge as string) ?? null,
  };
}

export interface AuthoritySearchResponse {
  ok: boolean;
  query: string;
  count: number;
  results: CaseAuthority[];
  cached: boolean;
  tookMs: number;
  error: string | null;
  audit: { source: 'CourtListener'; apiBase: string; tokenConfigured: boolean; retrievedAt: string };
}

export async function searchAuthorities(params: ClSearchParams): Promise<AuthoritySearchResponse> {
  const res = await searchRaw(params);
  const rows = res.ok && res.data?.results ? (res.data.results as Array<Record<string, unknown>>) : [];
  return {
    ok: res.ok,
    query: params.q,
    count: res.data?.count ?? rows.length,
    results: rows.map(normalize),
    cached: res.cached,
    tookMs: res.tookMs,
    error: res.error,
    audit: { source: 'CourtListener', apiBase: baseUrl(), tokenConfigured: isTokenConfigured(), retrievedAt: res.retrievedAt },
  };
}

export async function opinionById(id: string): Promise<ClResult<Record<string, unknown>>> {
  return getOpinion(id);
}

export async function docketById(id: string): Promise<ClResult<Record<string, unknown>>> {
  return getDocket(id);
}

export interface CitationAnalysisResponse {
  ok: boolean;
  status: number;
  input: string;
  matches: Array<{ citation: string; status: number; caseName: string | null; url: string | null; clusters: number }>;
  raw: unknown;
  error: string | null;
  requiresToken: boolean;
  audit: { source: 'CourtListener'; retrievedAt: string; tokenConfigured: boolean };
}

/** Citation Analysis — resolve citations found in text to real authorities. */
export async function analyzeCitations(text: string): Promise<CitationAnalysisResponse> {
  const res = await citationLookup(text);
  const arr = Array.isArray(res.data) ? (res.data as Array<Record<string, unknown>>) : [];
  const matches = arr.map((m) => {
    const clusters = Array.isArray(m.clusters) ? (m.clusters as Array<Record<string, unknown>>) : [];
    const first = clusters[0];
    return {
      citation: String(m.citation ?? ''),
      status: Number(m.status ?? 0),
      caseName: first ? String(first.case_name ?? first.caseName ?? '') || null : null,
      url: first ? abs(first.absolute_url) : null,
      clusters: clusters.length,
    };
  });
  return {
    ok: res.ok,
    status: res.status,
    input: text,
    matches,
    raw: res.data,
    error: res.error,
    // CourtListener's citation-lookup requires authentication; without a token
    // it returns 401 — surfaced honestly rather than masked.
    requiresToken: res.status === 401 && !isTokenConfigured(),
    audit: { source: 'CourtListener', retrievedAt: res.retrievedAt, tokenConfigured: isTokenConfigured() },
  };
}

export function integrationStatus() {
  return {
    integrated: true,
    clientVersion: COURTLISTENER_SERVICE_VERSION,
    apiBase: baseUrl(),
    tokenConfigured: isTokenConfigured(),
    capabilities: ['search', 'opinion', 'docket', 'citation-lookup'],
    note: isTokenConfigured()
      ? 'Authenticated CourtListener access (higher rate limits).'
      : 'Unauthenticated CourtListener access (public rate limits). Set COURTLISTENER_API_TOKEN for higher limits.',
  };
}
