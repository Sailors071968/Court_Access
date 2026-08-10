// Everything known about one person, and where each piece came from.
//
// The order is deliberate: who they are, what they have been called, where they are
// now, where they have been, then the evidence. An operator answering "is this the
// person I am looking for" needs the identity and the aliases before anything else;
// an operator asking "how do we know" scrolls to the bottom.

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, FileText } from 'lucide-react';

import { intelligenceApi, type BookingView, type PersonDetail as Detail } from '@/services/inmateIntelligenceApi';
import {
  Badge, Confidence, EmptyState, ErrorNotice, Loading, PageHeader, Panel,
  TableShell, Td, Th, formatDateTime, formatDay, formatMoney, severityTone,
} from './shared';

export function PersonDetailPage() {
  const { inmateId } = useParams<{ inmateId: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!inmateId) return;
    setLoading(true);
    try {
      setDetail(await intelligenceApi.person(inmateId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This person could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [inmateId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading the person record" />;
  if (error) return <ErrorNotice message={error} onRetry={() => void load()} />;
  if (!detail) return null;

  const { identity } = detail;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="print:hidden">
        <Link to="/admin/intelligence/new-inmates" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to new inmates
        </Link>
      </div>

      <PageHeader
        title={identity.name}
        subtitle={[
          identity.dateOfBirth ? `DOB ${identity.dateOfBirth}` : 'Date of birth unknown',
          identity.sex ?? null,
          identity.race ?? null,
          `${identity.bookingCount} booking${identity.bookingCount === 1 ? '' : 's'} on record`,
        ].filter(Boolean).join(' · ')}
        actions={
          <span className="flex items-center gap-2">
            {identity.onWatchList ? <Badge tone="warn"><Eye className="mr-1 inline h-3 w-3" />On a watch list</Badge> : null}
            <Confidence value={identity.identityConfidence} />
          </span>
        }
      />

      {identity.mergedIntoId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This record has been merged into another person.{' '}
          <Link to={`/admin/intelligence/persons/${identity.mergedIntoId}`} className="font-medium underline">
            Open the surviving record
          </Link>
          .
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Identity" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <Field label="Last name" value={identity.last} />
            <Field label="First name" value={identity.first} />
            <Field label="Middle" value={identity.middle} />
            <Field label="Suffix" value={identity.suffix} />
            <Field label="Date of birth" value={identity.dateOfBirth} />
            <Field label="Sex" value={identity.sex} />
            <Field label="Race" value={identity.race} />
            <Field label="First seen" value={formatDay(identity.firstSeenAt)} />
            <Field label="Last seen" value={formatDay(identity.lastSeenAt)} />
          </dl>

          {identity.externalIds.length > 0 ? (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Facility identifiers
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                The jail's own person number. The strongest identity evidence available.
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {identity.externalIds.map((external) => (
                  <li key={`${external.facility}-${external.externalId}`}>
                    <Badge tone="info">
                      {external.facility}: {external.externalId}
                      {external.occurrences > 1 ? ` (seen ${external.occurrences}×)` : ''}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>

        <Panel title="Known aliases" description={`${detail.aliases.length} spelling${detail.aliases.length === 1 ? '' : 's'} recorded.`}>
          {detail.aliases.length === 0 ? (
            <EmptyState title="No aliases recorded" />
          ) : (
            <ul className="space-y-2 text-sm">
              {detail.aliases.map((alias) => (
                <li key={alias.aliasId} className="flex items-start justify-between gap-2">
                  <span>
                    <span className="font-medium text-gray-900">{alias.name}</span>
                    {alias.dateOfBirth ? (
                      <span className="block text-xs text-gray-500">DOB {alias.dateOfBirth}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-400">{alias.occurrences}×</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Current booking"
        description={detail.currentBooking ? undefined : 'Not currently in custody according to the most recent roster.'}
      >
        {detail.currentBooking ? <BookingBlock booking={detail.currentBooking} current /> : <EmptyState title="No current booking" />}
      </Panel>

      <Panel
        title={`Historical bookings (${detail.historicalBookings.length})`}
        description="Every prior stay, newest first."
      >
        {detail.historicalBookings.length === 0 ? (
          <EmptyState title="No prior bookings recorded" detail="This is the only booking this repository holds for this person." />
        ) : (
          <div className="space-y-4">
            {detail.historicalBookings.map((booking) => (
              <BookingBlock key={booking.bookingId} booking={booking} />
            ))}
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Timeline" description="Bookings, releases and material changes in one chronology.">
          {detail.timeline.length === 0 ? (
            <EmptyState title="Nothing on the timeline yet" />
          ) : (
            <ol className="space-y-3">
              {detail.timeline.slice(0, 40).map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="flex gap-3">
                  <span className="w-24 shrink-0 text-xs tabular-nums text-gray-500">{formatDay(entry.at)}</span>
                  <span className="flex-1">
                    <span className="text-sm font-medium text-gray-900">{entry.label}</span>
                    {entry.detail ? <span className="block text-xs text-gray-500">{entry.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Bail history" description="What each source stated, when.">
            {detail.bailHistory.length === 0 ? (
              <EmptyState title="No bail figure has been published for this person" />
            ) : (
              <TableShell>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Source</Th>
                    <Th align="right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {detail.bailHistory.map((entry, index) => (
                    <tr key={`${entry.at}-${index}`}>
                      <Td className="tabular-nums">{entry.at}</Td>
                      <Td className="text-xs uppercase text-gray-500">{entry.source}</Td>
                      <Td align="right" className="tabular-nums">{formatMoney(entry.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </Panel>

          <Panel title="Housing history" description="Where the jail reported holding them.">
            {detail.housingHistory.length === 0 ? (
              <EmptyState title="No housing location has been published" />
            ) : (
              <TableShell>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Source</Th>
                    <Th>Location</Th>
                  </tr>
                </thead>
                <tbody>
                  {detail.housingHistory.map((entry, index) => (
                    <tr key={`${entry.at}-${index}`}>
                      <Td className="tabular-nums">{entry.at}</Td>
                      <Td className="text-xs uppercase text-gray-500">{entry.source}</Td>
                      <Td>{entry.location ?? '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </Panel>
        </div>
      </div>

      <Panel
        title={`Intelligence (${detail.intelligence.length})`}
        description="What the engines concluded about this person, and whether it was applied or is awaiting a decision."
      >
        {detail.intelligence.length === 0 ? (
          <EmptyState title="No intelligence recorded" />
        ) : (
          <ul className="space-y-3">
            {detail.intelligence.map((item) => (
              <li key={item.itemId} className="rounded-lg border border-gray-200 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={severityTone(item.severity)}>{item.type.replace(/_/g, ' ')}</Badge>
                  <span className="text-xs text-gray-500">{item.engine}</span>
                  <Confidence value={item.confidence} />
                  <Badge tone={item.disposition === 'proposed' ? 'warn' : 'neutral'}>{item.disposition.replace(/_/g, ' ')}</Badge>
                  <span className="ml-auto text-xs text-gray-400">{formatDay(item.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-sm text-gray-700">{item.explanation}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title={`Evidence (${detail.evidence.length})`}
        description="Every source statement behind this record, down to the document and the row it came from."
      >
        {detail.evidence.length === 0 ? (
          <EmptyState title="No observations recorded" />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Roster date</Th>
                <Th>Source</Th>
                <Th>Document</Th>
                <Th align="right">Page</Th>
                <Th align="right">Row</Th>
                <Th>Recorded</Th>
              </tr>
            </thead>
            <tbody>
              {detail.evidence.map((entry) => (
                <tr key={entry.observationId}>
                  <Td className="tabular-nums">{entry.rosterDate ?? '—'}</Td>
                  <Td className="text-xs uppercase text-gray-500">{entry.sourceType}</Td>
                  <Td>
                    {entry.document ? (
                      <span className="flex items-start gap-1.5">
                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span>
                          <span className="text-sm text-gray-900">{entry.document.filename}</span>
                          <span className="block font-mono text-[10px] text-gray-400">
                            {entry.document.sha256.slice(0, 16)}…
                          </span>
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </Td>
                  <Td align="right" className="tabular-nums">{entry.sourcePage ?? '—'}</Td>
                  <Td align="right" className="tabular-nums">{entry.sourceRow ?? '—'}</Td>
                  <Td className="whitespace-nowrap text-xs text-gray-500">{formatDateTime(entry.observedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>

      <Panel
        title={`Import history (${detail.importHistory.length})`}
        description="Which imports touched this person, and how the resolver decided each time."
      >
        {detail.importHistory.length === 0 ? (
          <EmptyState title="No import records" />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Roster date</Th>
                <Th>File</Th>
                <Th>Resolution</Th>
                <Th>Tier</Th>
                <Th align="center">Confidence</Th>
                <Th align="right">Row</Th>
                <Th>Imported</Th>
              </tr>
            </thead>
            <tbody>
              {detail.importHistory.map((entry) => (
                <tr key={entry.recordId}>
                  <Td className="tabular-nums">{entry.rosterDate ?? '—'}</Td>
                  <Td>
                    <span className="text-sm text-gray-900">{entry.filename}</span>
                    <span className="block text-xs uppercase text-gray-400">{entry.sourceType}</span>
                  </Td>
                  <Td>
                    <Badge tone={entry.resolution === 'needs_review' ? 'warn' : entry.resolution === 'failed' ? 'bad' : 'neutral'}>
                      {entry.resolution.replace(/_/g, ' ')}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-gray-500">{entry.tier ?? '—'}</Td>
                  <Td align="center"><Confidence value={entry.confidence} /></Td>
                  <Td align="right" className="tabular-nums">{entry.lineNumber}</Td>
                  <Td className="whitespace-nowrap text-xs text-gray-500">{formatDateTime(entry.startedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}

function BookingBlock({ booking, current = false }: { booking: BookingView; current?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-3 ${current ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">
          Booked {formatDay(booking.bookedAt)}
        </span>
        {booking.externalBookingId ? (
          <span className="font-mono text-xs text-gray-500">{booking.externalBookingId}</span>
        ) : null}
        {booking.isFirstAppearance ? <Badge tone="info">First appearance</Badge> : null}
        {booking.releasedAt ? (
          <Badge tone="neutral">Released {booking.releasedAt}</Badge>
        ) : booking.departedRosterAt ? (
          // Said carefully: absence from a roster is not a published release.
          <Badge tone="warn" >No longer listed as of {booking.departedRosterAt}</Badge>
        ) : (
          <Badge tone="good">In custody</Badge>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Field label="Facility" value={booking.facility} />
        <Field label="Housing" value={booking.housingLocation} />
        <Field label="Bail" value={booking.bailAmount ? formatMoney(booking.bailAmount) : null} />
        <Field label="Arresting agency" value={booking.arrestingAgency} />
      </dl>

      <div className="mt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Charges ({booking.charges.length})
        </p>
        {booking.charges.length === 0 ? (
          <p className="mt-1 text-sm text-gray-400">No charges were published for this booking.</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {booking.charges.map((charge) => (
              <li key={charge.chargeId} className="text-sm">
                <span className="font-medium text-gray-900">
                  {[charge.statuteCode, charge.statuteSection].filter(Boolean).join(' ') || '—'}
                </span>
                {charge.description ? <span className="text-gray-700"> · {charge.description}</span> : null}
                {charge.severity !== 'unknown' ? (
                  <span className="ml-1.5 text-xs text-gray-500">({charge.severity})</span>
                ) : null}
                {charge.counts > 1 ? <span className="ml-1.5 text-xs text-gray-500">×{charge.counts}</span> : null}
                {charge.bailAmount ? (
                  <span className="ml-1.5 text-xs tabular-nums text-gray-500">{formatMoney(charge.bailAmount)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Observed {booking.observationCount} time{booking.observationCount === 1 ? '' : 's'} across the sources.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-900">{value || <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}

export default PersonDetailPage;
