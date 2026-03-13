// ============================================
// Court Access — Search Service
// ============================================

import type { SearchResult } from '../types';
import { caseDataProvider } from './caseDataProvider';

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

  // Fetch real case data from API
  const cases = await caseDataProvider.getCases();
  const primaryCase = cases[0] ?? null;
  const secondaryCase = cases[1] ?? primaryCase;

  const allResults: SearchResult[] = [];

  // Add case results if we have real data
  if (primaryCase) {
    allResults.push({
      id: '1', type: 'case', title: primaryCase.title,
      description: `Case #${primaryCase.caseNumber} — ${primaryCase.jurisdiction}, ${primaryCase.court}`,
      url: `/cases/${primaryCase.id}/overview`,
    });
  }
  if (secondaryCase && secondaryCase !== primaryCase) {
    allResults.push({
      id: '2', type: 'case', title: secondaryCase.title,
      description: `Case #${secondaryCase.caseNumber} — ${secondaryCase.jurisdiction}, ${secondaryCase.court}`,
      url: `/cases/${secondaryCase.id}/overview`,
    });
  }

  // Statute results (static legal references)
  allResults.push(
    { id: '6', type: 'statute', title: 'PC 459 — Burglary', description: 'California Penal Code Section 459 — Every person who enters any building with intent to commit grand or petit larceny...', url: '#' },
    { id: '7', type: 'statute', title: 'PC 1538.5 — Motion to Suppress', description: 'California Penal Code Section 1538.5 — Motion to return property or suppress as evidence...', url: '#' },
    { id: '8', type: 'statute', title: 'H&S 11350(a) — Possession of Controlled Substance', description: 'California Health & Safety Code 11350(a) — Possession of specified controlled substances...', url: '#' },
  );

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
