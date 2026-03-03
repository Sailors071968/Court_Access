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
  // Mock implementation — will be replaced with real API
  await new Promise((resolve) => setTimeout(resolve, 400));

  const q = request.query.toLowerCase();

  const cases = caseDataProvider.getCases();
  const primaryCase = cases[0] ?? caseDataProvider.getPrimaryCase();
  const secondaryCase = cases[1] ?? primaryCase;

  const allResults: SearchResult[] = [
    { id: '1', type: 'case', title: primaryCase.title, description: `Case #${primaryCase.caseNumber} — ${primaryCase.jurisdiction}, ${primaryCase.court}`, url: `/cases/${primaryCase.id}/overview` },
    { id: '2', type: 'case', title: secondaryCase.title, description: `Case #${secondaryCase.caseNumber} — ${secondaryCase.jurisdiction}, ${secondaryCase.court}`, url: `/cases/${secondaryCase.id}/overview` },
    { id: '3', type: 'document', title: 'Motion to Suppress Evidence', description: 'Filed Jan 20, 2024 — Defense Motion — 8 pages', url: `/cases/${primaryCase.id}/documents` },
    { id: '4', type: 'document', title: 'Criminal Complaint', description: 'Filed Dec 15, 2023 — Charging Document — 4 pages', url: `/cases/${primaryCase.id}/documents` },
    { id: '5', type: 'document', title: 'Preliminary Hearing Transcript', description: 'Filed Jan 18, 2024 — Transcript — 45 pages', url: `/cases/${primaryCase.id}/documents` },
    { id: '6', type: 'statute', title: 'PC 459 — Burglary', description: 'California Penal Code Section 459 — Every person who enters any building with intent to commit grand or petit larceny...', url: '#' },
    { id: '7', type: 'statute', title: 'PC 1538.5 — Motion to Suppress', description: 'California Penal Code Section 1538.5 — Motion to return property or suppress as evidence...', url: '#' },
    { id: '8', type: 'statute', title: 'H&S 11350(a) — Possession of Controlled Substance', description: 'California Health & Safety Code 11350(a) — Possession of specified controlled substances...', url: '#' },
  ];

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
