// ============================================================================
// CourtAccess — Global Legal Intelligence Search (Program 25)
// Full-page search built on the master component library + global search service.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Star, Pin, Command } from 'lucide-react';
import { PageHeader } from '../components/ui/page-header';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { SearchBar } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Spinner } from '../components/ui/spinner';
import { EmptyState } from '../components/ui/empty-state';
import { Icon } from '../components/icons/registry';
import { SearchResultRow } from '../components/search/SearchResultRow';
import { useGlobalSearch } from '../components/search/GlobalSearch';
import { SPACING } from '../constants/designTokens';
import {
  globalSearch,
  savedSearches,
  pinnedSearches,
  recentSearches,
  SEARCH_MODES,
  TYPE_META,
  type GlobalSearchResult,
  type GlobalSearchType,
  type SearchMode,
} from '../services/globalSearchService';
import { cn } from '../lib/utils';

const FILTER_GROUPS: { label: string; types: GlobalSearchType[] }[] = [
  { label: 'Cases', types: ['case'] },
  { label: 'Evidence', types: ['evidence', 'document', 'ocr_text', 'evidence_id'] },
  { label: 'People', types: ['witness', 'person', 'address', 'phone', 'vehicle', 'license_plate'] },
  { label: 'Legal', types: ['charge', 'statute', 'california_code', 'federal_code', 'case_law', 'authority'] },
  { label: 'Knowledge Graph', types: ['graph_node', 'repository_id'] },
  { label: 'Timeline', types: ['timeline_event'] },
  { label: 'Notes & Messages', types: ['note', 'message'] },
  { label: 'Reports & Audit', types: ['report', 'audit_event'] },
];

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { open: openPalette } = useGlobalSearch();
  const queryParam = searchParams.get('q') || '';

  const [query, setQuery] = useState(queryParam);
  const [mode, setMode] = useState<SearchMode>('natural');
  const [activeGroup, setActiveGroup] = useState<string>('All');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [tookMs, setTookMs] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const runSearch = useCallback(
    async (q: string, m: SearchMode, group: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      const types = group === 'All' ? undefined : FILTER_GROUPS.find((g) => g.label === group)?.types;
      const res = await globalSearch(q, { mode: m, types });
      setResults(res.results);
      setTookMs(res.tookMs);
      setLoading(false);
      recentSearches.add(q);
      setIsSaved(savedSearches.has(q));
      setIsPinned(pinnedSearches.has(q));
    },
    [],
  );

  useEffect(() => {
    if (queryParam) {
      setQuery(queryParam);
      void runSearch(queryParam, mode, activeGroup);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParam]);

  const submit = (value: string) => {
    const q = value.trim();
    if (!q) return;
    setSearchParams({ q });
    void runSearch(q, mode, activeGroup);
  };

  return (
    <div className={`${SPACING.container} space-y-6`}>
      <PageHeader
        title="Legal Intelligence Search"
        overline="Search"
        subtitle="Search cases, evidence, people, statutes, case law, the knowledge graph, and more."
        action={
          <Button variant="secondary" onClick={openPalette}>
            <Command size={15} /> Quick search
            <kbd className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-white/10 border border-white/10">⌘K</kbd>
          </Button>
        }
      />

      <SearchBar
        placeholder="Search everything — natural language, a citation like “PC 459”, or boolean queries…"
        defaultValue={queryParam}
        onSearch={submit}
        autoFocus
      />

      {/* Mode selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 mr-1">Mode:</span>
        {SEARCH_MODES.map((m) => (
          <button
            key={m.id}
            title={m.hint}
            onClick={() => {
              setMode(m.id);
              if (query.trim()) void runSearch(query, m.id, activeGroup);
            }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              mode === m.id ? 'bg-gold/10 text-gold-light border border-gold/20' : 'text-slate-400 hover:text-white hover:bg-white/5',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-2">
        {['All', ...FILTER_GROUPS.map((g) => g.label)].map((label) => (
          <button
            key={label}
            onClick={() => {
              setActiveGroup(label);
              if (query.trim()) void runSearch(query, mode, label);
            }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              activeGroup === label ? 'bg-gold/10 text-gold-light border border-gold/20' : 'bg-white/5 text-slate-400 hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <Spinner label="Searching…" />
      ) : queryParam ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              {results.length} result{results.length !== 1 ? 's' : ''} for “{queryParam}” · {tookMs}ms
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant={isSaved ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => {
                  savedSearches.toggle(queryParam);
                  setIsSaved(savedSearches.has(queryParam));
                }}
              >
                <Star size={14} /> {isSaved ? 'Saved' : 'Save'}
              </Button>
              <Button
                variant={isPinned ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => {
                  pinnedSearches.toggle(queryParam);
                  setIsPinned(pinnedSearches.has(queryParam));
                }}
              >
                <Pin size={14} /> {isPinned ? 'Pinned' : 'Pin'}
              </Button>
            </div>
          </div>

          {results.length === 0 ? (
            <Card>
              <EmptyState icon={<Icon name="search" size={24} />} title={`No results for “${queryParam}”`} description="Try a different mode or broaden your query." />
            </Card>
          ) : (
            <Card padding="sm">
              <div role="listbox" aria-label="Search results">
                {results.map((r) => (
                  <SearchResultRow key={r.id} result={r} query={queryParam} onSelect={(res) => navigate(res.url)} />
                ))}
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <EmptyState
            icon={<Icon name="search" size={24} />}
            title="Search the entire platform"
            description="Cases, evidence, witnesses, documents, charges, statutes, California & federal codes, case law, authorities, timeline events, people, vehicles, knowledge-graph nodes, OCR text, notes, messages, reports and audit events."
            action={
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {Object.values(TYPE_META)
                  .filter((m, i, arr) => arr.findIndex((x) => x.group === m.group) === i)
                  .map((m) => (
                    <Badge key={m.group} variant="default">{m.group}</Badge>
                  ))}
              </div>
            }
          />
        </Card>
      )}
    </div>
  );
}
