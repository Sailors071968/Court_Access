// Historical search across the whole repository.
//
// Every field is an AND and every name field is matched against aliases as well as
// the canonical record. That is the point of the screen: a person booked last year as
// KATHERINE and this year as CATHERINE must be findable by either, or the historical
// repository is only as good as the most recent spelling.

import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

import { intelligenceApi, type PersonSearchRow } from '@/services/inmateIntelligenceApi';
import {
  Badge, Button, Confidence, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
  TableShell, Td, Th, formatMoney,
} from './shared';

interface Criteria {
  last: string;
  first: string;
  dateOfBirth: string;
  bookingNumber: string;
  externalPersonId: string;
  name: string;
}

const EMPTY: Criteria = {
  last: '', first: '', dateOfBirth: '', bookingNumber: '', externalPersonId: '', name: '',
};

export function HistoricalSearch() {
  const [criteria, setCriteria] = useState<Criteria>(EMPTY);
  const [results, setResults] = useState<PersonSearchRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Criteria) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setCriteria((current) => ({ ...current, [key]: event.target.value }));

  const hasCriteria = Object.values(criteria).some((value) => value.trim() !== '');

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await intelligenceApi.searchPersons({
        last: criteria.last || undefined,
        first: criteria.first || undefined,
        dateOfBirth: criteria.dateOfBirth || undefined,
        bookingNumber: criteria.bookingNumber || undefined,
        externalPersonId: criteria.externalPersonId || undefined,
        name: criteria.name || undefined,
        limit: 200,
      });
      setResults(result.results);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The search failed.');
    } finally {
      setLoading(false);
    }
  }, [criteria]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Historical search"
        subtitle="Every person and every booking this repository holds. Names are matched against aliases as well as the current spelling."
      />

      {error ? <ErrorNotice message={error} /> : null}

      <Panel>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Last name" hint="Matched against aliases too">
              <input value={criteria.last} onChange={set('last')} className={inputClass} data-testid="search-last" />
            </Field>
            <Field label="First name" hint="Matched against aliases too">
              <input value={criteria.first} onChange={set('first')} className={inputClass} data-testid="search-first" />
            </Field>
            <Field label="Date of birth" hint="Exact match, on the record or any alias">
              <input type="date" value={criteria.dateOfBirth} onChange={set('dateOfBirth')} className={inputClass} />
            </Field>
            <Field label="Booking number" hint="The jail's number for one stay">
              <input value={criteria.bookingNumber} onChange={set('bookingNumber')} className={inputClass} />
            </Field>
            <Field label="SO / X-Ref number" hint="The jail's number for the person">
              <input
                value={criteria.externalPersonId}
                onChange={set('externalPersonId')}
                className={inputClass}
                data-testid="search-so"
              />
            </Field>
            <Field label="Any name or alias" hint="Searches first, middle, last and every alias">
              <input value={criteria.name} onChange={set('name')} className={inputClass} />
            </Field>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button type="submit" variant="primary" disabled={loading || !hasCriteria} testId="run-search">
              <Search className="h-3.5 w-3.5" /> {loading ? 'Searching…' : 'Search'}
            </Button>
            {hasCriteria ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setCriteria(EMPTY);
                  setResults(null);
                }}
              >
                Clear
              </Button>
            ) : null}
            {!hasCriteria ? (
              <span className="text-xs text-gray-500">
                Enter at least one criterion. An unfiltered search would return the whole repository.
              </span>
            ) : null}
          </div>
        </form>
      </Panel>

      {loading ? (
        <Loading label="Searching" />
      ) : results === null ? null : (
        <Panel
          title={`${results.length} of ${total} matching`}
          description={total > results.length ? 'Narrow the criteria to see the rest.' : undefined}
        >
          {results.length === 0 ? (
            <EmptyState
              title="Nobody matches those criteria"
              detail="Every criterion must match. Try removing one — a date of birth the jail never published will exclude everyone."
            />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>DOB</Th>
                  <Th>Facility identifiers</Th>
                  <Th align="right">Bookings</Th>
                  <Th align="right">Aliases</Th>
                  <Th>Latest booking</Th>
                  <Th>Status</Th>
                  <Th align="center">Confidence</Th>
                </tr>
              </thead>
              <tbody>
                {results.map((person) => (
                  <tr key={person.inmateId} className="hover:bg-blue-50/40">
                    <Td>
                      <Link
                        to={`/admin/intelligence/persons/${person.inmateId}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {person.name}
                      </Link>
                      {person.onWatchList ? <Badge tone="warn">Watch list</Badge> : null}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">{person.dateOfBirth ?? '—'}</Td>
                    <Td className="font-mono text-xs">
                      {person.externalIds.length > 0 ? person.externalIds.join(', ') : '—'}
                    </Td>
                    <Td align="right" className="tabular-nums">{person.bookingCount}</Td>
                    <Td align="right" className="tabular-nums">{person.aliasCount}</Td>
                    <Td className="whitespace-nowrap">
                      {person.latestBooking ? (
                        <>
                          <span className="tabular-nums">{person.latestBooking.bookedAt ?? '—'}</span>
                          <span className="block text-xs text-gray-500">
                            {person.latestBooking.facility}
                            {person.latestBooking.bailAmount ? ` · ${formatMoney(person.latestBooking.bailAmount)}` : ''}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>
                      {person.latestBooking?.inCustody ? (
                        <Badge tone="good">In custody</Badge>
                      ) : person.latestBooking?.releasedAt ? (
                        <Badge tone="neutral">Released</Badge>
                      ) : (
                        <Badge tone="neutral">Not listed</Badge>
                      )}
                    </Td>
                    <Td align="center"><Confidence value={person.identityConfidence} /></Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </Panel>
      )}
    </div>
  );
}

const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-gray-400">{hint}</span> : null}
    </label>
  );
}

export default HistoricalSearch;
