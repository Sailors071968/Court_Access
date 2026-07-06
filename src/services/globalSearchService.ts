// =============================================================================
// CourtAccess — Global Legal Intelligence Search service (Program 25)
// Single search implementation for the entire platform. Wraps the existing
// searchService for live case data and enriches every result with the
// intelligence metadata the UI requires (confidence, evidence/citation counts,
// repository source, human-review status, audit availability).
// =============================================================================

import { search as legacySearch } from './searchService';
import type { IconName } from '../components/icons/registry';

export type GlobalSearchType =
  | 'case'
  | 'evidence'
  | 'witness'
  | 'document'
  | 'charge'
  | 'statute'
  | 'california_code'
  | 'federal_code'
  | 'case_law'
  | 'authority'
  | 'timeline_event'
  | 'person'
  | 'address'
  | 'phone'
  | 'vehicle'
  | 'license_plate'
  | 'evidence_id'
  | 'repository_id'
  | 'graph_node'
  | 'ocr_text'
  | 'note'
  | 'message'
  | 'report'
  | 'audit_event';

export type SearchMode = 'natural' | 'boolean' | 'citation' | 'fuzzy' | 'semantic';

export type HumanReviewStatus = 'none' | 'pending' | 'reviewed';

export interface GlobalSearchResult {
  id: string;
  type: GlobalSearchType;
  title: string;
  snippet: string;
  url: string;
  confidence?: number; // 0–100
  evidenceCount?: number;
  citationCount?: number;
  repositorySource?: string;
  humanReviewStatus?: HumanReviewStatus;
  auditAvailable?: boolean;
}

export interface GlobalSearchResponse {
  query: string;
  mode: SearchMode;
  results: GlobalSearchResult[];
  total: number;
  tookMs: number;
}

/** Display metadata for each result type (label + canonical icon). */
export const TYPE_META: Record<GlobalSearchType, { label: string; icon: IconName; group: string }> = {
  case: { label: 'Case', icon: 'attorney', group: 'Cases' },
  evidence: { label: 'Evidence', icon: 'evidence', group: 'Evidence' },
  witness: { label: 'Witness', icon: 'witness', group: 'People' },
  document: { label: 'Document', icon: 'documents', group: 'Evidence' },
  charge: { label: 'Charge', icon: 'statutes', group: 'Legal' },
  statute: { label: 'Statute', icon: 'statutes', group: 'Legal' },
  california_code: { label: 'California Code', icon: 'statutes', group: 'Legal' },
  federal_code: { label: 'Federal Code', icon: 'statutes', group: 'Legal' },
  case_law: { label: 'Case Law', icon: 'caseLaw', group: 'Legal' },
  authority: { label: 'Authority', icon: 'authorities', group: 'Legal' },
  timeline_event: { label: 'Timeline Event', icon: 'timeline', group: 'Timeline' },
  person: { label: 'Person', icon: 'defendant', group: 'People' },
  address: { label: 'Address', icon: 'court', group: 'People' },
  phone: { label: 'Phone', icon: 'messages', group: 'People' },
  vehicle: { label: 'Vehicle', icon: 'search', group: 'People' },
  license_plate: { label: 'License Plate', icon: 'search', group: 'People' },
  evidence_id: { label: 'Evidence ID', icon: 'evidence', group: 'Identifiers' },
  repository_id: { label: 'Repository ID', icon: 'repositoryIntegrity', group: 'Identifiers' },
  graph_node: { label: 'Graph Node', icon: 'knowledgeGraph', group: 'Knowledge Graph' },
  ocr_text: { label: 'OCR Text', icon: 'ocr', group: 'Evidence' },
  note: { label: 'Attorney Note', icon: 'documents', group: 'Notes' },
  message: { label: 'Message', icon: 'messages', group: 'Messages' },
  report: { label: 'Report', icon: 'reports', group: 'Reports' },
  audit_event: { label: 'Audit Event', icon: 'audit', group: 'Audit' },
};

export const SEARCH_MODES: { id: SearchMode; label: string; hint: string }[] = [
  { id: 'natural', label: 'Natural', hint: 'Plain language — “burglary defenses in People v. Smith”' },
  { id: 'boolean', label: 'Boolean', hint: 'AND / OR / NOT — “motion AND suppress NOT dismissed”' },
  { id: 'citation', label: 'Citation', hint: 'Cite lookups — “PC 459”, “1538.5”, “Miranda”' },
  { id: 'fuzzy', label: 'Fuzzy', hint: 'Typo-tolerant approximate matching' },
  { id: 'semantic', label: 'Semantic', hint: 'Meaning-based vector search' },
];

// ── Saved / recent / pinned (localStorage-backed) ───────────────────────────
const RECENT_KEY = 'courtaccess_recent_searches';
const SAVED_KEY = 'courtaccess_saved_searches';
const PINNED_KEY = 'courtaccess_pinned_searches';

function read(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}
function write(key: string, values: string[]) {
  localStorage.setItem(key, JSON.stringify(values.slice(0, 20)));
}

export const recentSearches = {
  list: () => read(RECENT_KEY),
  add: (q: string) => {
    if (!q.trim()) return;
    const next = [q, ...read(RECENT_KEY).filter((x) => x !== q)];
    write(RECENT_KEY, next);
  },
  clear: () => write(RECENT_KEY, []),
};

export const savedSearches = {
  list: () => read(SAVED_KEY),
  toggle: (q: string) => {
    const cur = read(SAVED_KEY);
    write(SAVED_KEY, cur.includes(q) ? cur.filter((x) => x !== q) : [q, ...cur]);
  },
  has: (q: string) => read(SAVED_KEY).includes(q),
};

export const pinnedSearches = {
  list: () => read(PINNED_KEY),
  toggle: (q: string) => {
    const cur = read(PINNED_KEY);
    write(PINNED_KEY, cur.includes(q) ? cur.filter((x) => x !== q) : [q, ...cur]);
  },
  has: (q: string) => read(PINNED_KEY).includes(q),
};

// ── Representative intelligence corpus (enriched with metadata) ──────────────
// Live cases come from the API via legacySearch; these enrich the other domains
// so the unified search surface is demonstrable end-to-end.
const CORPUS: GlobalSearchResult[] = [
  { id: 'ev-1', type: 'evidence', title: 'Body-camera footage — Officer Reyes', snippet: 'Metadata timestamp conflicts with dispatch log', url: '/search?q=body-camera', confidence: 88, evidenceCount: 1, citationCount: 3, repositorySource: 'Case Repository', humanReviewStatus: 'pending', auditAvailable: true },
  { id: 'wit-1', type: 'witness', title: 'Maria Alvarez', snippet: 'Eyewitness — statement recorded, interview pending', url: '/search?q=alvarez', confidence: 72, citationCount: 2, repositorySource: 'Witness Registry', humanReviewStatus: 'none', auditAvailable: true },
  { id: 'chg-1', type: 'charge', title: 'PC 459 — Burglary (Count 1)', snippet: 'Elements: entry + intent to commit larceny/felony', url: '/search?q=459', confidence: 95, citationCount: 5, repositorySource: 'Charge Analysis', humanReviewStatus: 'reviewed', auditAvailable: true },
  { id: 'stat-1', type: 'statute', title: 'PC 1538.5 — Motion to Suppress', snippet: 'Return of property or suppression of evidence', url: '/search?q=1538.5', confidence: 99, citationCount: 12, repositorySource: 'California Codes', humanReviewStatus: 'reviewed', auditAvailable: true },
  { id: 'cacode-1', type: 'california_code', title: 'H&S 11350(a) — Possession', snippet: 'Possession of specified controlled substances', url: '/search?q=11350', confidence: 97, citationCount: 8, repositorySource: 'California Codes', humanReviewStatus: 'reviewed', auditAvailable: true },
  { id: 'fed-1', type: 'federal_code', title: '18 U.S.C. § 924(c)', snippet: 'Use of firearm in furtherance of a crime', url: '/search?q=924', confidence: 90, citationCount: 4, repositorySource: 'Federal Codes', humanReviewStatus: 'none', auditAvailable: true },
  { id: 'law-1', type: 'case_law', title: 'Miranda v. Arizona (1966)', snippet: 'Custodial interrogation warnings requirement', url: '/search?q=miranda', confidence: 99, citationCount: 21, repositorySource: 'Case Law', humanReviewStatus: 'reviewed', auditAvailable: true },
  { id: 'auth-1', type: 'authority', title: 'CALCRIM 1700 — Burglary', snippet: 'Jury instruction mapped to PC 459 elements', url: '/search?q=calcrim+1700', confidence: 96, citationCount: 6, repositorySource: 'Authorities', humanReviewStatus: 'reviewed', auditAvailable: true },
  { id: 'tl-1', type: 'timeline_event', title: 'Arrest — Jan 3, 2026 21:40', snippet: 'Time conflicts with body-cam metadata', url: '/search?q=arrest', confidence: 65, evidenceCount: 2, repositorySource: 'Case Timeline', humanReviewStatus: 'pending', auditAvailable: true },
  { id: 'node-1', type: 'graph_node', title: 'Vehicle → Defendant relationship', snippet: 'Ownership edge derived from DMV record', url: '/search?q=vehicle', confidence: 70, citationCount: 1, repositorySource: 'Knowledge Graph', humanReviewStatus: 'none', auditAvailable: true },
  { id: 'plate-1', type: 'license_plate', title: '7ABC123', snippet: 'Registered to defendant; seen in surveillance', url: '/search?q=7ABC123', confidence: 80, evidenceCount: 1, repositorySource: 'Knowledge Graph', humanReviewStatus: 'none', auditAvailable: true },
  { id: 'ocr-1', type: 'ocr_text', title: 'Police report p.4 — OCR excerpt', snippet: '“…suspect fled northbound on foot…”', url: '/search?q=fled', confidence: 84, repositorySource: 'OCR Index', humanReviewStatus: 'pending', auditAvailable: true },
  { id: 'note-1', type: 'note', title: 'Attorney note — suppression theory', snippet: 'Fourth Amendment argument; see PC 1538.5', url: '/search?q=suppression', repositorySource: 'Attorney Notes', humanReviewStatus: 'none', auditAvailable: false },
  { id: 'rep-1', type: 'report', title: 'Attorney Report — People v. Smith', snippet: 'Full case intelligence, citation-backed', url: '/search?q=report', citationCount: 34, repositorySource: 'Reports', humanReviewStatus: 'reviewed', auditAvailable: true },
  { id: 'aud-1', type: 'audit_event', title: 'Evidence access — user #4821', snippet: 'Viewed body-cam footage, 2026-01-05 14:22', url: '/search?q=audit', repositorySource: 'Audit Log', auditAvailable: true },
];

function highlight(text: string): string {
  return text; // snippet already concise; UI highlights matched query separately
}

// Types served by the real, evidence-governed backend search API (Program 115).
const BACKEND_TYPES: GlobalSearchType[] = ['case', 'evidence', 'ocr_text', 'timeline_event', 'message'];

interface BackendSearchResult {
  id: string;
  type: GlobalSearchType;
  title: string;
  snippet: string;
  url: string;
  caseId: string;
  confidence?: number;
  repositorySource?: string;
  humanReviewStatus?: HumanReviewStatus;
  auditAvailable?: boolean;
  contentHash?: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('court-access-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Query the real backend search API for the types it can serve. */
async function backendSearch(query: string, types: GlobalSearchType[]): Promise<GlobalSearchResult[]> {
  const requested = types.length ? types.filter((t) => BACKEND_TYPES.includes(t)) : BACKEND_TYPES;
  if (requested.length === 0) return [];
  const params = new URLSearchParams({ q: query, types: requested.join(','), limit: '50' });
  try {
    const res = await fetch(`/api/search?${params.toString()}`, { headers: authHeaders() });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: BackendSearchResult[] };
    return (data.results ?? []).map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      snippet: highlight(r.snippet),
      url: r.url,
      confidence: r.confidence,
      repositorySource: r.repositorySource,
      humanReviewStatus: r.humanReviewStatus,
      auditAvailable: r.auditAvailable,
    }));
  } catch {
    return [];
  }
}

/** The single global search entry point used by the palette and search page. */
export async function globalSearch(
  query: string,
  options: { types?: GlobalSearchType[]; mode?: SearchMode } = {},
): Promise<GlobalSearchResponse> {
  const start = performance.now();
  const q = query.trim().toLowerCase();
  const mode = options.mode ?? 'natural';
  const types = options.types ?? [];

  // Real, evidence-governed results from the backend search API. Cases,
  // evidence, OCR text, timeline events, and messages are served here.
  let backendResults = await backendSearch(query, types);
  if (backendResults.length === 0) {
    // Fallback: at least surface live cases if the search API is unavailable.
    try {
      const legacy = await legacySearch({ query, type: 'case' });
      backendResults = legacy.results.map((r) => ({
        id: r.id,
        type: 'case' as GlobalSearchType,
        title: r.title,
        snippet: highlight(r.description),
        url: r.url,
        repositorySource: 'Case Repository',
        humanReviewStatus: 'none' as HumanReviewStatus,
        auditAvailable: true,
      }));
      if (types.length) backendResults = backendResults.filter((r) => types.includes(r.type));
    } catch {
      backendResults = [];
    }
  }

  let pool = [...backendResults];
  // Representative corpus for domains not yet backed by a real index (statutes,
  // case law, graph nodes, etc.) is DEV-only; production never shows fabricated
  // results. Skip any type the backend already served to avoid duplicates.
  if (import.meta.env.DEV) {
    const backendServed = new Set(BACKEND_TYPES);
    pool = [...pool, ...CORPUS.filter((r) => !backendServed.has(r.type))];
  }

  if (types.length > 0) {
    pool = pool.filter((r) => types.includes(r.type));
  }

  // Backend results are already query-matched + ranked; only the DEV corpus
  // needs client-side filtering.
  const backendIds = new Set(backendResults.map((r) => r.id));
  const matches = q
    ? pool.filter(
        (r) =>
          backendIds.has(r.id) ||
          r.title.toLowerCase().includes(q) ||
          r.snippet.toLowerCase().includes(q) ||
          TYPE_META[r.type].label.toLowerCase().includes(q),
      )
    : pool;

  return {
    query,
    mode,
    results: matches,
    total: matches.length,
    tookMs: Math.round(performance.now() - start),
  };
}
