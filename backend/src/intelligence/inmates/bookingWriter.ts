// ============================================================================
// Attaching a booking to a person.
//
// Extracted because two callers need it and they must not drift apart. Ingestion
// calls it when the merge policy authorised a decision; the review queue calls it
// when a human made the decision the policy refused to. If these were two copies,
// a reviewer-approved merge would eventually stop recording an alias or an external
// identifier that an automatic merge still recorded, and nobody would notice until
// a search failed to find someone.
//
// Everything here runs inside the caller's transaction. A booking without its
// observation, or a person whose booking count does not match their bookings, is
// worse than a failed import.
// ============================================================================

import type { Prisma } from '@prisma/client';

import { bookingContentHash } from './deduplication.js';
import { recordBookingChanges, recordObservation } from './evidenceRecording.js';
import { NAME_KEY_VERSION, deriveNameKeys } from './nameKeys.js';
import type { NormalizedRecord } from './types.js';

type Tx = Prisma.TransactionClient;

export interface AttachBookingArgs {
  inmateId: string;
  record: NormalizedRecord;
  batchId: string;
  recordId: string;
  documentId: string | null;
  sourceType: string;
  sourcePage: number | null;
  sourceRow: number;
  rosterDate: Date | null;
  /** Recorded at write time, never recomputed. See the note below. */
  isFirstAppearance: boolean;
  /** The confidence of the decision that led here. A reviewer's decision is 100. */
  confidence: number;
}

/**
 * Write the booking, its charges, its observation, and everything the person's
 * record gains from having been seen.
 *
 * `isFirstAppearance` is passed in rather than derived, because it is a property of
 * what was known at the time. Recomputing it later from a moving baseline would
 * change last week's report every time an older roster was backfilled.
 */
export async function attachBooking(tx: Tx, args: AttachBookingArgs): Promise<{ bookingId: string }> {
  const { record, inmateId, batchId } = args;

  const booking = await tx.inmateBooking.create({
    data: {
      inmateId,
      facility: record.facility,
      externalBookingId: record.externalBookingId ?? null,
      bookedAt: new Date(record.bookedAt),
      releasedAt: record.releasedAt ? new Date(record.releasedAt) : null,
      arrestingAgency: record.arrestingAgency ?? null,
      bailAmountCents: record.bailAmountCents ?? null,
      housingLocation: record.housingLocation ?? null,
      // The fields Sacramento publishes that earlier imports discarded. A forecast
      // release stays in its own column, never merged into releasedAt.
      projectedReleaseAt: record.projectedReleaseAt ? new Date(record.projectedReleaseAt) : null,
      arrestType: record.arrestType ?? null,
      courtDate: record.courtDate ? new Date(record.courtDate) : null,
      courtName: record.courtName ?? null,
      outstandingWarrants: record.outstandingWarrants ?? null,
      heightInches: record.heightInches ?? null,
      weightPounds: record.weightPounds ?? null,
      contentHash: bookingContentHash(record),
      sourceBatchId: batchId,
      sourceRecordId: args.recordId,
      isFirstAppearance: args.isFirstAppearance,
      custodyStatus: record.releasedAt ? 'released' : 'in_custody',
      lastObservedAt: new Date(),
      charges: {
        create: record.charges.map((c) => ({
          statuteCode: c.statuteCode ?? null,
          statuteSection: c.statuteSection ?? null,
          description: c.description ?? null,
          severity: c.severity,
          counts: c.counts,
          bailAmountCents: c.bailAmountCents ?? null,
          rawText: c.rawText,
        })),
      },
    },
  });

  // The person is linked here rather than when the record was written, because for a
  // newly discovered person they did not exist yet — the record was created before
  // the person was. Leaving it null made "which import found this person"
  // unanswerable for exactly the people this system is about.
  await tx.inmateIngestionRecord.update({
    where: { recordId: args.recordId },
    data: { bookingId: booking.bookingId, resolvedInmateId: inmateId },
  });

  const { observationId, attributes } = await recordObservation(tx, {
    bookingId: booking.bookingId,
    batchId,
    documentId: args.documentId,
    sourceType: args.sourceType,
    sourcePage: args.sourcePage,
    sourceRow: args.sourceRow,
    rosterDate: args.rosterDate,
    record,
  });

  await recordBookingChanges(tx, {
    batchId,
    inmateId,
    bookingId: booking.bookingId,
    observationId,
    rosterDate: args.rosterDate,
    attributes,
    isNewBooking: true,
  });

  await recordAlias(tx, { inmateId, record, batchId });
  await recordExternalId(tx, { inmateId, record, batchId });

  await tx.inmate.update({
    where: { inmateId },
    data: {
      bookingCount: { increment: 1 },
      lastSeenAt: new Date(record.bookedAt),
      // A weaker match lowers confidence in the identity; a stronger one does not
      // raise it, because the weak evidence still happened.
      identityConfidence: Math.min(args.confidence, 100),
    },
  });

  return { bookingId: booking.bookingId };
}

/**
 * Every spelling ever seen, so a search by any of them finds the person.
 *
 * Deliberately findFirst-then-write rather than upsert. The natural key includes
 * middle name and date of birth, both nullable, and in PostgreSQL two NULLs are
 * distinct — so a unique constraint over them never fires and an upsert would
 * insert a new alias row on every roster for anyone missing a middle name.
 */
export async function recordAlias(
  tx: Tx,
  args: { inmateId: string; record: NormalizedRecord; batchId: string },
): Promise<void> {
  const { inmateId, record, batchId } = args;
  const aliasDob = record.dateOfBirth ? new Date(record.dateOfBirth) : null;

  const existing = await tx.inmateAlias.findFirst({
    where: {
      inmateId,
      last: record.last,
      first: record.first,
      middle: record.middle ?? null,
      dateOfBirth: aliasDob,
    },
    select: { aliasId: true },
  });

  if (existing) {
    await tx.inmateAlias.update({
      where: { aliasId: existing.aliasId },
      data: { occurrences: { increment: 1 } },
    });
    return;
  }

  const keys = deriveNameKeys(record.last);
  await tx.inmateAlias.create({
    data: {
      inmateId,
      last: record.last,
      first: record.first,
      middle: record.middle ?? null,
      displayLast: record.displayLast ?? null,
      displayFirst: record.displayFirst ?? null,
      displayMiddle: record.displayMiddle ?? null,
      suffix: record.suffix ?? null,
      dateOfBirth: aliasDob,
      sourceBatchId: batchId,
      phoneticLast: keys.phonetic,
      collapsedLast: keys.collapsed,
      nameKeyVersion: NAME_KEY_VERSION,
    },
  });
}

/**
 * The facility's own person identifier, when the roster supplies one.
 *
 * The strongest identity evidence available on the next roster, so it is recorded
 * whenever seen — including for a person first matched by name only.
 */
export async function recordExternalId(
  tx: Tx,
  args: { inmateId: string; record: NormalizedRecord; batchId: string },
): Promise<void> {
  const { inmateId, record, batchId } = args;
  if (!record.externalPersonId) return;

  const existing = await tx.inmateExternalId.findUnique({
    where: { facility_externalId: { facility: record.facility, externalId: record.externalPersonId } },
    select: { externalIdRow: true, inmateId: true },
  });

  if (!existing) {
    await tx.inmateExternalId.create({
      data: {
        inmateId,
        facility: record.facility,
        externalId: record.externalPersonId,
        firstSeenBatchId: batchId,
      },
    });
    return;
  }

  if (existing.inmateId === inmateId) {
    await tx.inmateExternalId.update({
      where: { externalIdRow: existing.externalIdRow },
      data: { occurrences: { increment: 1 } },
    });
  }
  // An identifier already bound to a *different* person is left alone: it is a data
  // problem, and silently rebinding it would move identity evidence from one person
  // to another without a record.
}

/** Create the person a record describes, with the derived keys matching lookups. */
export async function createPersonFromRecord(
  tx: Tx,
  args: { record: NormalizedRecord; confidence: number },
): Promise<{ inmateId: string }> {
  const { record } = args;
  const keys = deriveNameKeys(record.last);

  const created = await tx.inmate.create({
    data: {
      canonicalFirst: record.first,
      canonicalLast: record.last,
      canonicalMiddle: record.middle ?? null,
      displayFirst: record.displayFirst ?? null,
      displayLast: record.displayLast ?? null,
      displayMiddle: record.displayMiddle ?? null,
      suffix: record.suffix ?? null,
      phoneticLast: keys.phonetic,
      collapsedLast: keys.collapsed,
      nameKeyVersion: NAME_KEY_VERSION,
      dateOfBirth: record.dateOfBirth ? new Date(record.dateOfBirth) : null,
      sex: record.sex ?? null,
      race: record.race ?? null,
      identityConfidence: args.confidence,
      firstSeenAt: new Date(record.bookedAt),
      lastSeenAt: new Date(record.bookedAt),
    },
    select: { inmateId: true },
  });

  return { inmateId: created.inmateId };
}
