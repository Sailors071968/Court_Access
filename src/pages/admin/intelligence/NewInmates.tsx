// Today's new inmates. The most important screen in the subsystem.
//
// Sortable, searchable, printable. Sorting and filtering happen on the rows already
// fetched rather than by re-querying: the page's job is to let an operator work
// through one day's discoveries, and a round trip per column click would make that
// worse, not better. The page size is generous for the same reason.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

import { intelligenceApi, type NewInmateRow } from '@/services/inmateIntelligenceApi';
import {
  Badge, Button, Confidence, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
  PrintButton, TableShell, Td, Th, formatDay, formatMoney, printHtmlDocument,
} from './shared';

type SortKey =
  | 'bookedAt' | 'last' | 'first' | 'dateOfBirth' | 'bookingNumber'
  | 'bail' | 'facility' | 'priorBookings' | 'confidence';

const PAGE_SIZE = 200;

export function NewInmates() {
  const [rows, setRows] = useState<NewInmateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [term, setTerm] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('bookedAt');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await intelligenceApi.newInmates({
        from: from || undefined,
        to: to || undefined,
        limit: PAGE_SIZE,
      });
      setRows(result.results);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The new inmate list could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortOn = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Names read better ascending; everything else is more useful newest or
      // largest first.
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

    // Stable secondary sort by name, so equal values do not reorder between renders.
    return [...filtered].sort((a, b) => compare(a, b) || a.name.localeCompare(b.name));
  }, [rows, term, reviewOnly, sortKey, direction]);

  const print = async () => {
    setPrinting(true);
    setPrintError(null);
    try {
      const html = await intelligenceApi.report({ date: from || undefined });
      printHtmlDocument(html, setPrintError);
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'The report could not be generated.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[110rem] space-y-6">
      <PageHeader
        title="Today's new inmates"
        subtitle="People the jail booked who have no prior record in this repository. Newly discovered, recorded at import time and never recomputed."
        actions={<PrintButton onClick={() => void print()} label={printing ? 'Preparing…' : 'Print report'} />}
      />

      {error ? <ErrorNotice message={error} onRetry={() => void load()} /> : null}
      {printError ? <ErrorNotice message={printError} /> : null}

      <Panel>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">Booked from</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">to</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
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
          {(from || to || term || reviewOnly) ? (
            <Button
              variant="ghost"
              onClick={() => {
                setFrom('');
                setTo('');
                setTerm('');
                setReviewOnly(false);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </Panel>

      <Panel
        title={`${visible.length} of ${total} newly discovered`}
        description={
          total > PAGE_SIZE
            ? `Showing the most recent ${PAGE_SIZE}. Narrow the date range to see earlier discoveries.`
            : undefined
        }
      >
        {loading ? (
          <Loading label="Loading new inmates" />
        ) : visible.length === 0 ? (
          <EmptyState
            title={rows.length === 0 ? 'No new inmates in this range' : 'Nothing matches that search'}
            detail={
              rows.length === 0
                ? 'Either no roster has been processed for these dates, or everyone on it was already known.'
                : undefined
            }
          />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th onClick={() => sortOn('bookedAt')} active={sortKey === 'bookedAt'} direction={direction}>Booking date</Th>
                <Th onClick={() => sortOn('last')} active={sortKey === 'last'} direction={direction}>Last name</Th>
                <Th onClick={() => sortOn('first')} active={sortKey === 'first'} direction={direction}>First name</Th>
                <Th onClick={() => sortOn('dateOfBirth')} active={sortKey === 'dateOfBirth'} direction={direction}>DOB</Th>
                <Th onClick={() => sortOn('bookingNumber')} active={sortKey === 'bookingNumber'} direction={direction}>Booking number</Th>
                <Th>Charges</Th>
                <Th onClick={() => sortOn('bail')} active={sortKey === 'bail'} direction={direction} align="right">Bail</Th>
                <Th onClick={() => sortOn('facility')} active={sortKey === 'facility'} direction={direction}>Facility</Th>
                <Th onClick={() => sortOn('priorBookings')} active={sortKey === 'priorBookings'} direction={direction} align="right">Prior bookings</Th>
                <Th onClick={() => sortOn('confidence')} active={sortKey === 'confidence'} direction={direction} align="center">Confidence</Th>
                <Th align="center">Review</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={`${row.inmateId}-${row.provenance.batchId}-${row.externalBookingId ?? row.discoveredOn}`} className="hover:bg-blue-50/40">
                  <Td className="whitespace-nowrap tabular-nums">{formatDay(row.discoveredOn)}</Td>
                  <Td>
                    <Link
                      to={`/admin/intelligence/persons/${row.inmateId}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {surname(row)}
                    </Link>
                  </Td>
                  <Td>{givenName(row)}</Td>
                  <Td className="whitespace-nowrap tabular-nums">{row.dateOfBirth ?? '—'}</Td>
                  <Td className="whitespace-nowrap font-mono text-xs">{row.externalBookingId ?? '—'}</Td>
                  <Td className="max-w-md">
                    {row.charges.length === 0 ? (
                      <span className="text-gray-400">No charges published</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {row.charges.slice(0, 3).map((charge, index) => (
                          <li key={index} className="text-xs">
                            <span className="font-medium text-gray-900">{charge.statute ?? '—'}</span>
                            {charge.description ? <span className="text-gray-600"> · {charge.description}</span> : null}
                            {charge.severity !== 'unknown' ? (
                              <span className="ml-1 text-gray-400">({charge.severity})</span>
                            ) : null}
                          </li>
                        ))}
                        {row.charges.length > 3 ? (
                          <li className="text-xs text-gray-400">and {row.charges.length - 3} more</li>
                        ) : null}
                      </ul>
                    )}
                  </Td>
                  <Td align="right" className="whitespace-nowrap tabular-nums">{formatMoney(row.bailAmount)}</Td>
                  <Td className="whitespace-nowrap">{row.facility}</Td>
                  <Td align="right" className="tabular-nums">
                    {row.priorArrestCount > 0 ? (
                      <Badge tone="info">{row.priorArrestCount}</Badge>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </Td>
                  <Td align="center"><Confidence value={row.identityConfidence} /></Td>
                  <Td align="center">
                    {row.identityConfidence < 90 ? <Badge tone="warn">Yes</Badge> : <span className="text-gray-300">—</span>}
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

/** The list stores "LAST, FIRST"; the grid needs the halves separately. */
function surname(row: NewInmateRow): string {
  return row.name.split(',')[0]?.trim() || row.name;
}
function givenName(row: NewInmateRow): string {
  return row.name.split(',')[1]?.trim() || '—';
}

function numeric(amount: string | null): number {
  if (amount === null) return -1;
  const value = Number(amount);
  return Number.isNaN(value) ? -1 : value;
}

export default NewInmates;
