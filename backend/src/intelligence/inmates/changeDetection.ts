// ============================================================================
// Change detection.
//
// The operational question is not "who is in jail" — it is "what is different
// from last time". That splits into two kinds of difference:
//
//   Presence   a person is new, has returned after being released, is still in
//              custody, or has stopped appearing on a roster that lists
//              everyone.
//   Attributes a booking's housing, bail, court date, custody status or charges
//              have moved since the last time a source described it.
//
// Both are computed from observations rather than from the current row, so the
// answer is derived from what sources actually said and can be shown as evidence.
//
// The classification functions here are pure. `detectDepartures` needs the
// repository, because absence can only be judged against a known population.
// ============================================================================

import { createHash } from 'node:crypto';

import type { NormalizedCharge } from './types.js';

/** Every kind of difference this system reports. */
export type ChangeType =
  | 'new_inmate'
  | 'returning_inmate'
  | 'known_inmate'
  | 'released'
  | 'departed_roster'
  | 'housing_change'
  | 'bail_change'
  | 'charge_added'
  | 'charge_removed'
  | 'court_date_change'
  | 'custody_status_change';

export interface ChangeEventDraft {
  changeType: ChangeType;
  field?: string;
  previousValue?: string;
  newValue?: string;
  /** Whether an operator should see it. Not every difference is worth a line. */
  material: boolean;
}

/**
 * A booking's attributes as one source described it.
 *
 * `undefined` means the source did not say, which is not the same as the value
 * being empty. A source that omits a housing location has not told us the person
 * has no cell, so a change is only reported when both sides are known.
 */
export interface ObservationAttributes {
  housingLocation?: string | null;
  bailAmountCents?: bigint | null;
  releasedAt?: Date | null;
  courtDate?: Date | null;
  custodyStatus?: string | null;
  chargeSetHash?: string | null;
  chargeCount?: number | null;
}

/** Stable identity of a charge set, so a change is detectable without a diff. */
export function chargeSetHash(charges: NormalizedCharge[]): string {
  const parts = charges
    .map((c) => [c.statuteCode ?? '', c.statuteSection ?? '', c.rawText.toUpperCase()].join('\u0001'))
    .sort();
  return createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 32);
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

export interface PresenceInput {
  /** Bookings this person had before the one being processed. */
  priorBookingCount: number;
  /** Whether their most recent prior booking had ended — released, or stopped
   *  appearing on a full roster. */
  priorBookingClosed: boolean;
}

/**
 * New, returning, or already known.
 *
 * The distinction between returning and known matters operationally: a person
 * who was released and has been booked again is an event, and a person who has
 * simply been in custody since yesterday is not. Both would look identical if
 * only the booking count were consulted.
 */
export function classifyPresence(input: PresenceInput): ChangeEventDraft {
  if (input.priorBookingCount === 0) {
    return {
      changeType: 'new_inmate',
      material: true,
      newValue: 'first appearance in the repository',
    };
  }
  if (input.priorBookingClosed) {
    return {
      changeType: 'returning_inmate',
      material: true,
      previousValue: `${input.priorBookingCount} prior booking(s), most recent already ended`,
      newValue: 'booked again',
    };
  }
  return {
    changeType: 'known_inmate',
    material: false,
    previousValue: `${input.priorBookingCount} prior booking(s)`,
    newValue: 'still in custody',
  };
}

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

const money = (cents: bigint | null | undefined): string | undefined =>
  cents === null || cents === undefined ? undefined : (Number(cents) / 100).toFixed(2);

const day = (d: Date | null | undefined): string | undefined =>
  d === null || d === undefined ? undefined : d.toISOString().slice(0, 10);

/**
 * Differences between what a source said before and what it says now.
 *
 * A change is only reported when both sides are known. If the previous
 * observation recorded a housing location and this one does not mention housing
 * at all, that is a gap in the source, not a transfer — reporting it would fill
 * the operator's report with movements that never happened.
 */
export function detectAttributeChanges(
  previous: ObservationAttributes | null,
  current: ObservationAttributes,
): ChangeEventDraft[] {
  const changes: ChangeEventDraft[] = [];
  if (!previous) return changes;

  const compare = (
    field: string,
    changeType: ChangeType,
    before: string | undefined,
    after: string | undefined,
    material = true,
  ): void => {
    if (before === undefined || after === undefined) return;   // one side unknown
    if (before === after) return;
    changes.push({ changeType, field, previousValue: before, newValue: after, material });
  };

  compare('housingLocation', 'housing_change',
    previous.housingLocation ?? undefined, current.housingLocation ?? undefined);

  compare('bailAmountCents', 'bail_change',
    money(previous.bailAmountCents), money(current.bailAmountCents));

  compare('courtDate', 'court_date_change',
    day(previous.courtDate), day(current.courtDate));

  compare('custodyStatus', 'custody_status_change',
    previous.custodyStatus ?? undefined, current.custodyStatus ?? undefined);

  // A release is the one attribute change that is an event in its own right, so
  // it is reported as `released` rather than as a date moving.
  if (!previous.releasedAt && current.releasedAt) {
    changes.push({
      changeType: 'released',
      field: 'releasedAt',
      newValue: day(current.releasedAt),
      material: true,
    });
  }

  // The charge set is compared by hash. Direction comes from the count, which is
  // enough for a report line; the charges themselves are on the booking.
  if (previous.chargeSetHash && current.chargeSetHash
      && previous.chargeSetHash !== current.chargeSetHash) {
    const before = previous.chargeCount ?? 0;
    const after = current.chargeCount ?? 0;
    changes.push({
      changeType: after >= before ? 'charge_added' : 'charge_removed',
      field: 'charges',
      previousValue: `${before} charge(s)`,
      newValue: `${after} charge(s)`,
      material: true,
    });
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Departures
// ---------------------------------------------------------------------------

export interface DepartureInput {
  /** Booking ids that were in custody at this facility before this run. */
  previouslyPresentBookingIds: string[];
  /** Booking ids this run observed. */
  observedBookingIds: Set<string>;
  /** Only a source that lists everyone in custody can support this inference. */
  rosterIsFullPopulation: boolean;
}

/**
 * Bookings that stopped appearing.
 *
 * Deliberately reported as `departed_roster` and not as `released`. Absence from
 * a roster means the jail stopped listing them; it does not say why. They may
 * have been released, transferred, or the export may have been truncated. The
 * system records what it observed and does not infer a reason it was not told —
 * an UNKNOWN is more useful than a confident guess that turns out to be a
 * transfer to state prison.
 */
export function detectDepartures(input: DepartureInput): string[] {
  if (!input.rosterIsFullPopulation) return [];
  return input.previouslyPresentBookingIds.filter((id) => !input.observedBookingIds.has(id));
}
