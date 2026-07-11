// ============================================================================
// CourtListener API client (frontend) — canonical connection point for Legal
// Research, Authority Search, Citation Analysis, and any workbench/motion view
// that needs external case law. All calls are authenticated and return real
// API data; callers render honest empty/error states.
// ============================================================================

const API_BASE = '/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('court-access-token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

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

export interface AuthoritySearchResponse {
  ok: boolean;
  query: string;
  count: number;
  results: CaseAuthority[];
  cached: boolean;
  tookMs: number;
  error: string | null;
  audit: { source: string; apiBase: string; tokenConfigured: boolean; retrievedAt: string };
}

export interface CourtListenerStatus {
  integrated: boolean;
  apiBase: string;
  tokenConfigured: boolean;
  capabilities: string[];
  note: string;
}

export async function courtListenerStatus(): Promise<CourtListenerStatus | null> {
  try {
    const res = await fetch(`${API_BASE}/courtlistener/status`, { headers: authHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as CourtListenerStatus;
  } catch {
    return null;
  }
}

export async function searchCaseLaw(query: string, opts: { court?: string; pageSize?: number } = {}): Promise<AuthoritySearchResponse> {
  const params = new URLSearchParams({ q: query, page_size: String(opts.pageSize ?? 10) });
  if (opts.court) params.set('court', opts.court);
  const empty: AuthoritySearchResponse = { ok: false, query, count: 0, results: [], cached: false, tookMs: 0, error: 'request failed', audit: { source: 'CourtListener', apiBase: '', tokenConfigured: false, retrievedAt: '' } };
  try {
    const res = await fetch(`${API_BASE}/courtlistener/search?${params.toString()}`, { headers: authHeaders() });
    const data = await res.json().catch(() => null);
    if (!data) return empty;
    return data as AuthoritySearchResponse;
  } catch {
    return empty;
  }
}

export interface CitationAnalysis {
  ok: boolean;
  status: number;
  input: string;
  matches: Array<{ citation: string; status: number; caseName: string | null; url: string | null; clusters: number }>;
  error: string | null;
  requiresToken: boolean;
}

export async function analyzeCitations(text: string): Promise<CitationAnalysis> {
  const fallback: CitationAnalysis = { ok: false, status: 0, input: text, matches: [], error: 'request failed', requiresToken: false };
  try {
    const res = await fetch(`${API_BASE}/courtlistener/citation-lookup`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ text }) });
    const data = await res.json().catch(() => null);
    return (data as CitationAnalysis) ?? fallback;
  } catch {
    return fallback;
  }
}
