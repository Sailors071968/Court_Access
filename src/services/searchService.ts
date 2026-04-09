// ============================================
// Court Access — Search Service
// ============================================

import type { SearchResult } from '../types';
import { fetchCases } from './caseApi';

export interface SearchRequest {
  query: string;
  type?: 'case' | 'document' | 'statute' | 'all';
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

export async function search(request: SearchRequest): Promise<SearchResponse> {
  const q = request.query.toLowerCase();

  // Fetch real cases from the API
  let cases: Array<{ caseId: string; title?: string; caseType?: string; status?: string }> = [];
  try {
    cases = await fetchCases();
  } catch {
    cases = [];
  }

  const caseResults: SearchResult[] = cases.map((c, idx) => ({
    id: String(idx + 1),
    type: 'case' as const,
    title: c.title || c.caseType || 'Untitled Case',
    description: `Case #${c.caseId} — ${c.status || 'Active'}`,
    url: `/cases/${c.caseId}/overview`,
  }));

  // Static statute results (these don't come from API)
  const statuteResults: SearchResult[] = [
    { id: 's1', type: 'statute', title: 'PC 459 — Burglary', description: 'California Penal Code Section 459 — Every person who enters any building with intent to commit grand or petit larceny...', url: '#' },
    { id: 's2', type: 'statute', title: 'PC 1538.5 — Motion to Suppress', description: 'California Penal Code Section 1538.5 — Motion to return property or suppress as evidence...', url: '#' },
    { id: 's3', type: 'statute', title: 'H&S 11350(a) — Possession of Controlled Substance', description: 'California Health & Safety Code 11350(a) — Possession of specified controlled substances...', url: '#' },
  ];

  const allResults: SearchResult[] = [...caseResults, ...statuteResults];

  const filtered = q
    ? allResults.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      )
    : allResults;

  const typeFiltered =
    request.type && request.type !== 'all'
      ? filtered.filter((r) => r.type === request.type)
      : filtered;

  return {
    results: typeFiltered,
    total: typeFiltered.length,
    query: request.query,
  };
}
