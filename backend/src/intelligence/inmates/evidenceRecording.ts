// ============================================================================
// Writing the evidence.
//
// Separated from the ingestion engine so the engine stays a readable sequence —
// parse, normalize, collapse, resolve, record — and the detail of what gets
// written for each decision lives here.
//
// The requirement this file exists to satisfy: nothing becomes detached from its
// evidence. Every row written names the document, the page, the row, the
// extraction method, the confidence, the batch, the time and the operator. If a
// fact cannot be traced back to a line in a file, it should not be in the
// repository.
// ============================================================================

import type { Prisma, PrismaClient } from '@prisma/client';

import {
  chargeSetHash, classifyPresence, detectAttributeChanges,
  type ChangeEventDraft, type ObservationAttributes,
} from './changeDetection.js';
import { reconcileObservations, type ObservationForComparison } from './sourceReconciliation.js';
import { displayName } from './displayName.js';
import type { MatchEvidence, NormalizedRecord, ResolutionResult } from './types.js';

type Tx = Prisma.TransactionClient | PrismaClient;

// ---------------------------------------------------------------------------
// Identity decisions
// ---------------------------------------------------------------------------

/**
 * The confidence analysis, as a row.
 *
 * It is also kept as JSON on the import record, which is what a reviewer reads.
 * This row is what makes it queryable: "every automatic merge that rested on a
 * date-of-birth typo" is a question this system will be asked, and a JSON column
 * cannot answer it.
 */
export async function recordIdentityMatch(
  tx: Tx,
  importRecordId: string,
  result: ResolutionResult,
): Promise<string> {
  const e: MatchEvidence = result.evidence;
  const row = await tx.inmateIdentityMatch.create({
    data: {
      importRecordId,
      inmateId: result.inmateId ?? null,
      tier: e.tier,
      confidence: e.confidence,
      outcome: result.outcome,
      humanReviewRequired: e.humanReviewRequired,
      reviewRationale: e.reviewRationale,
      resolverVersion: e.resolverVersion,
      reasons: e.reasons as unknown as object,
      conflicts: e.conflicts as unknown as object,
      rejectedCandidates: e.rejectedCandidates as unknown as object,
      sourceDocuments: e.sourceDocuments as unknown as object,
    },
    select: { matchId: true },
  });
  return row.matchId;
}

/** A decision a person has to make before the repository changes. */
export async function enqueueForReview(
  tx: Tx,
  args: { importRecordId: string; matchId: string; batchId: string; result: ResolutionResult },
): Promise<void> {
  await tx.inmateReviewQueueItem.create({
    data: {
      importRecordId: args.importRecordId,
      matchId: args.matchId,
      batchId: args.batchId,
      status: 'pending',
      reason: args.result.evidence.reviewRationale,
      confidence: args.result.evidence.confidence,
      candidateInmateId: args.result.inmateId ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Observations
// ---------------------------------------------------------------------------

/**
 * What this source said about this booking.
 *
 * Written for every row that resolves to a booking, including rows that changed
 * nothing. An observation that confirms yesterday's value is evidence too: it is
 * the difference between "the jail still says A-POD-12" and "no source has
 * mentioned this person for a week".
 */
export async function recordObservation(
  tx: Tx,
  args: {
    bookingId: string;
    batchId: string;
    documentId: string | null;
    sourceType: string;
    sourcePage: number | null;
    sourceRow: number;
    rosterDate: Date | null;
    record: NormalizedRecord;
  },
): Promise<{ observationId: string; attributes: ObservationAttributes }> {
  const attributes: ObservationAttributes = {
    housingLocation: args.record.housingLocation ?? null,
    bailAmountCents: args.record.bailAmountCents ?? null,
    releasedAt: args.record.releasedAt ? new Date(args.record.releasedAt) : null,
    courtDate: args.record.courtDate ? new Date(args.record.courtDate) : null,
    // A release date says the person was released. Its absence says the source
    // did not mention one — which is not the same as saying they are in custody.
    // Deriving 'in_custody' from a missing column had this source contradicting
    // another that did carry a release date, over a claim it never made. UNKNOWN
    // is recorded as null: the source did not say.
    custodyStatus: args.record.releasedAt ? 'released' : null,
    chargeSetHash: args.record.charges.length > 0 ? chargeSetHash(args.record.charges) : null,
    chargeCount: args.record.charges.length,
  };

  const row = await tx.inmateBookingObservation.create({
    data: {
      bookingId: args.bookingId,
      batchId: args.batchId,
      documentId: args.documentId,
      sourceType: args.sourceType,
      sourcePage: args.sourcePage,
      sourceRow: args.sourceRow,
      rosterDate: args.rosterDate,
      housingLocation: attributes.housingLocation ?? null,
      bailAmountCents: attributes.bailAmountCents ?? null,
      releasedAt: attributes.releasedAt ?? null,
      courtDate: attributes.courtDate ?? null,
      custodyStatus: attributes.custodyStatus ?? null,
      chargeSetHash: attributes.chargeSetHash ?? null,
      chargeCount: attributes.chargeCount ?? null,
      // Recorded per observation because the jail revises all four between
      // snapshots: a court date moves, a projected release slips, a warrant clears.
      projectedReleaseAt: args.record.projectedReleaseAt ? new Date(args.record.projectedReleaseAt) : null,
      courtName: args.record.courtName ?? null,
      outstandingWarrants: args.record.outstandingWarrants ?? null,
      arrestType: args.record.arrestType ?? null,
    },
    select: { observationId: true },
  });

  return { observationId: row.observationId, attributes };
}

/** The most recent observation of this booking before the one just written. */
export async function previousAttributes(
  tx: Tx,
  bookingId: string,
  excludeObservationId: string,
): Promise<ObservationAttributes | null> {
  const prior = await tx.inmateBookingObservation.findFirst({
    where: { bookingId, observationId: { not: excludeObservationId } },
    orderBy: { observedAt: 'desc' },
  });
  if (!prior) return null;
  return {
    housingLocation: prior.housingLocation,
    bailAmountCents: prior.bailAmountCents,
    releasedAt: prior.releasedAt,
    courtDate: prior.courtDate,
    custodyStatus: prior.custodyStatus,
    chargeSetHash: prior.chargeSetHash,
    chargeCount: prior.chargeCount,
  };
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

export async function recordChanges(
  tx: Tx,
  args: {
    batchId: string;
    inmateId: string | null;
    bookingId: string | null;
    observationId: string | null;
    rosterDate: Date | null;
    drafts: ChangeEventDraft[];
  },
): Promise<void> {
  if (args.drafts.length === 0) return;
  await tx.inmateChangeEvent.createMany({
    data: args.drafts.map((d) => ({
      batchId: args.batchId,
      inmateId: args.inmateId,
      bookingId: args.bookingId,
      observationId: args.observationId,
      rosterDate: args.rosterDate,
      changeType: d.changeType,
      field: d.field ?? null,
      previousValue: d.previousValue ?? null,
      newValue: d.newValue ?? null,
      material: d.material,
    })),
  });
}

/**
 * Presence and attribute changes for one booking.
 *
 * `priorBookingClosed` is what separates a returning offender from someone who
 * has simply been in custody since yesterday. Both have prior bookings; only one
 * is an event.
 */
export async function recordBookingChanges(
  tx: Tx,
  args: {
    batchId: string;
    inmateId: string;
    bookingId: string;
    observationId: string;
    rosterDate: Date | null;
    attributes: ObservationAttributes;
    isNewBooking: boolean;
  },
): Promise<ChangeEventDraft[]> {
  const drafts: ChangeEventDraft[] = [];

  if (args.isNewBooking) {
    const priorBookings = await tx.inmateBooking.findMany({
      where: { inmateId: args.inmateId, bookingId: { not: args.bookingId } },
      orderBy: { bookedAt: 'desc' },
      select: { releasedAt: true, departedRosterAt: true },
    });
    const mostRecent = priorBookings[0];
    drafts.push(classifyPresence({
      priorBookingCount: priorBookings.length,
      priorBookingClosed: Boolean(mostRecent && (mostRecent.releasedAt || mostRecent.departedRosterAt)),
    }));
  }

  const previous = await previousAttributes(tx, args.bookingId, args.observationId);
  drafts.push(...detectAttributeChanges(previous, args.attributes));

  await recordChanges(tx, {
    batchId: args.batchId,
    inmateId: args.inmateId,
    bookingId: args.bookingId,
    observationId: args.observationId,
    rosterDate: args.rosterDate,
    drafts,
  });

  return drafts;
}

// ---------------------------------------------------------------------------
// Cross-source conflicts
// ---------------------------------------------------------------------------

/**
 * Compare every source that described these bookings on this roster date.
 *
 * Run after the batch rather than per row, because a conflict needs both sides
 * and the other source may have been ingested minutes or hours earlier.
 */
export async function reconcileBatch(
  prisma: PrismaClient,
  args: { batchId: string; bookingIds: string[]; rosterDate: Date | null },
): Promise<number> {
  if (args.bookingIds.length === 0) return 0;

  const observations = await prisma.inmateBookingObservation.findMany({
    where: {
      bookingId: { in: args.bookingIds },
      ...(args.rosterDate ? { rosterDate: args.rosterDate } : {}),
    },
  });

  const comparable: ObservationForComparison[] = observations.map((o) => ({
    observationId: o.observationId,
    bookingId: o.bookingId,
    sourceType: o.sourceType,
    rosterDate: o.rosterDate,
    housingLocation: o.housingLocation,
    bailAmountCents: o.bailAmountCents,
    releasedAt: o.releasedAt,
    courtDate: o.courtDate,
    custodyStatus: o.custodyStatus,
    chargeSetHash: o.chargeSetHash,
    chargeCount: o.chargeCount,
  }));

  const conflicts = reconcileObservations(comparable);
  if (conflicts.length === 0) return 0;

  // A conflict already recorded for the same pair and field must not be written
  // twice when a batch is re-processed.
  const existing = await prisma.inmateSourceConflict.findMany({
    where: { bookingId: { in: args.bookingIds } },
    select: { bookingId: true, field: true, observationAId: true, observationBId: true },
  });
  const seen = new Set(existing.map((e) => [e.bookingId, e.field, e.observationAId, e.observationBId].join('\u0000')));

  const fresh = conflicts.filter(
    (c) => !seen.has([c.bookingId, c.field, c.observationAId, c.observationBId].join('\u0000')),
  );
  if (fresh.length === 0) return 0;

  await prisma.inmateSourceConflict.createMany({
    data: fresh.map((c) => ({
      bookingId: c.bookingId,
      field: c.field,
      valueA: c.valueA ?? null,
      sourceA: c.sourceA,
      observationAId: c.observationAId,
      valueB: c.valueB ?? null,
      sourceB: c.sourceB,
      observationBId: c.observationBId,
      rosterDate: c.rosterDate ?? null,
      resolution: c.resolution,
      resolutionNote: c.resolutionNote,
      batchId: args.batchId,
    })),
  });

  return fresh.length;
}

// ---------------------------------------------------------------------------
// Departures
// ---------------------------------------------------------------------------

/**
 * Bookings a full-population roster stopped listing.
 *
 * Recorded as `departed_roster`, never as `released`. Absence says the jail
 * stopped listing them; it does not say why. A release, a transfer to state
 * prison and a truncated export look identical from here, so the system records
 * what it observed and leaves the reason UNKNOWN.
 */
export async function recordDepartures(
  prisma: PrismaClient,
  args: {
    batchId: string;
    facility: string;
    observedBookingIds: Set<string>;
    rosterDate: Date | null;
    rosterIsFullPopulation: boolean;
  },
): Promise<number> {
  if (!args.rosterIsFullPopulation) return 0;

  const open = await prisma.inmateBooking.findMany({
    where: { facility: args.facility, releasedAt: null, departedRosterAt: null },
    select: { bookingId: true, inmateId: true },
  });

  const departed = open.filter((b) => !args.observedBookingIds.has(b.bookingId));
  if (departed.length === 0) return 0;

  const at = args.rosterDate ?? new Date();
  await prisma.inmateBooking.updateMany({
    where: { bookingId: { in: departed.map((b) => b.bookingId) } },
    data: { departedRosterAt: at, custodyStatus: 'departed_roster' },
  });

  await prisma.inmateChangeEvent.createMany({
    data: departed.map((b) => ({
      batchId: args.batchId,
      inmateId: b.inmateId,
      bookingId: b.bookingId,
      rosterDate: args.rosterDate,
      changeType: 'departed_roster',
      field: 'custodyStatus',
      previousValue: 'in_custody',
      newValue: 'no longer listed — reason UNKNOWN (release, transfer and a truncated export are indistinguishable here)',
      material: true,
    })),
  });

  return departed.length;
}

// ---------------------------------------------------------------------------
// Watch list
// ---------------------------------------------------------------------------

/** A watched person appearing in a roster, plus the notification for it. */
export async function recordWatchListMatches(
  prisma: PrismaClient,
  args: { batchId: string; bookingsByInmate: Map<string, string>; rosterDate: Date | null },
): Promise<number> {
  const inmateIds = [...args.bookingsByInmate.keys()];
  if (inmateIds.length === 0) return 0;

  const entries = await prisma.inmateWatchListEntry.findMany({
    where: { inmateId: { in: inmateIds }, active: true },
    include: { inmate: { select: { canonicalFirst: true, canonicalLast: true, displayFirst: true, displayLast: true } } },
  });
  if (entries.length === 0) return 0;

  for (const entry of entries) {
    const bookingId = args.bookingsByInmate.get(entry.inmateId) ?? null;
    await prisma.inmateWatchListMatch.create({
      data: {
        entryId: entry.entryId,
        inmateId: entry.inmateId,
        bookingId,
        batchId: args.batchId,
        matchType: 'new_booking',
        rosterDate: args.rosterDate,
      },
    });
    await prisma.inmateNotification.create({
      data: {
        kind: 'watch_list_hit',
        severity: 'warning',
        title: `Watch list: ${displayName(entry.inmate)} appears in a roster`,
        body: `Reason on the watch list: ${entry.reason}`,
        inmateId: entry.inmateId,
        batchId: args.batchId,
        referenceId: bookingId,
      },
    });
  }

  return entries.length;
}
