// ============================================================================
// The other engines.
//
// Four of them, sharing one evidence repository and one governance layer. Three
// have typed detail tables already (conflicts, changes, watch list matches) and
// point at them; the fourth has none and carries its finding in `payload`, which is
// the demonstration that a new engine needs no migration.
//
// The watch list engine is the one that changed shape. It consumes intelligence
// rather than bookings:
//
//   New Booking Intelligence → Watch List Engine → Notification
//
// not
//
//   Booking → Watch List
//
// which is what makes it independent of ingestion. It can be re-run over historical
// intelligence, its version can change without touching the import path, and a
// watch list added today can be evaluated against last year's findings.
// ============================================================================

import prisma from '../../../lib/prisma.js';
import { registerEngine } from '../engineRegistry.js';
import type { EvidenceContext, IntelligenceEngine, IntelligenceFinding, Severity } from '../types.js';

// ---------------------------------------------------------------------------
// Conflict engine
// ---------------------------------------------------------------------------

/**
 * A finding for one recorded cross-source disagreement.
 *
 * The intelligence explicitly does not pick a winner when the sources are equally
 * authoritative. "Bail conflict, current truth unknown, human review required" is a
 * more honest conclusion than a guess, and the platform is built to hold it.
 */
export function findingFromConflict(conflict: {
  conflictId: string;
  field: string;
  valueA: string | null;
  sourceA: string;
  valueB: string | null;
  sourceB: string;
  resolution: string;
  observationAId: string | null;
  observationBId: string | null;
  bookingId: string | null;
  inmateId: string | null;
}): IntelligenceFinding {
  const unresolved = conflict.resolution === 'unknown';
  const observationIds = [conflict.observationAId, conflict.observationBId].filter((v): v is string => Boolean(v));

  const currentTruth = unresolved
    ? 'UNKNOWN'
    : conflict.resolution === 'prefer_a' ? conflict.valueA
    : conflict.resolution === 'prefer_b' ? conflict.valueB
    : 'UNKNOWN';

  return {
    type: 'source_conflict',
    severity: unresolved ? conflictSeverity(conflict.field) : 'info',
    subjectKind: conflict.bookingId ? 'booking' : 'person',
    subjectId: conflict.bookingId ?? conflict.inmateId ?? undefined,
    // A conflict is a statement about disagreement, and the disagreement is
    // certain. Confidence describes the conclusion, not the resolution — which is
    // why an unresolved conflict is not low-confidence.
    confidence: 100,
    rule: `conflict:${conflict.field}`,
    explanation: unresolved
      ? `${label(conflict.field)} disagrees between sources: ${conflict.sourceA} states ${display(conflict.valueA)}, ${conflict.sourceB} states ${display(conflict.valueB)}. Neither source is more authoritative than the other, so the current truth is unknown and a person must decide.`
      : `${label(conflict.field)} disagreed between sources and was resolved in favour of ${conflict.resolution === 'prefer_a' ? conflict.sourceA : conflict.sourceB}: ${display(currentTruth)}.`,
    reviewRequired: unresolved,
    disposition: unresolved ? 'proposed' : 'auto_applied',
    evidenceObservationIds: observationIds,
    payload: {
      field: conflict.field,
      currentTruth,
      // Both statements preserved side by side, which is the point: the losing
      // value is evidence, not an error to be overwritten.
      observations: [
        { source: conflict.sourceA, stated: conflict.valueA, observationId: conflict.observationAId },
        { source: conflict.sourceB, stated: conflict.valueB, observationId: conflict.observationBId },
      ],
      conflicts: [{ field: conflict.field, a: conflict.valueA, b: conflict.valueB }],
      recommendation: unresolved ? 'review' : 'no_action',
    },
    detail: { table: 'inmate_source_conflicts', id: conflict.conflictId },
  };
}

/** Money and liberty outrank housing. */
function conflictSeverity(field: string): Severity {
  if (field === 'bailAmountCents' || field === 'releasedAt' || field === 'custodyStatus') return 'significant';
  if (field === 'courtDate') return 'notable';
  return 'info';
}

function label(field: string): string {
  const labels: Record<string, string> = {
    bailAmountCents: 'Bail amount',
    releasedAt: 'Release date',
    custodyStatus: 'Custody status',
    housingLocation: 'Housing location',
    courtDate: 'Court date',
    chargeSetHash: 'Charge list',
  };
  return labels[field] ?? field;
}

function display(value: string | null): string {
  return value === null || value === '' ? 'nothing' : value;
}

export const conflictEngine: IntelligenceEngine = {
  name: 'conflict',
  version: '1.0.0',
  produces: ['source_conflict'],
  description:
    'Identifies disagreements between what two sources stated about the same booking, and declines to pick a winner when neither source is more authoritative.',

  async analyse(context: EvidenceContext): Promise<IntelligenceFinding[]> {
    const where = context.observationIds
      ? {
          OR: [
            { observationAId: { in: context.observationIds } },
            { observationBId: { in: context.observationIds } },
          ],
        }
      : context.batchId
        ? { batchId: context.batchId }
        : {};

    const conflicts = await prisma.inmateSourceConflict.findMany({
      where,
      orderBy: { conflictId: 'asc' },
      take: 5_000,
    });
    return conflicts.map(findingFromConflict);
  },
};

// ---------------------------------------------------------------------------
// Change detection engine
// ---------------------------------------------------------------------------

export function findingFromChange(change: {
  eventId: string;
  changeType: string;
  field: string | null;
  previousValue: string | null;
  newValue: string | null;
  material: boolean;
  inmateId: string | null;
  bookingId: string | null;
  observationId: string | null;
}): IntelligenceFinding {
  return {
    type: 'change',
    severity: change.material ? changeSeverity(change.changeType) : 'info',
    subjectKind: change.bookingId ? 'booking' : 'person',
    subjectId: change.bookingId ?? change.inmateId ?? undefined,
    confidence: 100,
    rule: `change:${change.changeType}`,
    explanation: change.field
      ? `${label(change.field)} changed from ${display(change.previousValue)} to ${display(change.newValue)}.`
      : `${change.changeType.replace(/_/g, ' ')} detected.`,
    reviewRequired: false,
    // A change is an observed fact about two observations, not a proposal.
    disposition: 'auto_applied',
    evidenceObservationIds: change.observationId ? [change.observationId] : [],
    payload: {
      changeType: change.changeType,
      field: change.field,
      previousValue: change.previousValue,
      newValue: change.newValue,
      material: change.material,
      recommendation: 'no_action',
    },
    detail: { table: 'inmate_change_events', id: change.eventId },
  };
}

function changeSeverity(changeType: string): Severity {
  if (changeType === 'released' || changeType === 'departed_roster') return 'notable';
  if (changeType === 'new_inmate' || changeType === 'returning_inmate') return 'significant';
  if (changeType === 'charges_changed' || changeType === 'bail_changed') return 'notable';
  return 'info';
}

export const changeEngine: IntelligenceEngine = {
  name: 'change_detection',
  version: '1.0.0',
  produces: ['change'],
  description:
    'Compares consecutive observations of the same booking and states what materially differed.',

  async analyse(context: EvidenceContext): Promise<IntelligenceFinding[]> {
    const events = await prisma.inmateChangeEvent.findMany({
      where: context.batchId ? { batchId: context.batchId } : {},
      orderBy: { eventId: 'asc' },
      take: 5_000,
    });
    return events.map(findingFromChange);
  },
};

// ---------------------------------------------------------------------------
// Watch list engine — a consumer of intelligence
// ---------------------------------------------------------------------------

export const watchListEngine: IntelligenceEngine = {
  name: 'watch_list',
  version: '2.0.0',
  produces: ['watch_list_hit'],
  description:
    'Evaluates active watch lists against intelligence rather than against bookings, so a list added today can be run over findings already in the repository.',

  async analyse(context: EvidenceContext): Promise<IntelligenceFinding[]> {
    // The input is intelligence, not a roster. This is the whole difference: the
    // engine reads what other engines concluded, which is why it can run at any
    // time and does not have to be part of the import.
    const upstream = await prisma.inmateIntelligenceItem.findMany({
      where: {
        type: { in: ['identity_candidate', 'change'] },
        subjectKind: { in: ['person', 'booking'] },
        disposition: { in: ['auto_applied', 'accepted'] },
        ...(context.runId ? {} : context.batchId ? { batchId: context.batchId } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 10_000,
      select: {
        itemId: true, type: true, subjectKind: true, subjectId: true,
        evidenceObservationIds: true, payload: true, explanation: true,
      },
    });
    if (upstream.length === 0) return [];

    // Resolve booking subjects to their people, because a watch list is on a
    // person while much of the intelligence is about a booking.
    const bookingIds = upstream.filter((i) => i.subjectKind === 'booking' && i.subjectId).map((i) => i.subjectId!);
    const bookings = bookingIds.length > 0
      ? await prisma.inmateBooking.findMany({
          where: { bookingId: { in: bookingIds } },
          select: { bookingId: true, inmateId: true },
        })
      : [];
    const inmateByBooking = new Map(bookings.map((b) => [b.bookingId, b.inmateId]));

    const personIds = [...new Set(
      upstream
        .map((i) => (i.subjectKind === 'person' ? i.subjectId : i.subjectId ? inmateByBooking.get(i.subjectId) : undefined))
        .filter((v): v is string => Boolean(v)),
    )];
    if (personIds.length === 0) return [];

    const entries = await prisma.inmateWatchListEntry.findMany({
      where: { inmateId: { in: personIds }, active: true },
      select: { entryId: true, inmateId: true, reason: true, notifyOnRebooking: true },
    });
    if (entries.length === 0) return [];

    const entriesByInmate = new Map<string, typeof entries>();
    for (const entry of entries) {
      const list = entriesByInmate.get(entry.inmateId) ?? [];
      list.push(entry);
      entriesByInmate.set(entry.inmateId, list);
    }

    const findings: IntelligenceFinding[] = [];
    for (const item of upstream) {
      const inmateId = item.subjectKind === 'person'
        ? item.subjectId
        : item.subjectId ? inmateByBooking.get(item.subjectId) : undefined;
      if (!inmateId) continue;

      for (const entry of entriesByInmate.get(inmateId) ?? []) {
        const matchType = watchMatchType(item.type, item.payload);
        if (matchType === null) continue;

        findings.push({
          type: 'watch_list_hit',
          severity: matchType === 'new_booking' ? 'critical' : 'significant',
          subjectKind: 'person',
          subjectId: inmateId,
          relatedKind: 'watch_list_entry',
          relatedId: entry.entryId,
          confidence: 100,
          rule: `watch:${matchType}`,
          explanation: `A person on a watch list appears in new intelligence (${matchType.replace(/_/g, ' ')}). The list was created because: ${entry.reason}. Triggering finding: ${item.explanation}`,
          reviewRequired: false,
          disposition: 'auto_applied',
          evidenceObservationIds: item.evidenceObservationIds,
          inputs: {
            // The upstream finding, so the chain from evidence to notification is
            // traversable in both directions.
            triggeringItemId: item.itemId,
            triggeringType: item.type,
          },
          payload: { matchType, entryId: entry.entryId, notify: entry.notifyOnRebooking, recommendation: 'notify' },
        });
      }
    }
    return findings;
  },
};

/** Which intelligence constitutes a watch list hit. Null means it does not. */
function watchMatchType(type: string, payload: unknown): string | null {
  if (type === 'identity_candidate') {
    const outcome = (payload as { outcome?: string } | null)?.outcome;
    return outcome === 'matched' || outcome === 'new_inmate' ? 'new_booking' : null;
  }
  const changeType = (payload as { changeType?: string } | null)?.changeType;
  if (changeType === 'new_inmate' || changeType === 'returning_inmate') return 'new_booking';
  if (changeType === 'released' || changeType === 'departed_roster') return 'release';
  if (changeType === 'facility_changed') return 'transfer';
  if (changeType === 'bail_changed') return 'bail_change';
  return null;
}

// ---------------------------------------------------------------------------
// Repeat offender engine — an engine with no schema of its own
// ---------------------------------------------------------------------------

/**
 * The extensibility proof.
 *
 * This engine has no typed detail table, no columns, and no migration. It reads
 * bookings, concludes something new, and stores the conclusion in `payload`. If
 * adding an engine had required a schema change, this is where it would have shown.
 */
export const repeatOffenderEngine: IntelligenceEngine = {
  name: 'repeat_offender',
  version: '1.0.0',
  produces: ['repeat_offender'],
  description:
    'Flags people whose booking history shows a pattern of return, with the interval between bookings as evidence.',

  async analyse(context: EvidenceContext): Promise<IntelligenceFinding[]> {
    const scope = context.observationIds
      ? await prisma.inmateBookingObservation.findMany({
          where: { observationId: { in: context.observationIds } },
          select: { booking: { select: { inmateId: true } } },
        })
      : [];
    const inmateIds = [...new Set(scope.map((o) => o.booking.inmateId))];
    if (inmateIds.length === 0) return [];

    const findings: IntelligenceFinding[] = [];
    for (const inmateId of inmateIds.sort()) {
      const bookings = await prisma.inmateBooking.findMany({
        where: { inmateId },
        orderBy: { bookedAt: 'asc' },
        select: { bookingId: true, bookedAt: true, facility: true },
      });
      if (bookings.length < 3) continue;

      const dated = bookings.filter((b): b is typeof b & { bookedAt: Date } => b.bookedAt !== null);
      if (dated.length < 3) continue;

      const gaps: number[] = [];
      for (let i = 1; i < dated.length; i += 1) {
        gaps.push(Math.round((dated[i].bookedAt.getTime() - dated[i - 1].bookedAt.getTime()) / 86_400_000));
      }
      const median = medianOf(gaps);

      findings.push({
        type: 'repeat_offender',
        severity: dated.length >= 6 ? 'significant' : 'notable',
        subjectKind: 'person',
        subjectId: inmateId,
        // Descriptive: a count of bookings is certain, but whether it constitutes a
        // pattern is a judgement, so the score reflects how pronounced it is.
        confidence: Math.min(100, 40 + dated.length * 8),
        rule: 'repeat:booking_count',
        explanation: `${dated.length} bookings recorded between ${iso(dated[0].bookedAt)} and ${iso(dated[dated.length - 1].bookedAt)}, a median of ${median} days apart.`,
        reviewRequired: false,
        disposition: 'auto_applied',
        // Bookings are evidence here rather than observations; the observation ids
        // in scope are what triggered the look.
        evidenceObservationIds: context.observationIds ?? [],
        inputs: { bookingIds: dated.map((b) => b.bookingId) },
        payload: {
          bookingCount: dated.length,
          medianGapDays: median,
          facilities: [...new Set(dated.map((b) => b.facility))],
          firstBooking: iso(dated[0].bookedAt),
          latestBooking: iso(dated[dated.length - 1].bookedAt),
          recommendation: 'no_action',
        },
      });
    }
    return findings;
  },
};

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

registerEngine(conflictEngine);
registerEngine(changeEngine);
registerEngine(watchListEngine);
registerEngine(repeatOffenderEngine);
