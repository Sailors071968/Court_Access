import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, Star, Pin, CornerDownLeft, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Icon } from '../icons/registry';
import { ConfidenceIndicator } from '../indicators/indicators';
import { SearchResultRow } from './SearchResultRow';
import {
  globalSearch,
  recentSearches,
  savedSearches,
  pinnedSearches,
  SEARCH_MODES,
  TYPE_META,
  type GlobalSearchResult,
  type SearchMode,
} from '../../services/globalSearchService';
import { cn } from '../../lib/utils';

// ── Context / provider ───────────────────────────────────────────────────────
interface GlobalSearchContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const GlobalSearchContext = createContext<GlobalSearchContextValue | null>(null);

export function useGlobalSearch() {
  const ctx = useContext(GlobalSearchContext);
  if (!ctx) throw new Error('useGlobalSearch must be used within GlobalSearchProvider');
  return ctx;
}

export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Cmd/Ctrl+K opens the palette anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <GlobalSearchContext.Provider value={value}>
      {children}
      {isOpen && <GlobalSearchPalette onClose={close} />}
    </GlobalSearchContext.Provider>
  );
}

// ── Palette ──────────────────────────────────────────────────────────────────
function GlobalSearchPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('natural');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [tookMs, setTookMs] = useState(0);
  const [recents] = useState(() => recentSearches.list());
  const [pinned] = useState(() => pinnedSearches.list());
  const [saved] = useState(() => savedSearches.list());

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Debounced instant search.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const res = await globalSearch(query, { mode });
      setResults(res.results);
      setTookMs(res.tookMs);
      setActiveIndex(0);
      setLoading(false);
    }, 140);
    return () => clearTimeout(handle);
  }, [query, mode]);

  const openResult = useCallback(
    (result: GlobalSearchResult) => {
      recentSearches.add(query || result.title);
      onClose();
      navigate(result.url);
    },
    [navigate, onClose, query],
  );

  const runQuery = useCallback((q: string) => setQuery(q), []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      openResult(results[activeIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const preview = results[activeIndex];
  const hasQuery = query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 sm:pt-24">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global legal intelligence search"
        className="relative w-full max-w-3xl ca-panel shadow-elevated overflow-hidden animate-slide-up"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
          <Search size={18} className="text-gold-light flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search cases, evidence, statutes, people, citations…"
            className="flex-1 bg-transparent text-white text-base placeholder:text-slate-400 focus:outline-none"
            aria-label="Search query"
          />
          {loading && <span className="text-xs text-slate-400">…</span>}
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg" aria-label="Close search">
            <X size={16} />
          </button>
        </div>

        {/* Mode selector */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 overflow-x-auto">
          {SEARCH_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              title={m.hint}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                mode === m.id ? 'bg-gold/10 text-gold-light border border-gold/20' : 'text-slate-400 hover:text-white hover:bg-white/5',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex max-h-[60vh]">
          {/* Results / suggestions */}
          <div className="flex-1 overflow-y-auto p-2" role="listbox" aria-label="Search results">
            {!hasQuery ? (
              <SuggestionLists pinned={pinned} saved={saved} recents={recents} onPick={runQuery} />
            ) : results.length === 0 && !loading ? (
              <div className="px-3 py-10 text-center text-sm text-slate-400">No results for “{query}”.</div>
            ) : (
              results.map((r, i) => (
                <div key={r.id} onMouseEnter={() => setActiveIndex(i)}>
                  <SearchResultRow result={r} query={query} active={i === activeIndex} onSelect={openResult} compact />
                </div>
              ))
            )}
          </div>

          {/* Instant preview */}
          {hasQuery && preview && (
            <div className="hidden md:block w-72 border-l border-white/10 p-4 overflow-y-auto">
              <div className="w-10 h-10 rounded-xl ca-icon-gold text-gold-light flex items-center justify-center mb-3">
                <Icon name={TYPE_META[preview.type].icon} size={18} />
              </div>
              <Badge variant="default">{TYPE_META[preview.type].label}</Badge>
              <h3 className="text-sm font-semibold text-white mt-2">{preview.title}</h3>
              <p className="text-xs text-slate-400 mt-1">{preview.snippet}</p>
              <dl className="mt-4 space-y-2 text-xs">
                {preview.confidence !== undefined && (
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-400">Confidence</dt>
                    <dd><ConfidenceIndicator score={preview.confidence} showLabel={false} /></dd>
                  </div>
                )}
                {preview.evidenceCount !== undefined && (
                  <Row label="Evidence" value={String(preview.evidenceCount)} />
                )}
                {preview.citationCount !== undefined && (
                  <Row label="Citations" value={String(preview.citationCount)} />
                )}
                {preview.repositorySource && <Row label="Repository" value={preview.repositorySource} />}
                {preview.humanReviewStatus && <Row label="Human review" value={preview.humanReviewStatus} />}
                <Row label="Audit" value={preview.auditAvailable ? 'Available' : 'None'} />
              </dl>
              <button
                onClick={() => openResult(preview)}
                className="mt-4 w-full ca-gradient-gold text-navy text-sm font-semibold py-2 rounded-lg hover:brightness-110 transition-all"
              >
                Open result
              </button>
            </div>
          )}
        </div>

        {/* Footer / shortcuts */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/10 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><CornerDownLeft size={12} /> open</span>
            <span>↑↓ navigate</span>
            <span>esc close</span>
          </div>
          {hasQuery && <span>{results.length} results · {tookMs}ms</span>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-slate-300 capitalize">{value}</dd>
    </div>
  );
}

function SuggestionLists({
  pinned,
  saved,
  recents,
  onPick,
}: {
  pinned: string[];
  saved: string[];
  recents: string[];
  onPick: (q: string) => void;
}) {
  const section = (title: string, icon: ReactNode, items: string[]) =>
    items.length > 0 && (
      <div className="mb-3">
        <p className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {icon} {title}
        </p>
        {items.slice(0, 5).map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <Search size={13} className="text-slate-400" />
            {q}
          </button>
        ))}
      </div>
    );

  if (pinned.length === 0 && saved.length === 0 && recents.length === 0) {
    return (
      <div className="px-3 py-10 text-center">
        <Search size={28} className="mx-auto text-slate-300 mb-3" />
        <p className="text-sm text-slate-400">Search across cases, evidence, statutes, people, and the knowledge graph.</p>
        <p className="text-xs text-slate-300 mt-1">Try natural language, a citation like “PC 459”, or boolean queries.</p>
      </div>
    );
  }

  return (
    <div className="py-1">
      {section('Pinned', <Pin size={12} />, pinned)}
      {section('Saved', <Star size={12} />, saved)}
      {section('Recent', <Clock size={12} />, recents)}
    </div>
  );
}
