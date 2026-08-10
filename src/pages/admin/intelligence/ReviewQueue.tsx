// The review queue.
//
// One card per record the resolver would not decide. The card shows the subject and
// the candidate side by side, because "is this the same person" cannot be answered
// from a name and a score — a reviewer who has to open another screen to see who the
// candidate is will approve on the name alone.
//
// The consequence of a decision is stated on the card rather than assumed: until a
// decision is made, this booking does not exist in the repository. That is not
// obvious, and a reviewer who thinks they are annotating rather than writing will
// leave the queue to grow.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, UserPlus, X } from 'lucide-react';

import { intelligenceApi, type ReviewItem } from '@/services/inmateIntelligenceApi';
import {
  Badge, Button, Confidence, EmptyState, ErrorNotice, Loading, PageHeader, Panel, formatMoney,
} from './shared';

export function ReviewQueue() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await intelligenceApi.reviewQueue({ limit: 25 });
      setItems(result.results);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The review queue could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (
    recordId: string,
    decision: 'approve_merge' | 'reject_merge' | 'create_new_person',
    note?: string,
  ) => {
    setError(null);
    setNotice(null);
    try {
      const result = await intelligenceApi.decideReview(recordId, decision, note);
      setNotice(
        result.createdPerson
          ? 'A new person was created and the booking attached to them.'
          : 'The merge was approved and the booking attached to the existing person.',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The decision could not be recorded.');
    }
  };

  if (loading) return <Loading label="Loading the review queue" />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Review queue"
        subtitle={`${total} record${total === 1 ? '' : 's'} the resolver would not decide. Until a decision is made, these bookings do not exist in the repository.`}
      />

      {error ? <ErrorNotice message={error} onRetry={() => void load()} /> : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      {items.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nothing awaiting review"
            detail="Every record from every import was decided by the merge policy."
          />
        </Panel>
      ) : (
        <div className="space-y-6">
          {items.map((item) => (
            <ReviewCard key={item.recordId} item={item} onDecide={decide} />
          ))}
        </div>
      )}

      {total > items.length ? (
        <p className="text-center text-xs text-gray-500">
          Showing {items.length} of {total}. Decide these and the next will load.
        </p>
      ) : null}
    </div>
  );
}

function ReviewCard({
  item,
  onDecide,
}: {
  item: ReviewItem;
  onDecide: (
    recordId: string,
    decision: 'approve_merge' | 'reject_merge' | 'create_new_person',
    note?: string,
  ) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const evidence = item.evidence ?? {};
  const reasons = evidence.reasons ?? [];
  const conflicts = evidence.conflicts ?? [];

  const act = async (decision: 'approve_merge' | 'reject_merge' | 'create_new_person') => {
    // Enforced here as well as on the server, so the reviewer is told before the
    // round trip rather than after it.
    if (decision === 'reject_merge' && !note.trim()) {
      setLocalError('Rejecting a merge requires a reason, so a later reviewer looking at similar evidence knows why these were held apart.');
      return;
    }
    setLocalError(null);
    setBusy(true);
    try {
      await onDecide(item.recordId, decision, note.trim() || undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title={item.subject ? `${item.subject.last}, ${item.subject.first}` : 'Unnamed record'}
      description={`${item.batch.filename} · row ${item.lineNumber} · roster ${item.batch.rosterDate ?? 'unspecified'}`}
      actions={
        <span className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{item.tier ?? 'no tier'}</span>
          <Confidence value={item.confidence} />
        </span>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">The roster says</p>
          {item.subject ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Pair label="Date of birth" value={item.subject.dateOfBirth} />
              <Pair label="Sex" value={item.subject.sex} />
              <Pair label="Race" value={item.subject.race} />
              <Pair label="Booked" value={item.subject.bookedAt?.slice(0, 10)} />
              <Pair label="Booking number" value={item.subject.externalBookingId} />
              <Pair label="Facility person id" value={item.subject.externalPersonId} />
              <Pair label="Housing" value={item.subject.housingLocation} />
              <Pair
                label="Bail"
                value={item.subject.bailAmountCents !== null ? formatMoney((item.subject.bailAmountCents / 100).toFixed(2)) : null}
              />
            </dl>
          ) : (
            <p className="mt-2 text-sm text-gray-400">The normalized record is unavailable.</p>
          )}

          {item.subject && item.subject.charges.length > 0 ? (
            <div className="mt-3 border-t border-gray-100 pt-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Charges</p>
              <ul className="mt-1 space-y-0.5">
                {item.subject.charges.map((charge, index) => (
                  <li key={index} className="text-xs text-gray-700">
                    <span className="font-medium">{charge.statuteCode ?? '—'}</span>
                    {charge.description ? ` · ${charge.description}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className={`rounded-lg border p-3 ${item.candidate ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {item.candidate ? 'Might be this person' : 'No candidate'}
          </p>
          {item.candidate ? (
            <>
              <Link
                to={`/admin/intelligence/persons/${item.candidate.inmateId}`}
                className="mt-1 block text-sm font-semibold text-blue-700 hover:underline"
              >
                {item.candidate.name}
              </Link>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Pair label="Date of birth" value={item.candidate.dateOfBirth} />
                <Pair label="Sex" value={item.candidate.sex} />
                <Pair label="Bookings" value={String(item.candidate.bookingCount)} />
                <Pair label="Last seen" value={item.candidate.lastSeenAt} />
              </dl>

              {item.candidate.externalIds.length > 0 ? (
                <p className="mt-2 font-mono text-xs text-gray-600">{item.candidate.externalIds.join(', ')}</p>
              ) : null}

              {item.candidate.aliases.length > 0 ? (
                <div className="mt-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Known as</p>
                  <p className="mt-0.5 text-xs text-gray-700">
                    {item.candidate.aliases.map((a) => a.name).join(' · ')}
                  </p>
                </div>
              ) : null}

              {item.candidate.recentBookings.length > 0 ? (
                <div className="mt-2 border-t border-blue-100 pt-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Recent bookings</p>
                  <ul className="mt-1 space-y-0.5">
                    {item.candidate.recentBookings.map((booking) => (
                      <li key={booking.bookingId} className="text-xs text-gray-700">
                        <span className="tabular-nums">{booking.bookedAt ?? '—'}</span>
                        {booking.externalBookingId ? ` · ${booking.externalBookingId}` : ''}
                        {booking.releasedAt ? ` · released ${booking.releasedAt}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              The resolver found nobody to compare against. Creating a new person is the only decision available.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Why this is here</p>
          <p className="mt-1 text-sm text-gray-700">
            {evidence.reviewRationale ?? 'The merge policy declined to decide automatically.'}
          </p>
          {evidence.policyRule ? (
            <p className="mt-1 text-xs text-gray-500">
              Policy rule: <span className="font-mono">{evidence.policyRule}</span>
            </p>
          ) : null}
          {evidence.candidateSetTruncated ? (
            <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
              The candidate search hit its limit, so a better match may exist that was never considered.
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          {reasons.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Supporting</p>
              <ul className="mt-1 space-y-0.5">
                {reasons.map((reason) => (
                  <li key={reason.code} className="text-xs text-gray-700">
                    <span className="tabular-nums text-emerald-700">+{reason.weight}</span> {reason.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {conflicts.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Disagreeing</p>
              <ul className="mt-1 space-y-0.5">
                {conflicts.map((conflict) => (
                  <li key={conflict.code} className="text-xs text-gray-700">
                    {conflict.blocking ? <Badge tone="bad">blocking</Badge> : <Badge tone="warn">noted</Badge>}{' '}
                    {conflict.detail}
                    {conflict.existing || conflict.incoming ? (
                      <span className="text-gray-500">
                        {' '}({conflict.existing ?? '—'} vs {conflict.incoming ?? '—'})
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Nothing in the evidence disagreed with the match.</p>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <label className="block text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Reason (required to reject)
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="What made this decision the right one?"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            data-testid={`review-note-${item.recordId}`}
          />
        </label>

        {localError ? <p className="mt-2 text-xs text-red-600">{localError}</p> : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => void act('approve_merge')}
            disabled={busy || !item.candidate}
            title={item.candidate ? undefined : 'There is no candidate to merge into'}
            testId={`approve-${item.recordId}`}
          >
            <Check className="h-3.5 w-3.5" /> Approve merge
          </Button>
          <Button
            variant="danger"
            onClick={() => void act('reject_merge')}
            disabled={busy || !item.candidate}
            title={item.candidate ? undefined : 'There is no candidate to reject'}
            testId={`reject-${item.recordId}`}
          >
            <X className="h-3.5 w-3.5" /> Reject merge
          </Button>
          <Button
            variant="secondary"
            onClick={() => void act('create_new_person')}
            disabled={busy}
            testId={`create-${item.recordId}`}
          >
            <UserPlus className="h-3.5 w-3.5" /> Create new person
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Approving attaches this booking to the existing person. Rejecting and creating both make a separate person —
          rejecting records that the candidate was considered and ruled out.
        </p>
      </div>
    </Panel>
  );
}

function Pair({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-900">{value || <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}

export default ReviewQueue;
