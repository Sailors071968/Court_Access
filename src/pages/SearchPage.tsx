// ============================================
// Court Access — Global Search Page
// ============================================

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, FileText, Briefcase, BookOpen } from 'lucide-react';
import { Card } from '../components/common/Card';
import { search as searchService } from '../services/searchService';
import type { SearchResult } from '../types';

const TYPE_FILTERS = [
  { id: 'all', label: 'All', icon: null },
  { id: 'case', label: 'Cases', icon: Briefcase },
  { id: 'document', label: 'Documents', icon: FileText },
  { id: 'statute', label: 'Statutes', icon: BookOpen },
] as const;

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryParam = searchParams.get('q') || '';
  const typeParam = (searchParams.get('type') || 'all') as 'all' | 'case' | 'document' | 'statute';

  const [query, setQuery] = useState(queryParam);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (queryParam) {
      setLoading(true);
      searchService({ query: queryParam, type: typeParam === 'all' ? undefined : typeParam }).then((res) => {
        setResults(res.results);
        setTotal(res.total);
        setLoading(false);
      });
    }
  }, [queryParam, typeParam]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim(), type: typeParam });
    }
  };

  const handleTypeFilter = (type: string) => {
    setSearchParams({ q: queryParam, type });
  };

  const resultIcon = (type: string) => {
    switch (type) {
      case 'case': return <Briefcase size={16} className="text-blue-600" />;
      case 'document': return <FileText size={16} className="text-amber-600" />;
      case 'statute': return <BookOpen size={16} className="text-purple-600" />;
      default: return <FileText size={16} className="text-gray-500" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Search</h1>

      {/* Search Input */}
      <form onSubmit={handleSearch} className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Search cases, documents, statutes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          aria-label="Search"
          autoFocus
        />
      </form>

      {/* Type Filters */}
      <div className="flex gap-2" role="tablist" aria-label="Filter results by type">
        {TYPE_FILTERS.map((filter) => (
          <button
            key={filter.id}
            role="tab"
            aria-selected={typeParam === filter.id}
            onClick={() => handleTypeFilter(filter.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              typeParam === filter.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : queryParam ? (
        <>
          <p className="text-sm text-gray-500">{total} result{total !== 1 ? 's' : ''} for "{queryParam}"</p>
          <div className="space-y-3">
            {results.map((result) => (
              <Card
                key={result.id}
                hover
                className="cursor-pointer"
                onClick={() => navigate(result.url)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{resultIcon(result.type)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{result.title}</h3>
                      <span className="text-xs text-gray-400 capitalize bg-gray-100 px-2 py-0.5 rounded">{result.type}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{result.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {results.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No results found for "{queryParam}"</p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Search size={40} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">Enter a search term to find cases, documents, and statutes.</p>
        </div>
      )}
    </div>
  );
}
