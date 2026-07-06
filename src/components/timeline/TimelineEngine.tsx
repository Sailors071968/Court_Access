// =============================================================================
// CourtAccess — Unified Timeline Engine (Program 26)
// ONE engine for every timeline: case, investigation, evidence, discovery,
// court calendar, witness, OCR, knowledge extraction, audit, system.
// Features: zoom, grouping, filtering, evidence/authority overlays,
// contradictions, unknowns, search, export, print, presentation mode,
// responsive, dark theme, keyboard navigation.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Download,
  Printer,
  Presentation,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  X,
  Fingerprint,
  Landmark,
  Quote,
} from 'lucide-react';
import { Icon } from '../icons/registry';
import { Badge } from '../ui/badge';
import { Dropdown } from '../ui/dropdown';
import { EmptyState } from '../ui/empty-state';
import { ConfidenceIndicator } from '../indicators/indicators';
import { cn } from '../../lib/utils';
import type {
  TimelineEvent,
  TimelineVariant,
  TimelineGrouping,
  TimelineZoom,
  TimelineOverlayFlags,
  TimelineSignificance,
} from './types';

const VARIANT_META: Record<TimelineVariant, { label: string; icon: Parameters<typeof Icon>[0]['name'] }> = {
  case: { label: 'Case Timeline', icon: 'timeline' },
  investigation: { label: 'Investigation Timeline', icon: 'investigator' },
  evidence: { label: 'Evidence Timeline', icon: 'evidence' },
  discovery: { label: 'Discovery Timeline', icon: 'discovery' },
  court: { label: 'Court Calendar', icon: 'calendar' },
  witness: { label: 'Witness Timeline', icon: 'witness' },
  ocr: { label: 'OCR Timeline', icon: 'ocr' },
  knowledge: { label: 'Knowledge Extraction Timeline', icon: 'knowledgeGraph' },
  audit: { label: 'Audit Timeline', icon: 'audit' },
  system: { label: 'System Timeline', icon: 'settings' },
};

const SIGNIFICANCE_DOT: Record<TimelineSignificance, string> = {
  routine: 'bg-slate-500',
  notable: 'bg-blue-400',
  significant: 'bg-gold-light',
  critical: 'bg-red-400',
};

const ZOOM_GAP: Record<TimelineZoom, string> = {
  compact: 'gap-1',
  comfortable: 'gap-3',
  spacious: 'gap-6',
};

interface TimelineEngineProps {
  events: TimelineEvent[];
  variant?: TimelineVariant;
  title?: string;
  loading?: boolean;
  className?: string;
}

function formatTime(ts: string | null): string {
  if (!ts) return 'UNKNOWN time';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function groupKey(e: TimelineEvent, grouping: TimelineGrouping): string {
  switch (grouping) {
    case 'day':
      return e.timestamp ? new Date(e.timestamp).toLocaleDateString() : 'Unknown date';
    case 'type':
      return e.category ?? 'Uncategorized';
    case 'actor':
      return e.actor ?? 'Unknown actor';
    case 'significance':
      return e.significance ?? 'unspecified';
    default:
      return '';
  }
}

export function TimelineEngine({ events, variant = 'case', title, loading, className }: TimelineEngineProps) {
  const meta = VARIANT_META[variant];
  const [query, setQuery] = useState('');
  const [grouping, setGrouping] = useState<TimelineGrouping>('none');
  const [zoom, setZoom] = useState<TimelineZoom>('comfortable');
  const [sigFilter, setSigFilter] = useState<Set<TimelineSignificance>>(new Set());
  const [overlays, setOverlays] = useState<TimelineOverlayFlags>({
    evidence: true,
    authorities: true,
    contradictions: true,
    unknowns: true,
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [presentation, setPresentation] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filtered + searched events (chronological; UNKNOWN times sink to the end).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => {
        if (sigFilter.size > 0 && (!e.significance || !sigFilter.has(e.significance))) return false;
        if (!overlays.contradictions && e.isContradiction) return false;
        if (!overlays.unknowns && e.isUnknown) return false;
        if (!q) return true;
        return (
          e.title.toLowerCase().includes(q) ||
          (e.description ?? '').toLowerCase().includes(q) ||
          (e.actor ?? '').toLowerCase().includes(q) ||
          (e.category ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
  }, [events, query, sigFilter, overlays]);

  // Grouped structure for rendering.
  const groups = useMemo(() => {
    if (grouping === 'none') return [{ key: '', items: filtered }];
    const map = new Map<string, TimelineEvent[]>();
    filtered.forEach((e) => {
      const k = groupKey(e, grouping);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    });
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  }, [filtered, grouping]);

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, activeIndex]);

  // Keyboard navigation.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Home') {
      setActiveIndex(0);
    } else if (e.key === 'End') {
      setActiveIndex(filtered.length - 1);
    } else if (e.key === 'Enter') {
      setPresentation(true);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `timeline-${variant}.json`);
  };

  const exportCsv = () => {
    const header = 'timestamp,title,actor,category,significance,confidence,source\n';
    const rows = filtered
      .map((e) =>
        [e.timestamp ?? 'UNKNOWN', e.title, e.actor ?? '', e.category ?? '', e.significance ?? '', e.confidence ?? '', e.source ?? '']
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    downloadBlob(new Blob([header + rows], { type: 'text/csv' }), `timeline-${variant}.csv`);
  };

  const toggleSig = (s: TimelineSignificance) => {
    setSigFilter((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  return (
    <div className={cn('ca-panel overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-4 py-3 border-b border-white/10 print:hidden">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon name={meta.icon} size={18} variant="selected" />
          <h3 className="text-sm font-semibold text-white truncate">{title ?? meta.label}</h3>
          <Badge variant="default">{filtered.length}</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search timeline…"
              className="w-44 pl-8 pr-3 py-1.5 rounded-lg border border-white/10 bg-navy-900/60 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold/40"
              aria-label="Search timeline"
            />
          </div>

          <Dropdown
            options={[
              { value: 'none', label: 'No grouping' },
              { value: 'day', label: 'Group by day' },
              { value: 'type', label: 'Group by type' },
              { value: 'actor', label: 'Group by actor' },
              { value: 'significance', label: 'Group by significance' },
            ]}
            value={grouping}
            onChange={(v) => setGrouping(v as TimelineGrouping)}
            buttonClassName="!min-w-[9rem] !py-1.5 text-xs"
          />

          <button
            onClick={() => setZoom((z) => (z === 'compact' ? 'comfortable' : z === 'comfortable' ? 'spacious' : 'compact'))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/5"
            title="Zoom / density"
          >
            <ZoomIn size={14} /> {zoom}
          </button>

          <button onClick={exportJson} className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5" title="Export JSON"><Download size={14} /></button>
          <button onClick={exportCsv} className="px-2 py-1.5 rounded-lg border border-white/10 text-xs text-slate-400 hover:text-white hover:bg-white/5" title="Export CSV">CSV</button>
          <button onClick={() => window.print()} className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5" title="Print"><Printer size={14} /></button>
          <button onClick={() => setPresentation(true)} className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5" title="Presentation mode"><Presentation size={14} /></button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-white/5 print:hidden">
        <span className="text-[11px] text-slate-500">Significance:</span>
        {(['routine', 'notable', 'significant', 'critical'] as TimelineSignificance[]).map((s) => (
          <button
            key={s}
            onClick={() => toggleSig(s)}
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border transition-colors capitalize',
              sigFilter.size === 0 || sigFilter.has(s)
                ? 'border-white/15 text-slate-200'
                : 'border-white/5 text-slate-600',
            )}
          >
            <span className={cn('w-2 h-2 rounded-full', SIGNIFICANCE_DOT[s])} /> {s}
          </button>
        ))}
        <span className="w-px h-4 bg-white/10 mx-1" />
        <span className="text-[11px] text-slate-500">Overlays:</span>
        {(['evidence', 'authorities', 'contradictions', 'unknowns'] as (keyof TimelineOverlayFlags)[]).map((o) => (
          <button
            key={o}
            onClick={() => setOverlays((prev) => ({ ...prev, [o]: !prev[o] }))}
            className={cn(
              'px-2 py-0.5 rounded-full text-[11px] border transition-colors capitalize',
              overlays[o] ? 'border-gold/25 bg-gold/10 text-gold-light' : 'border-white/10 text-slate-500',
            )}
          >
            {o}
          </button>
        ))}
      </div>

      {/* Timeline body */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        role="list"
        aria-label={title ?? meta.label}
        className="p-4 max-h-[32rem] overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
      >
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Icon name="timeline" size={22} />} title="No timeline events" description="Events will appear here once the case is processed." />
        ) : (
          groups.map((group) => (
            <div key={group.key || 'all'} className="mb-4 last:mb-0">
              {group.key && (
                <p className="sticky top-0 z-10 bg-navy-800/80 backdrop-blur-sm py-1 text-[11px] font-semibold uppercase tracking-wide text-gold-light">
                  {group.key}
                </p>
              )}
              <div className={cn('relative pl-6 flex flex-col', ZOOM_GAP[zoom])}>
                <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/10" />
                {group.items.map((e) => {
                  const globalIdx = filtered.indexOf(e);
                  const active = globalIdx === activeIndex;
                  return (
                    <div
                      key={e.id}
                      role="listitem"
                      onClick={() => setActiveIndex(globalIdx)}
                      className={cn(
                        'relative rounded-xl px-3 py-2.5 cursor-pointer transition-colors border',
                        active ? 'bg-gold/10 border-gold/25' : 'border-transparent hover:bg-white/5',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute -left-[22px] top-3.5 w-3 h-3 rounded-full ring-2 ring-navy-800',
                          e.isContradiction ? 'bg-red-400' : SIGNIFICANCE_DOT[e.significance ?? 'routine'],
                        )}
                      />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">
                            {e.actor && <span className="text-gold-light">{e.actor}: </span>}
                            {e.title}
                          </p>
                          {e.description && <p className="text-xs text-slate-400 mt-0.5">{e.description}</p>}
                        </div>
                        <span className={cn('text-[11px] whitespace-nowrap flex-shrink-0', e.isUnknown ? 'text-orange-400' : 'text-slate-500')}>
                          {formatTime(e.timestamp)}
                        </span>
                      </div>

                      {/* Overlays */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                        {e.confidence !== undefined && <ConfidenceIndicator score={e.confidence} showLabel={false} />}
                        {overlays.evidence && e.evidenceIds && e.evidenceIds.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Fingerprint size={11} /> {e.evidenceIds.length}</span>
                        )}
                        {overlays.authorities && e.authorities && e.authorities.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400"><Landmark size={11} /> {e.authorities.length}</span>
                        )}
                        {e.citations && e.citations.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><Quote size={11} /> {e.citations.length}</span>
                        )}
                        {overlays.contradictions && e.isContradiction && <Badge variant="danger">Contradiction</Badge>}
                        {overlays.unknowns && e.isUnknown && <Badge variant="warning">Unknown time</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Presentation mode */}
      {presentation && filtered[activeIndex] && (
        <PresentationOverlay
          events={filtered}
          index={activeIndex}
          onIndex={setActiveIndex}
          onClose={() => setPresentation(false)}
          title={title ?? meta.label}
        />
      )}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function PresentationOverlay({
  events,
  index,
  onIndex,
  onClose,
  title,
}: {
  events: TimelineEvent[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  title: string;
}) {
  const e = events[index];
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowRight') onIndex(Math.min(index + 1, events.length - 1));
      else if (ev.key === 'ArrowLeft') onIndex(Math.max(index - 1, 0));
      else if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, events.length, onIndex, onClose]);

  return (
    <div className="fixed inset-0 z-[80] ca-gradient-hero flex flex-col animate-fade-in">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <p className="text-sm font-semibold text-gold-light uppercase tracking-wide">{title}</p>
        <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5" aria-label="Exit presentation"><X size={18} /></button>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center animate-slide-up">
          <p className="text-gold-light text-sm mb-3">{formatTime(e.timestamp)}</p>
          <h2 className="text-3xl font-bold text-white mb-4">
            {e.actor && <span className="text-gold-light">{e.actor}: </span>}
            {e.title}
          </h2>
          {e.description && <p className="text-lg text-slate-300">{e.description}</p>}
          <div className="flex items-center justify-center gap-3 mt-6">
            {e.confidence !== undefined && <ConfidenceIndicator score={e.confidence} />}
            {e.isContradiction && <Badge variant="danger">Contradiction</Badge>}
            {e.isUnknown && <Badge variant="warning">Unknown time</Badge>}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
        <button onClick={() => onIndex(Math.max(index - 1, 0))} disabled={index === 0} className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white disabled:opacity-40"><ChevronLeft size={16} /> Previous</button>
        <span className="text-xs text-slate-500">{index + 1} / {events.length}</span>
        <button onClick={() => onIndex(Math.min(index + 1, events.length - 1))} disabled={index === events.length - 1} className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white disabled:opacity-40">Next <ChevronRight size={16} /></button>
      </div>
    </div>
  );
}
