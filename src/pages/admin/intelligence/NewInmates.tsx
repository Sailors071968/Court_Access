// Today's new inmates — Daily Case set-diff only.
//
// Never shows seed/demo/first-appearance history. If comparison is not finished,
// the page shows Processing / Awaiting comparison / No certified results available.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

import { intelligenceApi, type NewInmateRow } from '@/services/inmateIntelligenceApi';
import {
  Button, Confidence, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
  PrintButton, TableShell, Td, Th, formatDay, formatMoney, printHtmlDocument,
} from './shared';

type SortKey =
  | 'bookedAt' | 'last' | 'first' | 'dateOfBirth' | 'bookingNumber'
  | 'bail' | 'facility' | 'priorBookings' | 'confidence';

const PAGE_SIZE = 200;
const FACILITY = 'sacramento';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewInmates() {
  const [rows, setRows] = useState<NewInmateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [pipelineMessage, setPipelineMessage] = useState<string | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [dailyCaseStatus, setDailyCaseStatus] = useState<string | null>(null);

  const [opsDate, setOpsDate] = useState(todayIso);
  const [term, setTerm] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('bookedAt');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await intelligenceApi.newInmates({
        facility: FACILITY,
        from: opsDate,
        to: opsDate,
        limit: PAGE_SIZE,
      });
      setRows(result.results);
      setTotal(result.total);
      setSource(result.source ?? null);
      setPipelineMessage(result.pipelineMessage ?? null);
      setUnavailableReason(result.unavailableReason ?? null);
      setDailyCaseStatus(result.dailyCaseStatus ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The new inmate list could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [opsDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortOn = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setDirection(key === 'last' || key === 'first' || key === 'facility' ? 'asc' : 'desc');
    }
  };

  const visible = useMemo(() => {
    const needle = term.trim().toUpperCase();

    const filtered = rows.filter((row) => {
      if (reviewOnly && row.identityConfidence >= 90) return false;
      if (!needle) return true;
      const haystack = [
        row.name,
        row.externalBookingId ?? '',
        row.dateOfBirth ?? '',
        row.facility,
        row.arrestingAgency ?? '',
        ...row.charges.map((c) => `${c.statute ?? ''} ${c.description ?? ''} ${c.rawText}`),
      ].join(' ').toUpperCase();
      return haystack.includes(needle);
    });

    const sign = direction === 'asc' ? 1 : -1;
    const compare = (a: NewInmateRow, b: NewInmateRow): number => {
      switch (sortKey) {
        case 'bookedAt': return sign * a.discoveredOn.localeCompare(b.discoveredOn);
        case 'last': return sign * a.name.localeCompare(b.name);
        case 'first': return sign * givenName(a).localeCompare(givenName(b));
        case 'dateOfBirth': return sign * (a.dateOfBirth ?? '').localeCompare(b.dateOfBirth ?? '');
        case 'bookingNumber': return sign * (a.externalBookingId ?? '').localeCompare(b.externalBookingId ?? '');
        case 'bail': return sign * (numeric(a.bailAmount) - numeric(b.bailAmount));
        case 'facility': return sign * a.facility.localeCompare(b.facility);
        case 'priorBookings': return sign * (a.priorArrestCount - b.priorArrestCount);
        case 'confidence': return sign * (a.identityConfidence - b.identityConfidence);
        default: return 0;
      }
    };

    return [...filtered].sort((a, b) => compare(a, b) || a.name.localeCompare(b.name));
  }, [rows, term, reviewOnly, sortKey, direction]);

  const print = async () => {
    setPrinting(true);
    setPrintError(null);
    try {
      const html = await intelligenceApi.report({ date: opsDate, facility: FACILITY });
      printHtmlDocument(html, setPrintError);
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'The report could not be generated.');
    } finally {
      setPrinting(false);
    }
  };

  const emptyTitle = pipelineMessage ?? 'No certified results available';
  const emptyDetail =
    unavailableReason
    ?? 'This page only shows Daily Case set-diff results for Sacramento. Seed or historical first-appearance rows are never shown here.';

  return (
    <div className="mx-auto max-w-[110rem] space-y-6" data-testid="new-inmates-page">
      <PageHeader
        title="Today's new inmates"
        subtitle={`Sacramento · ${opsDate} · Daily Case set-diff only (never seed/demo history)`}
        actions={<PrintButton onClick={() => void print()} label={printing ? 'Preparing…' : 'Print report'} />}
      />

      {error ? <ErrorNotice message={error} onRetry={() => void load()} /> : null}
      {printError ? <ErrorNotice message={printError} /> : null}

      <Panel>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">Ops date</span>
            <input
              type="date"
              value={opsDate}
              onChange={(event) => setOpsDate(event.target.value || todayIso())}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              data-testid="new-inmates-ops-date"
            />
          </label>
          <label className="min-w-[16rem] flex-1 text-sm">
            <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">Search these results</span>
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Name, booking number, charge, agency"
                className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm"
                data-testid="new-inmate-search"
              />
            </span>
          </label>
          <label className="flex items-center gap-2 pb-1.5 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={reviewOnly}
              onChange={(event) => setReviewOnly(event.target.checked)}
              className="rounded border-gray-300"
            />
            Review required only
          </label>
          <Link to="/admin/intelligence" className="pb-1.5 text-sm font-medium text-blue-700 underline">
            Morning Operations
          </Link>
          {(term || reviewOnly || opsDate !== todayIso()) ? (
            <Button
              variant="ghost"
              onClick={() => {
                setOpsDate(todayIso());
                setTerm('');
                setReviewOnly(false);
              }}
            >
              Reset to today
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-gray-500" data-testid="new-inmates-source">
          Source: {source ?? '—'}
          {dailyCaseStatus ? ` · DailyCase ${dailyCaseStatus}` : ''}
        </p>
      </Panel>

      <Panel
        title={
          source === 'unavailable'
            ? emptyTitle
            : `${visible.length} of ${total} newly booked (set-diff)`
        }
        description={
          source === 'unavailable'
            ? emptyDetail
            : total > PAGE_SIZE
              ? `Showing the most recent ${PAGE_SIZE}.`
              : undefined
        }
      >
        {loading ? (
          <Loading label="Loading new inmates" />
        ) : source === 'unavailable' || visible.length === 0 ? (
          <EmptyState
            title={source === 'unavailable' ? emptyTitle : 'No new inmates for this Daily Case'}
            detail={emptyDetail}
          />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th onClick={() => sortOn('bookedAt')} active={sortKey === 'bookedAt'} direction={direction}>Roster date</Th>
                <Th onClick={() => sortOn('last')} active={sortKey === 'last'} direction={direction}>Last name</Th>
                <Th onClick={() => sortOn('first')} active={sortKey === 'first'} direction={direction}>First name</Th>
                <Th onClick={() => sortOn('dateOfBirth')} active={sortKey === 'dateOfBirth'} direction={direction}>DOB</Th>
                <Th onClick={() => sortOn('bookingNumber')} active={sortKey === 'bookingNumber'} direction={direction}>Booking number</Th>
                <Th>Charges</Th>
                <Th onClick={() => sortOn('bail')} active={sortKey === 'bail'} direction={direction}>Bail</Th>
                <Th onClick={() => sortOn('confidence')} active={sortKey === 'confidence'} direction={direction}>Confidence</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.inmateId} className="border-t border-gray-100">
                  <Td>{formatDay(row.discoveredOn)}</Td>
                  <Td className="font-medium text-gray-900">{row.name.split(',')[0]}</Td>
                  <Td>{givenName(row)}</Td>
                  <Td>{row.dateOfBirth ?? '—'}</Td>
                  <Td>{row.externalBookingId ?? '—'}</Td>
                  <Td className="max-w-[18rem] truncate text-xs text-gray-600">
                    {row.charges.map((c) => c.statute ?? c.rawText).filter(Boolean).join('; ') || '—'}
                  </Td>
                  <Td>{formatMoney(row.bailAmount)}</Td>
                  <Td><Confidence value={row.identityConfidence} /></Td>
                  <Td>
                    <Link
                      to={`/admin/intelligence/inmates/${row.inmateId}`}
                      className="text-xs font-medium text-blue-700 underline"
                    >
                      Open
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}

function givenName(row: NewInmateRow): string {
  const parts = row.name.split(',');
  return (parts[1] ?? '').trim();
}

function numeric(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export default NewInmates;
