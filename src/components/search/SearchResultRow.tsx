import { Fingerprint, Quote, ShieldCheck, ClipboardCheck } from 'lucide-react';
import { Icon } from '../icons/registry';
import { Badge } from '../ui/badge';
import { ConfidenceIndicator } from '../indicators/indicators';
import { cn } from '../../lib/utils';
import { TYPE_META, type GlobalSearchResult } from '../../services/globalSearchService';

interface SearchResultRowProps {
  result: GlobalSearchResult;
  query?: string;
  active?: boolean;
  onSelect: (result: GlobalSearchResult) => void;
  compact?: boolean;
}

/** Highlights the matched query fragment within a text string. */
function Highlighted({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-gold/25 text-gold-bright rounded px-0.5">{text.slice(idx, idx + query.trim().length)}</mark>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

const REVIEW_META = {
  none: null,
  pending: { label: 'Review pending', variant: 'warning' as const },
  reviewed: { label: 'Reviewed', variant: 'success' as const },
};

/**
 * Reusable result row for the command palette AND the search page.
 * Displays confidence, evidence count, citation count, repository source,
 * human-review status and audit availability.
 */
export function SearchResultRow({ result, query, active, onSelect, compact }: SearchResultRowProps) {
  const meta = TYPE_META[result.type];
  const review = result.humanReviewStatus ? REVIEW_META[result.humanReviewStatus] : null;

  return (
    <button
      onClick={() => onSelect(result)}
      role="option"
      aria-selected={active}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors border',
        active ? 'bg-gold/10 border-gold/25' : 'border-transparent hover:bg-white/5',
      )}
    >
      <span className="w-9 h-9 rounded-lg ca-icon-gold text-gold-light flex items-center justify-center flex-shrink-0">
        <Icon name={meta.icon} size={16} />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white truncate">
            <Highlighted text={result.title} query={query} />
          </p>
          <Badge variant="default">{meta.label}</Badge>
        </div>
        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
          <Highlighted text={result.snippet} query={query} />
        </p>

        {!compact && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {result.confidence !== undefined && <ConfidenceIndicator score={result.confidence} showLabel={false} />}
            {result.evidenceCount !== undefined && result.evidenceCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Fingerprint size={11} /> {result.evidenceCount} evidence
              </span>
            )}
            {result.citationCount !== undefined && result.citationCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Quote size={11} /> {result.citationCount} citations
              </span>
            )}
            {result.repositorySource && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <ShieldCheck size={11} /> {result.repositorySource}
              </span>
            )}
            {review && <Badge variant={review.variant}>{review.label}</Badge>}
            {result.auditAvailable && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                <ClipboardCheck size={11} /> Audit
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
