// ============================================================================
// Case Law Search — Legal Research panel backed by CourtListener (Free Law).
// Real API results only; honest empty/error/loading states. No fabricated data.
// ============================================================================

import { useState } from 'react';
import { searchCaseLaw, type CaseAuthority } from '../../services/courtListenerApi';

export function CaseLawSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CaseAuthority[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    const res = await searchCaseLaw(q, { pageSize: 15 });
    if (!res.ok) {
      setError(res.error || 'Search failed');
      setResults([]);
      setCount(null);
    } else {
      setResults(res.results);
      setCount(res.count);
    }
    setLoading(false);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Case Law Search</h3>
        <span className="text-xs text-slate-400">Source: CourtListener (Free Law Project)</span>
      </div>
      <form onSubmit={run} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search opinions — e.g. “Fourth Amendment vehicle search”, “Miranda custodial interrogation”"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button type="submit" disabled={loading} className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {searched && !loading && !error && count !== null && (
        <p className="mt-3 text-xs text-slate-500">{count.toLocaleString()} matching opinions · showing {results.length}</p>
      )}
      {searched && !loading && !error && results.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">No opinions matched.</p>
      )}

      <ul className="mt-3 space-y-3">
        {results.map((r) => (
          <li key={r.opinionId ?? r.url ?? r.caseName} className="rounded-md border border-slate-100 p-3">
            <div className="flex items-start justify-between gap-2">
              <a href={r.url ?? '#'} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-800 hover:underline">
                {r.caseName}
              </a>
              {r.dateFiled && <span className="whitespace-nowrap text-xs text-slate-400">{r.dateFiled}</span>}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {r.court}
              {r.citations.length > 0 && <> · {r.citations.join(', ')}</>}
            </div>
            {r.snippet && <p className="mt-1 line-clamp-3 text-xs text-slate-600">{r.snippet}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
