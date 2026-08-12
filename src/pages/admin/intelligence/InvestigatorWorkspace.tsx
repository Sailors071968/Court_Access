// Investigator Review Workspace — V1.0.
// Left: yesterday · Right: today · Bottom: history · Panel: why · One-click actions.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

import {
  intelligenceApi,
  type InvestigatorAction,
  type InvestigatorCandidate,
  type InvestigatorWorkspaceView,
} from '@/services/inmateIntelligenceApi';
import {
  Badge, Button, ErrorNotice, Loading, PageHeader, Panel, TruthBadge,
} from './shared';

function SideCard({
  title,
  side,
}: {
  title: string;
  side: InvestigatorCandidate['prior'];
}) {
  if (!side) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
        <p className="mt-3 text-sm text-gray-500">Not on this roster</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-2 text-lg font-semibold text-gray-900">{side.name}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-gray-500">Booking</dt>
        <dd>{side.bookingNumber ?? 'UNKNOWN'}</dd>
        <dt className="text-gray-500">Housing</dt>
        <dd>{side.housing ?? 'UNKNOWN'}</dd>
        <dt className="text-gray-500">Bail</dt>
        <dd>{side.bail ?? 'UNKNOWN'}</dd>
        <dt className="text-gray-500">Booked</dt>
        <dd>{side.bookedAt?.slice(0, 10) ?? 'UNKNOWN'}</dd>
        <dt className="text-gray-500">Page / row</dt>
        <dd>
          {side.sourcePage ?? '—'} / {side.lineNumber}
        </dd>
        <dt className="text-gray-500">Identity</dt>
        <dd>
          {side.confidence != null ? `${side.confidence}%` : 'UNKNOWN'}
          {side.matchTier ? ` (${side.matchTier})` : ''}
        </dd>
      </dl>
      {side.charges ? (
        <p className="mt-2 text-xs text-gray-600 line-clamp-3">{side.charges}</p>
      ) : null}
    </div>
  );
}

const CONFIRM_ACTIONS: { action: InvestigatorAction; label: string; tone: 'good' | 'info' | 'warn' | 'neutral' }[] = [
  { action: 'confirm_new', label: 'Confirm NEW', tone: 'good' },
  { action: 'confirm_existing', label: 'Confirm EXISTING', tone: 'neutral' },
  { action: 'confirm_returning', label: 'Confirm RETURNING', tone: 'info' },
  { action: 'send_to_review', label: 'Send to REVIEW', tone: 'warn' },
];

const DEFECT_ACTIONS: { action: InvestigatorAction; label: string }[] = [
  { action: 'mark_parser_error', label: 'Mark Parser Error' },
  { action: 'mark_identity_error', label: 'Mark Identity Error' },
  { action: 'mark_ocr_error', label: 'Mark OCR Error' },
  { action: 'mark_comparison_error', label: 'Mark Comparison Error' },
];

export function InvestigatorWorkspace() {
  const [view, setView] = useState<InvestigatorWorkspaceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await intelligenceApi.investigatorWorkspace({ facility: 'sacramento' });
      setView(next);
      setIndex(0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workspace could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(
    () => (view?.candidates ?? []).filter((c) => !c.decided),
    [view],
  );
  const current = pending[index] ?? null;

  const decide = async (action: InvestigatorAction) => {
    if (!view || !current) return;
    setBusy(true);
    setFlash(null);
    try {
      await intelligenceApi.investigatorDecide({
        opsDate: view.opsDate,
        facility: view.facility,
        candidateKey: current.key,
        inmateName: current.name,
        niisClassification: current.niisClassification,
        action,
        inmateId: current.inmateId,
        bookingId: current.bookingId,
      });
      setFlash(`${action.replace(/_/g, ' ')} — recorded`);
      // Remove from local pending by reloading lightly
      const next = await intelligenceApi.investigatorWorkspace({ facility: 'sacramento' });
      setView(next);
      setIndex(0);
    } catch (err) {
      setFlash(err instanceof Error ? err.message : 'Decision failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading label="Loading investigator workspace" />;
  if (error) return <ErrorNotice message={error} onRetry={() => void load()} />;
  if (!view) return null;

  return (
    <div className="mx-auto max-w-[100rem] space-y-4" data-testid="investigator-workspace">
      <PageHeader
        title="Investigator Review Workspace"
        subtitle={`${view.opsDate} vs ${view.priorDate} · ${view.queue.pending} pending · ${view.queue.decided} decided · one click, no typing`}
        actions={
          <>
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Link to="/admin/intelligence/operational-health">
              <Button variant="secondary">Operational Health</Button>
            </Link>
            <Link to="/admin/intelligence/learning-queue">
              <Button variant="secondary">Learning Queue</Button>
            </Link>
          </>
        }
      />

      <p className="text-sm text-gray-600">
        Confidence monitor: review highest-uncertainty cases first. Every click feeds the certification corpus.
        Goal — reduce unnecessary review while preserving correctness.
      </p>

      {view.compareAssistant ? (
        <Panel title="Manual Compare Assistant" description={view.compareAssistant.message}>
          <ul className="space-y-1 text-sm">
            {view.compareAssistant.leastConfident.map((c, i) => (
              <li key={c.key} className="flex flex-wrap items-center gap-2">
                <Badge tone="warn">#{i + 1}</Badge>
                <span className="font-medium">{c.name}</span>
                <Badge tone="info">{c.classification}</Badge>
                <span className="text-xs text-gray-500">uncertainty {c.uncertainty}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {view.automaticClassification ? (
        <div className="grid gap-2 sm:grid-cols-4 text-sm">
          <div className="rounded border border-gray-900 bg-gray-900 px-3 py-2 text-white">
            <p className="text-xs text-gray-300">Auto rate</p>
            <p className="text-xl font-semibold">
              {view.automaticClassification.ratePercent == null
                ? 'UNKNOWN'
                : `${view.automaticClassification.ratePercent}%`}
            </p>
          </div>
          <div className="rounded border px-3 py-2">
            <p className="text-xs text-gray-500">Automatic</p>
            <p className="text-xl font-semibold">{view.automaticClassification.automaticallyCertified}</p>
          </div>
          <div className="rounded border px-3 py-2">
            <p className="text-xs text-gray-500">Review</p>
            <p className="text-xl font-semibold">{view.automaticClassification.humanReview}</p>
          </div>
          <div className="rounded border px-3 py-2">
            <p className="text-xs text-gray-500">Corrected</p>
            <p className="text-xl font-semibold">{view.automaticClassification.corrected}</p>
          </div>
        </div>
      ) : null}

      {flash ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{flash}</p>
      ) : null}

      {!current ? (
        <Panel title="Queue clear" description="All candidates for this filter have a decision — or no roster pair is ready.">
          <p className="text-sm text-gray-600">
            Upload today&apos;s PDF, run comparison, then return here.
          </p>
          <Link to="/admin/intelligence/upload" className="mt-3 inline-block text-sm font-medium text-blue-700 underline">
            Upload PDFs
          </Link>
        </Panel>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-gray-900">{current.name}</span>
            <Badge tone="info">NIIS: {current.niisClassification}</Badge>
            <TruthBadge category={current.truthCategory} />
            {current.uncertainty != null ? (
              <Badge tone={current.uncertainty >= 60 ? 'warn' : 'neutral'}>
                uncertainty {current.uncertainty}
              </Badge>
            ) : null}
            <span className="text-xs text-gray-500">
              {index + 1} of {pending.length} pending (least confident first)
            </span>
            <Button
              variant="secondary"
              disabled={index <= 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              Prev
            </Button>
            <Button
              variant="secondary"
              disabled={index >= pending.length - 1}
              onClick={() => setIndex((i) => Math.min(pending.length - 1, i + 1))}
            >
              Skip
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_20rem]">
            <SideCard title="Yesterday's roster" side={current.prior} />
            <SideCard title="Today's roster" side={current.current} />
            <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Why NIIS reached this conclusion
              </p>
              <p className="text-sm font-medium text-gray-900">{current.whyHere}</p>
              {current.why.rules?.length ? (
                <ul className="list-disc pl-4 text-xs text-gray-600">
                  {current.why.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : null}
              {current.why.identity ? (
                <p className="text-xs text-gray-600">Identity: {current.why.identity}</p>
              ) : null}
              {current.evidence?.length ? (
                <div className="space-y-1 border-t border-gray-100 pt-2">
                  <p className="text-xs font-semibold text-gray-500">Evidence</p>
                  {current.evidence.map((e, i) => (
                    <p key={`${e.side}-${i}`} className="text-xs text-gray-600">
                      {e.side}: {e.filename}
                      {e.page != null ? ` · p.${e.page}` : ''}
                      {e.row != null ? ` · row ${e.row}` : ''}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <Panel title="Historical bookings" description="Prior bookings for this person (enrichment — not the definition of newness).">
            {current.historicalBookings.length === 0 ? (
              <p className="text-sm text-gray-500">None on record</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {current.historicalBookings.map((b) => (
                  <li key={b.bookingId} className="flex flex-wrap gap-3 py-1.5">
                    <span className="font-medium">{b.bookedAt.slice(0, 10)}</span>
                    <span className="text-gray-600">{b.facility}</span>
                    <span className="text-gray-500">{b.externalBookingId ?? '—'}</span>
                    <span className="text-gray-500">{b.housingLocation ?? ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="One-click decisions" description="No typing. Disagreements and defect marks enter the Learning Queue automatically.">
            <div className="flex flex-wrap gap-2">
              {CONFIRM_ACTIONS.map((a) => (
                <Button
                  key={a.action}
                  variant="primary"
                  disabled={busy}
                  onClick={() => void decide(a.action)}
                  testId={`decide-${a.action}`}
                >
                  {a.label}
                </Button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEFECT_ACTIONS.map((a) => (
                <Button
                  key={a.action}
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void decide(a.action)}
                  testId={`decide-${a.action}`}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
