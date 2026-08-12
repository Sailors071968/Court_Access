// Daily Difference Viewer — prior vs current roster with classification colors.
//
// Speeds manual verification while NIIS earns trust, and diagnoses disagreements.
// Does not change whether someone is "new".

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, RefreshCw } from 'lucide-react';

import {
  intelligenceApi,
  type DailyDifferenceRow,
  type DailyDifferenceView,
  type DifferenceColor,
} from '@/services/inmateIntelligenceApi';
import { authorizedFetch } from '@/services/session';
import {
  Badge, Button, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
} from './shared';

const FILTERS: { id: DifferenceColor | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'green', label: 'New' },
  { id: 'blue', label: 'Returning' },
  { id: 'yellow', label: 'Changed' },
  { id: 'gray', label: 'No change' },
  { id: 'red', label: 'Review' },
];

const COLOR_STYLES: Record<DifferenceColor, string> = {
  green: 'border-l-emerald-500 bg-emerald-50/80',
  blue: 'border-l-sky-500 bg-sky-50/80',
  yellow: 'border-l-amber-400 bg-amber-50/80',
  gray: 'border-l-gray-300 bg-white',
  red: 'border-l-red-500 bg-red-50/80',
};

const COLOR_BADGE: Record<DifferenceColor, 'good' | 'info' | 'warn' | 'neutral' | 'bad'> = {
  green: 'good',
  blue: 'info',
  yellow: 'warn',
  gray: 'neutral',
  red: 'bad',
};

export function DailyDifferenceViewer() {
  const [view, setView] = useState<DailyDifferenceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DifferenceColor | 'all'>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await intelligenceApi.dailyDifference({ facility: 'sacramento' });
      setView(next);
      setError(null);
      if (next.rows.length && !selectedKey) {
        const first = next.rows.find((r) => r.color !== 'gray') ?? next.rows[0];
        setSelectedKey(first.key);
      }
    } catch (err) {
      setView(null);
      setError(err instanceof Error ? err.message : 'Difference view could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [selectedKey]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const selected = useMemo(
    () => view?.rows.find((r) => r.key === selectedKey) ?? null,
    [view, selectedKey],
  );

  const filtered = useMemo(() => {
    if (!view) return [];
    const q = query.trim().toUpperCase();
    return view.rows.filter((row) => {
      if (filter !== 'all' && row.color !== filter) return false;
      if (q && !row.name.includes(q)) return false;
      return true;
    });
  }, [view, filter, query]);

  if (loading) return <Loading label="Building daily difference view" />;

  return (
    <div className="mx-auto max-w-[110rem] space-y-4" data-testid="daily-difference-viewer">
      <PageHeader
        title="Daily Difference Viewer"
        subtitle="Yesterday and today side-by-side — click any inmate for classification rationale and PDF evidence."
        actions={
          <>
            <Link to="/admin/intelligence">
              <Button variant="secondary">Morning board</Button>
            </Link>
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </>
        }
      />

      {error ? (
        <ErrorNotice message={error} onRetry={() => void load()} />
      ) : null}

      {!error && view ? (
        <>
          <LegendBar view={view} />

          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                  filter === f.id
                    ? 'border-blue-600 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {f.label}
                {f.id !== 'all' ? (
                  <span className="ml-1 tabular-nums text-gray-500">
                    {countForColor(view, f.id)}
                  </span>
                ) : null}
              </button>
            ))}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name"
              className="ml-auto rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
              aria-label="Filter by name"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_22rem]">
            <RosterColumn
              title={`Prior · ${view.priorDate}`}
              filename={view.prior.filename}
              count={view.prior.count}
              side="prior"
              rows={filtered}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
            />
            <RosterColumn
              title={`Current · ${view.opsDate}`}
              filename={view.current.filename}
              count={view.current.count}
              side="current"
              rows={filtered}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
            />
            <WhyPanel row={selected} certification={view.reportCertification} />
          </div>
        </>
      ) : null}

      {!error && !view ? (
        <EmptyState
          title="No comparison ready"
          detail="Upload and process yesterday's and today's Sacramento PDFs, then return here."
        />
      ) : null}
    </div>
  );
}

function countForColor(view: DailyDifferenceView, color: DifferenceColor): number {
  return view.rows.filter((r) => r.color === color).length;
}

function LegendBar({ view }: { view: DailyDifferenceView }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <dl className="flex flex-wrap gap-4 text-sm">
          <Legend swatch="bg-emerald-500" label="New" value={view.counts.new} />
          <Legend swatch="bg-sky-500" label="Returning" value={view.counts.returning} />
          <Legend swatch="bg-amber-400" label="Changed" value={view.counts.changed} />
          <Legend swatch="bg-gray-400" label="No change" value={view.counts.unchanged} />
          <Legend swatch="bg-red-500" label="Review" value={view.counts.review + view.counts.unclassified + view.counts.failed} />
          <Legend swatch="bg-gray-300" label="Departed" value={view.counts.departed} />
        </dl>
        <div className="text-right text-xs text-gray-600">
          <p>
            Report:{' '}
            <span className="font-semibold capitalize">{view.reportCertification}</span>
            {' · '}
            Reconcile:{' '}
            <span className={view.reconcileOk ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
              {view.reconcileOk ? 'OK' : 'FAIL'}
            </span>
          </p>
          <p className="mt-0.5 text-gray-500">
            {view.prior.filename ?? 'Prior PDF'} → {view.current.filename ?? 'Current PDF'}
          </p>
        </div>
      </div>
    </Panel>
  );
}

async function openEvidence(href: string): Promise<void> {
  const res = await authorizedFetch(href);
  if (!res.ok) {
    throw new Error(`Evidence could not be opened (${res.status}).`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function Legend({ swatch, label, value }: { swatch: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-sm ${swatch}`} />
      <dt className="text-gray-600">{label}</dt>
      <dd className="font-semibold tabular-nums text-gray-900">{value}</dd>
    </div>
  );
}

function RosterColumn({
  title,
  filename,
  count,
  side,
  rows,
  selectedKey,
  onSelect,
}: {
  title: string;
  filename: string | null;
  count: number;
  side: 'prior' | 'current';
  rows: DailyDifferenceRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const visible = rows.filter((r) => (side === 'prior' ? r.onPrior : r.onCurrent));
  return (
    <Panel
      title={title}
      description={`${filename ?? 'Roster'} · ${count} on roster · showing ${visible.length}`}
    >
      <ul className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <li className="py-8 text-center text-sm text-gray-500">No rows for this filter.</li>
        ) : (
          visible.map((row) => {
            const snap = side === 'prior' ? row.prior : row.current;
            return (
              <li key={`${side}-${row.key}`}>
                <button
                  type="button"
                  onClick={() => onSelect(row.key)}
                  className={`w-full rounded-lg border border-transparent border-l-4 px-3 py-2 text-left transition ${
                    COLOR_STYLES[row.color]
                  } ${selectedKey === row.key ? 'ring-2 ring-blue-500' : 'hover:border-gray-200'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{row.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {snap?.bookingNumber ? `#${snap.bookingNumber}` : 'No booking #'}
                        {snap?.housing ? ` · ${snap.housing}` : ''}
                        {snap?.bail ? ` · bail $${snap.bail}` : ''}
                      </p>
                    </div>
                    <Badge tone={COLOR_BADGE[row.color]}>{row.classification}</Badge>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </Panel>
  );
}

function WhyPanel({
  row,
  certification,
}: {
  row: DailyDifferenceRow | null;
  certification: DailyDifferenceView['reportCertification'];
}) {
  if (!row) {
    return (
      <Panel title="Classification" description="Select an inmate to see why.">
        <EmptyState title="Nothing selected" detail="Click a highlighted name in either roster." />
      </Panel>
    );
  }

  return (
    <Panel
      title={row.name}
      description={`${row.classification} · report ${certification}`}
    >
      <div className="space-y-4 text-sm">
        <div>
          <Badge tone={COLOR_BADGE[row.color]}>{row.classification}</Badge>
          <p className="mt-2 text-gray-800">{row.why.summary}</p>
        </div>

        {row.why.identity ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Identity</p>
            <p className="mt-1 text-gray-700">{row.why.identity}</p>
          </div>
        ) : null}

        {row.why.attributeChanges.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Changes</p>
            <ul className="mt-1 space-y-1">
              {row.why.attributeChanges.map((c) => (
                <li key={c.field} className="text-gray-700">
                  <span className="font-medium">{c.field}</span>:{' '}
                  <span className="text-gray-500">{c.from ?? '—'}</span>
                  {' → '}
                  <span>{c.to ?? '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {row.why.rules.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Rules applied</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-gray-600">
              {row.why.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Evidence</p>
          {row.evidence.length === 0 ? (
            <p className="mt-1 text-xs text-gray-500">No upload linked for this row.</p>
          ) : (
            <ul className="mt-1 space-y-2">
              {row.evidence.map((ev) => (
                <li key={`${ev.side}-${ev.uploadId}-${ev.row}`} className="rounded-lg border border-gray-200 px-2.5 py-2">
                  <p className="text-xs font-medium text-gray-900">
                    {ev.side === 'prior' ? 'Prior PDF' : 'Current PDF'}: {ev.filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {ev.page != null ? `Page ${ev.page}` : 'Page n/a'}
                    {ev.row != null ? ` · row ${ev.row}` : ''}
                  </p>
                  {ev.href ? (
                    <button
                      type="button"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                      onClick={() => {
                        void openEvidence(ev.href!).catch((err) => {
                          window.alert(err instanceof Error ? err.message : 'Evidence could not be opened.');
                        });
                      }}
                    >
                      Open evidence <ExternalLink className="h-3 w-3" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {row.inmateId ? (
          <Link
            to={`/admin/intelligence/persons/${row.inmateId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            Open person record <ExternalLink className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    </Panel>
  );
}
