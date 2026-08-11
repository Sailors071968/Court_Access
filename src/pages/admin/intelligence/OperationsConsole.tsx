// The operations console — the home screen of the subsystem.
//
// Written for the person who does the import at 7am, not for the person who built the
// system. It leads with one sentence saying what to do next, because that is the only
// question whose answer changes what they do; everything else is context for after they
// have read it.
//
// Clarity over appearance, per the brief. No charts where a number will do, and the
// numbers are placed in the order they are acted on: is today done, is anything waiting
// for me, what did the roster contain, is the machinery healthy.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CheckCircle2, Clock, FileSearch, Printer, RefreshCw, Upload, XCircle,
} from 'lucide-react';

import {
  intelligenceApi,
  type BatchComparison,
  type MorningSummary,
  type ReportRecord,
} from '@/services/inmateIntelligenceApi';
import {
  Badge, Button, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
  TableShell, Td, Th, formatDateTime, formatDuration,
} from './shared';

export function OperationsConsole() {
  const [summary, setSummary] = useState<MorningSummary | null>(null);
  const [comparison, setComparison] = useState<BatchComparison | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const morning = await intelligenceApi.morning();
      setSummary(morning);
      setRefreshedAt(new Date());
      setError(null);

      // Both are context rather than the point of the screen, so a failure in either
      // must not hide the summary the operator came here to read.
      void intelligenceApi.compareLatest().then(setComparison).catch(() => setComparison(null));
      void intelligenceApi.reportList({ limit: 8 }).then((r) => setReports(r.reports)).catch(() => setReports([]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The operations console could not be loaded.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  // Poll only while something is in flight, so a quiet morning is not a request every
  // few seconds for numbers that cannot change.
  useEffect(() => {
    if (!summary || summary.today.batchesInProgress === 0) return;
    const timer = window.setTimeout(() => void load(false), 3000);
    return () => window.clearTimeout(timer);
  }, [summary, load]);

  if (loading) return <Loading label="Loading the operations console" />;
  if (error) return <ErrorNotice message={error} onRetry={() => void load(true)} />;
  if (!summary) return null;

  const { today, intelligence, health, parserWarnings } = summary;

  return (
    <div className="mx-auto max-w-[100rem] space-y-5">
      <PageHeader
        title="Operations console"
        subtitle={refreshedAt ? `Last refreshed ${refreshedAt.toLocaleTimeString()}` : undefined}
        actions={
          <>
            <Link to="/admin/intelligence">
              <Button variant="secondary">Morning board</Button>
            </Link>
            <Button variant="secondary" onClick={() => void load(true)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Link to="/admin/intelligence/inspect">
              <Button variant="secondary">
                <FileSearch className="h-3.5 w-3.5" /> Inspect a file
              </Button>
            </Link>
            <Link to="/admin/intelligence/upload">
              <Button variant="primary" testId="ops-upload">
                <Upload className="h-3.5 w-3.5" /> Upload today's roster
              </Button>
            </Link>
          </>
        }
      />

      <Headline summary={summary} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Today" className="lg:col-span-1">
          <dl className="space-y-2.5 text-sm">
            <Row label="Date" value={today.date} />
            <Row
              label="Today's roster imported"
              value={today.todaysRosterImported ? 'Yes' : 'Not yet'}
              tone={today.todaysRosterImported ? 'good' : 'warn'}
            />
            <Row label="Imports started today" value={String(today.batchesStarted)} />
            <Row label="Completed" value={String(today.batchesCompleted)} tone={today.batchesCompleted > 0 ? 'good' : 'neutral'} />
            <Row label="Failed" value={String(today.batchesFailed)} tone={today.batchesFailed > 0 ? 'bad' : 'neutral'} />
            <Row label="Still processing" value={String(today.batchesInProgress)} tone={today.batchesInProgress > 0 ? 'info' : 'neutral'} />
          </dl>

          {summary.lastSuccessfulImport ? (
            <div className="mt-4 border-t border-gray-100 pt-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Last successful import</p>
              <p className="mt-1 font-medium text-gray-900">{summary.lastSuccessfulImport.filename}</p>
              <p className="text-xs text-gray-500">
                {formatDateTime(summary.lastSuccessfulImport.at)}
                {' · '}
                {summary.lastSuccessfulImport.hoursAgo === 0
                  ? 'within the hour'
                  : `${summary.lastSuccessfulImport.hoursAgo} hour(s) ago`}
              </p>
              <p className="text-xs text-gray-500">
                Roster {summary.lastSuccessfulImport.rosterDate ?? 'undated'}
                {summary.lastSuccessfulImport.operator ? ` · ${summary.lastSuccessfulImport.operator}` : ''}
              </p>
            </div>
          ) : (
            <p className="mt-4 border-t border-gray-100 pt-3 text-sm text-gray-500">
              No roster has ever been imported.
            </p>
          )}
        </Panel>

        <Panel title="What the roster contained" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Figure
              label="Newly booked"
              value={intelligence.newInmates}
              to="/admin/intelligence/new-inmates"
              tone="primary"
            />
            <Figure label="Returning" value={intelligence.returningInmates} to="/admin/intelligence/new-inmates" />
            <Figure
              label="Watch list matches"
              value={intelligence.watchListMatches}
              tone={intelligence.watchListMatches > 0 ? 'bad' : 'neutral'}
            />
            <Figure
              label="Reviews waiting"
              value={intelligence.unresolvedReviewItems}
              to="/admin/intelligence/review"
              tone={intelligence.unresolvedReviewItems > 0 ? 'warn' : 'good'}
            />
            <Figure
              label="Unresolved conflicts"
              value={intelligence.unresolvedConflicts}
              tone={intelligence.unresolvedConflicts > 0 ? 'warn' : 'neutral'}
            />
            <Figure label="Significant changes" value={intelligence.significantChanges} />
          </div>

          {intelligence.unresolvedReviewItems > 0 ? (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              A record awaiting review has no booking in the repository. Until each is decided, those people are
              not in the population figures or on any report.
            </p>
          ) : null}
        </Panel>
      </div>

      {parserWarnings.length > 0 ? (
        <Panel title="Parser warnings" description="Worth reading before the next import.">
          <ul className="space-y-2">
            {parserWarnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Badge tone={warning.severity === 'error' ? 'bad' : 'warn'}>{warning.severity}</Badge>
                <span className="flex-1 text-gray-700">{warning.message}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Link to="/admin/intelligence/mappings" className="text-sm font-medium text-blue-600 hover:underline">
              Open Parser Mapping <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Since the previous roster"
          description={
            comparison?.comparisonId
              ? 'Compared against the import before this one, from the changes recorded at import time.'
              : undefined
          }
        >
          {!comparison ? (
            <EmptyState
              title="Nothing to compare yet"
              detail="A comparison needs two completed imports for the same facility."
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['New', comparison.counts.newInmates],
                  ['Returns', comparison.counts.returns],
                  ['Releases', comparison.counts.releases],
                  ['Left roster', comparison.counts.departures],
                  ['Housing moves', comparison.counts.housingMoves],
                  ['Bail changes', comparison.counts.bailChanges],
                  ['Charge changes', comparison.counts.chargeChanges],
                  ['Court changes', comparison.counts.courtChanges],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded border border-gray-200 px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                    <p className="text-lg font-semibold tabular-nums text-gray-900">{value ?? 0}</p>
                  </div>
                ))}
              </div>

              {comparison.detail.length > 0 ? (
                <TableShell>
                  <thead>
                    <tr>
                      <Th>Change</Th>
                      <Th>Person</Th>
                      <Th>Booking</Th>
                      <Th>From</Th>
                      <Th>To</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.detail.slice(0, 12).map((d, index) => (
                      <tr key={index}>
                        <Td className="whitespace-nowrap text-xs">{d.kind.replace(/_/g, ' ')}</Td>
                        <Td>
                          {d.inmateId ? (
                            <Link
                              to={`/admin/intelligence/persons/${d.inmateId}`}
                              className="font-medium text-blue-700 hover:underline"
                            >
                              {d.name}
                            </Link>
                          ) : d.name}
                        </Td>
                        <Td className="font-mono text-xs">{d.bookingNumber ?? '—'}</Td>
                        <Td className="text-xs">{d.from ?? '—'}</Td>
                        <Td className="text-xs">{d.to ?? '—'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </TableShell>
              ) : (
                <p className="mt-3 text-sm text-gray-500">Nothing changed between the two rosters.</p>
              )}
              {comparison.detail.length > 12 ? (
                <p className="mt-2 text-xs text-gray-500">
                  Showing 12 of {comparison.detail.length} differences. The counts above are complete.
                </p>
              ) : null}
            </>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="System health">
            <dl className="space-y-2.5 text-sm">
              <Row label="Database" value={health.database} tone={health.database === 'ok' ? 'good' : 'bad'} />
              <Row label="Facilities configured" value={String(health.facilitiesConfigured)} tone={health.facilitiesConfigured > 0 ? 'good' : 'bad'} />
              <Row
                label="Active parser profiles"
                value={String(health.activeParserProfiles)}
                tone={health.activeParserProfiles > 0 ? 'good' : 'bad'}
              />
              <Row
                label="Stalled imports"
                value={String(health.stalledBatches)}
                tone={health.stalledBatches > 0 ? 'bad' : 'good'}
              />
              <Row
                label="Oldest review waiting"
                value={health.oldestUnresolvedReviewDays === null ? 'none' : `${health.oldestUnresolvedReviewDays} day(s)`}
                tone={(health.oldestUnresolvedReviewDays ?? 0) > 3 ? 'warn' : 'neutral'}
              />
            </dl>
            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-sm">
              <Small label="People" value={health.repository.people} />
              <Small label="Bookings" value={health.repository.bookings} />
              <Small label="Observations" value={health.repository.observations} />
            </dl>
          </Panel>

          <Panel
            title="Reports"
            description={`${summary.reports.draft} draft · ${summary.reports.reviewed} reviewed · ${summary.reports.approvedNotPrinted} approved and not yet printed`}
          >
            {reports.length === 0 ? (
              <EmptyState title="No reports generated" />
            ) : (
              <ul className="space-y-2">
                {reports.slice(0, 6).map((report) => (
                  <li key={report.reportId} className="flex flex-wrap items-center gap-2 text-sm">
                    <ReportStateBadge state={report.approvalState} />
                    <span className="text-gray-700">{report.rowCount} row(s)</span>
                    <span className="text-xs text-gray-400">{formatDateTime(report.generatedAt)}</span>
                    {report.printCount > 0 ? (
                      <span className="text-xs text-gray-500">
                        <Printer className="mr-0.5 inline h-3 w-3" />
                        printed {report.printCount}×
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Link to="/admin/intelligence/reports" className="text-sm font-medium text-blue-600 hover:underline">
                Approve and print reports <ArrowRight className="inline h-3 w-3" />
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** One sentence, sized to be read across the room. */
function Headline({ summary }: { summary: MorningSummary }) {
  const { posture, headline } = summary;
  const Icon = posture === 'ok' ? CheckCircle2 : posture === 'attention' ? Clock : XCircle;
  const styles = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    attention: 'border-amber-200 bg-amber-50 text-amber-900',
    action_required: 'border-red-200 bg-red-50 text-red-900',
  } as const;
  const iconTone = {
    ok: 'text-emerald-600',
    attention: 'text-amber-600',
    action_required: 'text-red-600',
  } as const;

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${styles[posture]}`} data-testid="morning-headline">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconTone[posture]}`} />
      <p className="text-base font-medium leading-snug">{headline}</p>
    </div>
  );
}

function Row({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
}) {
  const colours = {
    neutral: 'text-gray-900', good: 'text-emerald-700',
    warn: 'text-amber-700', bad: 'text-red-700', info: 'text-blue-700',
  };
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`font-medium tabular-nums ${colours[tone]}`}>{value}</dd>
    </div>
  );
}

function Figure({
  label,
  value,
  to,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  to?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'primary';
}) {
  const colours = {
    neutral: 'text-gray-900', good: 'text-emerald-700', warn: 'text-amber-700',
    bad: 'text-red-700', primary: 'text-blue-700',
  };
  const body = (
    <>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${colours[tone]}`}>{value}</p>
    </>
  );
  return to ? (
    <Link to={to} className="rounded-lg border border-gray-200 px-3 py-2 transition hover:border-blue-300 hover:bg-blue-50/40">
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border border-gray-200 px-3 py-2">{body}</div>
  );
}

function Small({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-gray-900">{value.toLocaleString()}</dd>
    </div>
  );
}

export function ReportStateBadge({ state }: { state: string }) {
  const tones: Record<string, 'neutral' | 'info' | 'good' | 'warn'> = {
    draft: 'neutral', reviewed: 'info', approved: 'good', printed: 'good', archived: 'neutral',
  };
  return <Badge tone={tones[state] ?? 'neutral'}>{state}</Badge>;
}

export { formatDuration };
export default OperationsConsole;
