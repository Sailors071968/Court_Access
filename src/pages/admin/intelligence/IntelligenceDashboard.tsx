// The dashboard: what the last processing run found.
//
// Scoped to a day rather than a batch, because a day's work is two files and the
// operator's question is about the roster. It polls while anything is still
// processing, so the numbers fill in as the import runs rather than after a reload.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Upload } from 'lucide-react';

import { intelligenceApi, type DashboardSummary } from '@/services/inmateIntelligenceApi';
import {
  Badge, Button, EmptyState, ErrorNotice, Loading, PageHeader, Panel, PrintButton, Stat,
  TableShell, Td, Th, formatBytes, formatDateTime, formatDuration, printHtmlDocument, severityTone, statusTone,
} from './shared';

export function IntelligenceDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const pollTimer = useRef<number | null>(null);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      setSummary(await intelligenceApi.dashboard());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The dashboard could not be loaded.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  // Poll only while something is in flight. A dashboard that polls a finished import
  // forever is a request every three seconds for numbers that cannot change.
  useEffect(() => {
    const busy = summary?.uploads.some((u) => u.status === 'processing' || u.status === 'queued') ?? false;
    if (!busy) {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
      return;
    }
    pollTimer.current = window.setTimeout(() => void load(false), 2500);
    return () => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
  }, [summary, load]);

  const print = async () => {
    setPrinting(true);
    setPrintError(null);
    try {
      const rosterDate = summary?.session.rosterDates[0];
      const html = await intelligenceApi.report(
        rosterDate ? { from: rosterDate, to: rosterDate } : {},
      );
      printHtmlDocument(html, setPrintError);
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'The report could not be generated.');
    } finally {
      setPrinting(false);
    }
  };

  if (loading) return <Loading label="Loading the intelligence dashboard" />;
  if (error) return <ErrorNotice message={error} onRetry={() => void load(true)} />;
  if (!summary) return null;

  const { session, results, repository } = summary;
  const busy = summary.uploads.some((u) => u.status === 'processing' || u.status === 'queued');

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="New Inmate Intelligence"
        subtitle={
          session.filesProcessed === 0
            ? 'No roster has been processed yet.'
            : `${session.filesProcessed} file${session.filesProcessed === 1 ? '' : 's'} processed on ${session.date}${session.isToday ? ' (today)' : ''}${session.rosterDates.length ? ` · roster ${session.rosterDates.join(', ')}` : ''}`
        }
        actions={
          <>
            <Link to="/admin/intelligence/upload">
              <Button variant="primary" testId="go-to-upload">
                <Upload className="h-3.5 w-3.5" /> Upload files
              </Button>
            </Link>
            <PrintButton onClick={() => void print()} label={printing ? 'Preparing…' : "Print today's report"} />
          </>
        }
      />

      {busy ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          An import is running. These numbers update as it progresses.
        </div>
      ) : null}

      {printError ? <ErrorNotice message={printError} /> : null}

      {session.filesProcessed === 0 ? (
        <Panel>
          <EmptyState
            title="Nothing has been processed yet"
            detail="Upload today's Sacramento County CSV and PDF, then press Process Import. This dashboard will show what the roster contained."
          />
        </Panel>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="New inmates"
              value={results.newInmates}
              tone="primary"
              hint="Never seen in the repository before"
            />
            <Stat
              label="Returning inmates"
              value={results.returningInmates}
              hint="Booked again after a prior stay"
            />
            <Stat
              label="Known inmates"
              value={results.knownInmates}
              hint="Rows restating a booking already held"
            />
            <Stat
              label="Review required"
              value={results.reviewRequired}
              tone={results.reviewRequired > 0 ? 'warn' : 'good'}
              hint={results.reviewRequired > 0 ? 'A person must decide these' : 'Nothing awaiting a decision'}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Conflicts"
              value={results.conflicts}
              tone={results.conflicts > 0 ? 'warn' : 'neutral'}
              hint="Sources disagreeing about the same booking"
            />
            <Stat label="Processing time" value={formatDuration(session.processingTimeMs)} hint="Across the day's imports" />
            <Stat label="Files processed" value={session.filesProcessed} hint={session.facilities.join(', ') || undefined} />
            <Stat
              label="Records read"
              value={results.recordsRead}
              hint={results.failed > 0 ? `${results.failed} row(s) failed` : 'Every row parsed'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Where to go next"
              description="The screens that act on what this import found."
            >
              <div className="space-y-2">
                <NextStep
                  to="/admin/intelligence/new-inmates"
                  label="Today's new inmates"
                  count={results.newInmates}
                  detail="The primary output: everyone the jail booked who has no prior record here."
                />
                <NextStep
                  to="/admin/intelligence/review"
                  label="Review queue"
                  count={repository.awaitingReview}
                  detail="Records the resolver would not decide. Until decided, their bookings do not exist."
                  tone={repository.awaitingReview > 0 ? 'warn' : 'neutral'}
                />
                <NextStep
                  to="/admin/intelligence/import-history"
                  label="Import history"
                  count={session.filesProcessed}
                  detail="Every run, with its duration, operator, and what it concluded."
                />
              </div>
            </Panel>

            <Panel title="Repository" description="Standing totals, for context.">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Figure label="People" value={repository.people} />
                <Figure label="Bookings" value={repository.bookings} />
                <Figure label="Currently in custody" value={repository.inCustody} />
                <Figure label="Unresolved conflicts" value={repository.unresolvedConflicts} />
              </dl>
              {results.departures > 0 ? (
                <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  {results.departures} booking{results.departures === 1 ? '' : 's'} the jail stopped listing. That is a
                  departure from the roster, not a recorded release — the facility published no release date.
                </p>
              ) : null}
            </Panel>
          </div>

          <Panel
            title="Files in this session"
            description="What was uploaded and what processing them did."
          >
            {summary.uploads.length === 0 ? (
              <EmptyState title="No uploads recorded for this day" />
            ) : (
              <TableShell>
                <thead>
                  <tr>
                    <Th>File</Th>
                    <Th>Type</Th>
                    <Th>Size</Th>
                    <Th>Uploaded by</Th>
                    <Th>Uploaded</Th>
                    <Th>Status</Th>
                    <Th align="right">Duration</Th>
                  </tr>
                </thead>
                <tbody>
                  {summary.uploads.map((u) => (
                    <tr key={u.uploadId}>
                      <Td className="font-medium text-gray-900">{u.filename}</Td>
                      <Td className="uppercase text-gray-500">{u.fileKind}</Td>
                      <Td>{formatBytes(u.sizeBytes)}</Td>
                      <Td>{u.uploadedByName ?? '—'}</Td>
                      <Td>{formatDateTime(u.uploadedAt)}</Td>
                      <Td>
                        <Badge tone={statusTone(u.status)}>
                          {u.status === 'processing' && u.stage ? `${u.status} · ${u.stage}` : u.status}
                        </Badge>
                      </Td>
                      <Td align="right">{formatDuration(u.durationMs)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </Panel>

          {summary.issues.length > 0 ? (
            <Panel
              title={`Issues (${summary.issues.length})`}
              description="Everything the parser and resolver reported. A warning is worth reading; an error stopped something."
            >
              <ul className="space-y-2">
                {summary.issues.slice(0, 25).map((issue, index) => (
                  <li key={`${issue.code}-${index}`} className="flex flex-wrap items-start gap-2 text-sm">
                    <Badge tone={severityTone(issue.severity)}>{issue.severity}</Badge>
                    <span className="font-mono text-xs text-gray-500">{issue.code}</span>
                    {issue.lineNumber !== null ? (
                      <span className="text-xs text-gray-400">line {issue.lineNumber}</span>
                    ) : null}
                    <span className="flex-1 text-gray-700">{issue.message}</span>
                  </li>
                ))}
              </ul>
              {summary.issues.length > 25 ? (
                <p className="mt-3 text-xs text-gray-500">
                  Showing 25 of {summary.issues.length}. The rest are on the import history for this batch.
                </p>
              ) : null}
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}

function NextStep({
  to,
  label,
  count,
  detail,
  tone = 'neutral',
}: {
  to: string;
  label: string;
  count: number;
  detail: string;
  tone?: 'neutral' | 'warn';
}) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 transition hover:border-blue-300 hover:bg-blue-50/40"
    >
      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{label}</span>
          <Badge tone={tone === 'warn' && count > 0 ? 'warn' : 'neutral'}>{count}</Badge>
        </span>
        <span className="mt-0.5 block text-xs text-gray-500">{detail}</span>
      </span>
    </Link>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{value.toLocaleString()}</dd>
    </div>
  );
}

export default IntelligenceDashboard;
