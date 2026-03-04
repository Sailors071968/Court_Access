// ============================================
// Court Access — Search Service
// ============================================

import type { SearchResult } from '../types';
import apiClient from './apiClient';

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

  // Search cases and documents from real API
  const results: SearchResult[] = [];

  try {
    const casesRes = await apiClient.get('/cases');
    const cases = casesRes.data || [];
    for (const c of cases) {
      if (c.title.toLowerCase().includes(q) || (c.caseNumber || '').toLowerCase().includes(q)) {
        results.push({
          id: c.id,
          type: 'case',
          title: c.title,
          description: `Case #${c.caseNumber || 'N/A'} — ${c.status}`,
          url: `/cases/${c.id}/overview`,
        });
      }
    }
  } catch {
    // Cases endpoint unavailable
  }

  const typeFiltered =
    request.type && request.type !== 'all'
      ? results.filter((r) => r.type === request.type)
      : results;

  return {
    results: typeFiltered,
    total: typeFiltered.length,
    query: request.query,
  };
}
