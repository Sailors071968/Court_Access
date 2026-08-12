// Import history: one row per processing run.
//
// Everything a run is required to record — id, time, duration, operator, file, what
// it found, and what went wrong. Issues are loaded on demand rather than with the
// list, because most rows have none and fetching them all would make the common case
// pay for the rare one.

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { intelligenceApi, type ImportHistoryRow } from '@/services/inmateIntelligenceApi';
import {
  Badge, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
  TableShell, Td, Th, formatBytes, formatDateTime, formatDuration, severityTone, statusTone,
} from './shared';

interface Issue { severity: string; code: string; message: string; lineNumber: number | null }

export function ImportHistory() {
  const [rows, setRows] = useState<ImportHistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, Issue[] | 'loading' | 'error'>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await intelligenceApi.importHistory({ limit: 100 });
      setRows(result.results);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The import history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (row: ImportHistoryRow) => {
    if (expanded === row.batchId) {
      setExpanded(null);
      return;
    }
    setExpanded(row.batchId);

    if (row.issueCount === 0 || issues[row.batchId]) return;
    setIssues((current) => ({ ...current, [row.batchId]: 'loading' }));
    try {
      const result = await intelligenceApi.batchIssues(row.batchId);
      setIssues((current) => ({ ...current, [row.batchId]: result.issues }));
    } catch {
      setIssues((current) => ({ ...current, [row.batchId]: 'error' }));
    }
  };

  if (loading) return <Loading label="Loading import history" />;

  return (
    <div className="mx-auto max-w-[100rem] space-y-6">
      <PageHeader
        title="Import history"
        subtitle={`${total} processing run${total === 1 ? '' : 's'}. Every run records its own duration, operator, and what it concluded.`}
      />

      {error ? <ErrorNotice message={error} onRetry={() => void load()} /> : null}

      <Panel>
        {rows.length === 0 ? (
          <EmptyState title="No imports yet" detail="Upload and process a roster to create the first entry." />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th />
                <Th>Started</Th>
                <Th align="right">Duration</Th>
                <Th>Operator</Th>
                <Th>File</Th>
                <Th>Roster date</Th>
                <Th align="right">Read</Th>
                <Th align="right">New</Th>
                <Th align="right">Returning</Th>
                <Th align="right">Duplicate</Th>
                <Th align="right">Review</Th>
                <Th align="right">Errors</Th>
                <Th align="right">Warnings</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isOpen = expanded === row.batchId;
                const rowIssues = issues[row.batchId];
                return (
                  <>
                    <tr
                      key={row.batchId}
                      onClick={() => void toggle(row)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <Td>
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">{formatDateTime(row.startedAt)}</Td>
                      <Td align="right" className="whitespace-nowrap tabular-nums">{formatDuration(row.durationMs)}</Td>
                      <Td className="max-w-[12rem] truncate">{row.operator ?? '—'}</Td>
                      <Td>
                        <span className="text-sm text-gray-900">{row.filename}</span>
                        <span className="block text-xs uppercase text-gray-400">
                          {row.fileKind}
                          {row.sizeBytes ? ` · ${formatBytes(row.sizeBytes)}` : ''}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums">{row.rosterDate ?? '—'}</Td>
                      <Td align="right" className="tabular-nums">{row.recordsTotal}</Td>
                      <Td align="right" className="tabular-nums font-medium text-blue-700">{row.newInmates}</Td>
                      <Td align="right" className="tabular-nums">{row.matched}</Td>
                      <Td align="right" className="tabular-nums text-gray-500">{row.duplicates}</Td>
                      <Td align="right" className="tabular-nums">
                        {row.reviewRequired > 0 ? <Badge tone="warn">{row.reviewRequired}</Badge> : '0'}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {row.errors > 0 ? <Badge tone="bad">{row.errors}</Badge> : '0'}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {row.warnings > 0 ? <Badge tone="warn">{row.warnings}</Badge> : '0'}
                      </Td>
                      <Td><Badge tone={statusTone(row.status)}>{row.status}</Badge></Td>
                    </tr>

                    {isOpen ? (
                      <tr key={`${row.batchId}-detail`} className="bg-gray-50">
                        <Td />
                        <td colSpan={13} className="border-b border-gray-100 px-3 py-3">
                          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
                            <Meta label="Import ID" value={row.batchId} mono />
                            <Meta label="Content hash" value={`${row.sha256.slice(0, 24)}…`} mono />
                            <Meta label="Trigger" value={row.trigger} />
                            <Meta label="Facility" value={row.facility} />
                            <Meta label="Roster kind" value={row.rosterKind.replace(/_/g, ' ')} />
                            <Meta label="Parser version" value={row.parserVersion !== null ? `v${row.parserVersion}` : 'no profile'} />
                            <Meta label="Normalization" value={row.normalizationVersion ?? '—'} />
                            <Meta label="Finished" value={formatDateTime(row.finishedAt)} />
                          </dl>

                          {row.failureReason ? (
                            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                              {row.failureReason}
                            </p>
                          ) : null}

                          {row.issueCount > 0 ? (
                            <div className="mt-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Issues ({row.issueCount})
                              </p>
                              {rowIssues === 'loading' ? (
                                <p className="mt-1 text-xs text-gray-500">Loading…</p>
                              ) : rowIssues === 'error' ? (
                                <p className="mt-1 text-xs text-red-600">The issues could not be loaded.</p>
                              ) : Array.isArray(rowIssues) ? (
                                <ul className="mt-1 space-y-1">
                                  {rowIssues.slice(0, 30).map((issue, index) => (
                                    <li key={`${issue.code}-${index}`} className="flex flex-wrap items-start gap-2 text-xs">
                                      <Badge tone={severityTone(issue.severity)}>{issue.severity}</Badge>
                                      <span className="font-mono text-gray-500">{issue.code}</span>
                                      {issue.lineNumber !== null ? (
                                        <span className="text-gray-400">line {issue.lineNumber}</span>
                                      ) : null}
                                      <span className="flex-1 text-gray-700">{issue.message}</span>
                                    </li>
                                  ))}
                                  {rowIssues.length > 30 ? (
                                    <li className="text-xs text-gray-500">and {rowIssues.length - 30} more</li>
                                  ) : null}
                                </ul>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-gray-500">No issues were reported by this run.</p>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}

function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className={`mt-0.5 text-gray-900 ${mono ? 'break-all font-mono text-[11px]' : ''}`}>{value}</dd>
    </div>
  );
}

export default ImportHistory;
