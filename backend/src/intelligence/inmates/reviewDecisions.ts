// ============================================================================
// Review queue decisions.
//
// A record the merge policy would not decide wrote nothing to the repository — no
// person, no booking. That is deliberate: an uncertain merge must not take effect
// before someone has looked at it. The consequence is that a reviewer's decision is
// not an annotation, it is the write ingestion deferred, and until it is made the
// booking does not exist.
//
// Three decisions, matching the three buttons:
//
//   Approve Merge      the candidate is the same person; attach the booking to them
//   Reject Merge       the candidate is someone else; the subject is a new person
//   Create New Person  no candidate applies; the subject is a new person
//
// Reject and create differ in meaning even though both create a person, so both are
// recorded. "This is not Robert Smith" and "I have no opinion about Robert Smith"
// are different statements about the same evidence, and a later reviewer looking at
// a similar pair needs to know which was made.
//
// The write path is `attachBooking`, shared with ingestion, so a reviewer-approved
// merge records exactly what an automatic merge records.
// ============================================================================

import prisma from '../../lib/prisma.js';
import { attachBooking, createPersonFromRecord } from './bookingWriter.js';
import type { NormalizedRecord } from './types.js';

export type ReviewDecision = 'approve_merge' | 'reject_merge' | 'create_new_person';

export interface DecisionOutcome {
  ok: boolean;
  reason?: string;
  recordId?: string;
  decision?: ReviewDecision;
  inmateId?: string;
  bookingId?: string;
  /** True when the decision created a person rather than merging into one. */
  createdPerson?: boolean;
}

/**
 * Record a reviewer's decision and perform the write it authorises.
 *
 * A note is required to reject, because "these are different people" is a conclusion
 * a later reader will want the reason for. Approving needs no note: the evidence the
 * engine assembled is already the reason, and demanding prose for every routine
 * approval would produce a queue full of "yes".
 */
export async function decideReview(args: {
  recordId: string;
  decision: ReviewDecision;
  reviewerId: string;
  note?: string;
}): Promise<DecisionOutcome> {
  const record = await prisma.inmateIngestionRecord.findUnique({
    where: { recordId: args.recordId },
    include: {
      batch: {
        select: {
          batchId: true, facility: true, rosterDate: true,
          documentId: true, sourceType: true,
        },
      },
    },
  });

  if (!record) return { ok: false, reason: 'No such import record.' };
  if (record.resolution !== 'needs_review') {
    return {
      ok: false,
      reason: `This record was resolved as "${record.resolution}" and is not awaiting review.`,
    };
  }
  if (record.bookingId) {
    return { ok: false, reason: 'This record has already been decided; its booking exists.' };
  }

  const queueItem = await prisma.inmateReviewQueueItem.findUnique({
    where: { importRecordId: args.recordId },
    select: { reviewId: true, status: true, candidateInmateId: true },
  });
  if (queueItem && queueItem.status !== 'pending') {
    return { ok: false, reason: `This review is already ${queueItem.status}.` };
  }

  if (args.decision === 'reject_merge' && !args.note?.trim()) {
    return {
      ok: false,
      reason: 'Rejecting a merge requires a reason, so a later reviewer looking at similar evidence knows why these were held apart.',
    };
  }

  const normalized = record.normalizedPayload as unknown as NormalizedRecord | null;
  if (!normalized || !normalized.bookedAt) {
    return {
      ok: false,
      reason: 'The normalized record is missing or has no booking date, so no booking can be written from it.',
    };
  }

  const candidateId = record.resolvedInmateId ?? queueItem?.candidateInmateId ?? null;
  if (args.decision === 'approve_merge' && !candidateId) {
    return {
      ok: false,
      reason: 'There is no candidate person to merge into. Use Create New Person instead.',
    };
  }

  // Confirm the candidate still exists and has not itself been merged away since the
  // record was queued. Attaching a booking to a superseded person would hide it from
  // every screen that filters on mergedIntoId.
  if (args.decision === 'approve_merge' && candidateId) {
    const candidate = await prisma.inmate.findUnique({
      where: { inmateId: candidateId },
      select: { inmateId: true, mergedIntoId: true },
    });
    if (!candidate) {
      return { ok: false, reason: 'The candidate person no longer exists.' };
    }
    if (candidate.mergedIntoId) {
      return {
        ok: false,
        reason: 'The candidate person has since been merged into another record. Re-review this record against the surviving person.',
      };
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    let inmateId: string;
    let createdPerson = false;
    let isFirstAppearance = false;

    if (args.decision === 'approve_merge') {
      inmateId = candidateId!;
      const priorBookings = await tx.inmateBooking.count({ where: { inmateId } });
      isFirstAppearance = priorBookings === 0;
    } else {
      // A reviewer's judgement is the strongest evidence the system has, so the new
      // person's identity confidence is 100 — not the resolver's uncertain score,
      // which described a merge that was declined.
      const created = await createPersonFromRecord(tx, { record: normalized, confidence: 100 });
      inmateId = created.inmateId;
      createdPerson = true;
      isFirstAppearance = true;
    }

    const { bookingId } = await attachBooking(tx, {
      inmateId,
      record: normalized,
      batchId: record.batch.batchId,
      recordId: record.recordId,
      documentId: record.batch.documentId,
      sourceType: record.batch.sourceType,
      sourcePage: record.sourcePage,
      sourceRow: record.lineNumber,
      rosterDate: record.batch.rosterDate,
      isFirstAppearance,
      confidence: 100,
    });

    // The record's own resolution changes to what actually happened, so the import
    // history stops reporting it as awaiting review.
    await tx.inmateIngestionRecord.update({
      where: { recordId: record.recordId },
      data: {
        resolution: createdPerson ? 'new_inmate' : 'matched',
        resolvedInmateId: inmateId,
        bookingId,
      },
    });

    if (queueItem) {
      await tx.inmateReviewQueueItem.update({
        where: { reviewId: queueItem.reviewId },
        data: {
          status: args.decision === 'approve_merge' ? 'merged'
            : args.decision === 'reject_merge' ? 'rejected' : 'created',
          resolvedById: args.reviewerId,
          resolvedAt: new Date(),
          resolutionNote: args.note?.trim() ?? null,
        },
      });
    }

    // A change event, so the decision appears on the person's timeline alongside
    // everything the engines concluded. A merge a reviewer performed is as much a
    // part of the history as one the policy performed.
    await tx.inmateChangeEvent.create({
      data: {
        inmateId,
        bookingId,
        batchId: record.batch.batchId,
        changeType: createdPerson ? 'review_created_person' : 'review_approved_merge',
        field: null,
        previousValue: candidateId,
        newValue: inmateId,
        material: true,
        rosterDate: record.batch.rosterDate,
      },
    });

    return { inmateId, bookingId, createdPerson };
  });

  // The governance record, so the decision is queryable beside every automated one.
  await recordDecisionIntelligence({
    recordId: record.recordId,
    decision: args.decision,
    reviewerId: args.reviewerId,
    note: args.note?.trim(),
    inmateId: result.inmateId,
    bookingId: result.bookingId,
    batchId: record.batch.batchId,
    candidateId,
  });

  return {
    ok: true,
    recordId: record.recordId,
    decision: args.decision,
    inmateId: result.inmateId,
    bookingId: result.bookingId,
    createdPerson: result.createdPerson,
  };
}

/**
 * Record the decision as intelligence.
 *
 * Best-effort: the decision has already been committed, and failing to write its
 * governance record must not roll back a merge a person made. The failure is logged
 * rather than swallowed silently, because a gap here is a gap in the audit trail.
 */
async function recordDecisionIntelligence(args: {
  recordId: string;
  decision: ReviewDecision;
  reviewerId: string;
  note?: string;
  inmateId: string;
  bookingId: string;
  batchId: string;
  candidateId: string | null;
}): Promise<void> {
  try {
    const { recordFindings } = await import('../platform/intelligenceRepository.js');
    const observation = await prisma.inmateBookingObservation.findFirst({
      where: { bookingId: args.bookingId },
      orderBy: { observedAt: 'asc' },
      select: { observationId: true },
    });

    const explanation = args.decision === 'approve_merge'
      ? `A reviewer confirmed this record describes an existing person and approved the merge the resolver would not make on its own.${args.note ? ` Reason given: ${args.note}` : ''}`
      : args.decision === 'reject_merge'
        ? `A reviewer determined this record describes a different person from the candidate the resolver proposed, and a separate person was created. Reason given: ${args.note}`
        : `A reviewer created a new person for this record without merging into any candidate.${args.note ? ` Reason given: ${args.note}` : ''}`;

    await recordFindings(
      { name: 'human_review', version: '1.0.0' },
      [{
        type: 'identity_candidate',
        severity: 'notable',
        subjectKind: 'person',
        subjectId: args.inmateId,
        relatedKind: args.candidateId ? 'person' : undefined,
        relatedId: args.candidateId ?? undefined,
        // A human decision is not a probability.
        confidence: 100,
        rule: `review:${args.decision}`,
        explanation,
        reviewRequired: false,
        disposition: 'auto_applied',
        evidenceObservationIds: observation ? [observation.observationId] : [],
        inputs: { importRecordIds: [args.recordId], reviewerId: args.reviewerId },
        payload: {
          decision: args.decision,
          candidateInmateId: args.candidateId,
          note: args.note ?? null,
          recommendation: 'no_action',
        },
      }],
      { batchId: args.batchId, versions: {}, dryRun: false },
    );
  } catch (err) {
    console.error('[niis] the review decision was applied but its intelligence record failed to write', err);
  }
}

/**
 * The review queue with everything a reviewer needs to decide.
 *
 * The candidate is resolved to a person with their booking history, because the
 * question "is this the same person" cannot be answered from a name and a score. A
 * reviewer who has to open another screen to see who the candidate is will approve
 * on the name alone, which is the failure this assembly prevents.
 */
export async function reviewQueueDetailed(args: { limit: number; offset: number }) {
  const where = { resolution: 'needs_review', bookingId: null } as const;

  const [total, rows] = await Promise.all([
    prisma.inmateIngestionRecord.count({ where }),
    prisma.inmateIngestionRecord.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { recordId: 'asc' }],
      skip: args.offset,
      take: args.limit,
      include: {
        batch: {
          select: {
            batchId: true, sourceFilename: true, facility: true,
            rosterDate: true, sourceType: true,
          },
        },
      },
    }),
  ]);

  const candidateIds = [...new Set(rows.map((r) => r.resolvedInmateId).filter((v): v is string => Boolean(v)))];
  const candidates = candidateIds.length > 0
    ? await prisma.inmate.findMany({
        where: { inmateId: { in: candidateIds } },
        select: {
          inmateId: true, canonicalFirst: true, canonicalLast: true, canonicalMiddle: true,
          dateOfBirth: true, sex: true, race: true, bookingCount: true,
          firstSeenAt: true, lastSeenAt: true, identityConfidence: true,
          aliases: { select: { first: true, last: true, dateOfBirth: true }, take: 10 },
          externalIds: { select: { facility: true, externalId: true }, take: 5 },
          bookings: {
            orderBy: { bookedAt: 'desc' },
            take: 5,
            select: {
              bookingId: true, bookedAt: true, releasedAt: true, facility: true,
              externalBookingId: true, housingLocation: true,
            },
          },
        },
      })
    : [];
  const candidateById = new Map(candidates.map((c) => [c.inmateId, c]));

  return {
    total,
    results: rows.map((r) => {
      const normalized = r.normalizedPayload as unknown as NormalizedRecord | null;
      const candidate = r.resolvedInmateId ? candidateById.get(r.resolvedInmateId) : undefined;

      return {
        recordId: r.recordId,
        lineNumber: r.lineNumber,
        createdAt: r.createdAt.toISOString(),
        confidence: r.confidence,
        tier: r.matchTier,
        /** The full confidence model: reasons, conflicts, rejected candidates. */
        evidence: r.matchEvidence,
        /** What the roster said, normalized. */
        subject: normalized ? {
          last: normalized.last,
          first: normalized.first,
          middle: normalized.middle ?? null,
          dateOfBirth: normalized.dateOfBirth ?? null,
          sex: normalized.sex ?? null,
          race: normalized.race ?? null,
          bookedAt: normalized.bookedAt,
          externalBookingId: normalized.externalBookingId ?? null,
          externalPersonId: normalized.externalPersonId ?? null,
          facility: normalized.facility,
          housingLocation: normalized.housingLocation ?? null,
          bailAmountCents: normalized.bailAmountCents ?? null,
          charges: normalized.charges.map((c) => ({
            statuteCode: c.statuteCode ?? null,
            description: c.description ?? null,
            severity: c.severity,
            rawText: c.rawText,
          })),
        } : null,
        /** Who the engine thought it might be, in enough detail to judge. */
        candidate: candidate ? {
          inmateId: candidate.inmateId,
          name: `${candidate.canonicalLast}, ${candidate.canonicalFirst}`,
          middle: candidate.canonicalMiddle,
          dateOfBirth: candidate.dateOfBirth?.toISOString().slice(0, 10) ?? null,
          sex: candidate.sex,
          race: candidate.race,
          bookingCount: candidate.bookingCount,
          identityConfidence: candidate.identityConfidence,
          firstSeenAt: candidate.firstSeenAt.toISOString().slice(0, 10),
          lastSeenAt: candidate.lastSeenAt.toISOString().slice(0, 10),
          aliases: candidate.aliases.map((a) => ({
            name: `${a.last}, ${a.first}`,
            dateOfBirth: a.dateOfBirth?.toISOString().slice(0, 10) ?? null,
          })),
          externalIds: candidate.externalIds.map((e) => `${e.facility}:${e.externalId}`),
          recentBookings: candidate.bookings.map((b) => ({
            bookingId: b.bookingId,
            bookedAt: b.bookedAt?.toISOString().slice(0, 10) ?? null,
            releasedAt: b.releasedAt?.toISOString().slice(0, 10) ?? null,
            facility: b.facility,
            externalBookingId: b.externalBookingId,
            housingLocation: b.housingLocation,
          })),
        } : null,
        batch: {
          batchId: r.batch.batchId,
          filename: r.batch.sourceFilename,
          facility: r.batch.facility,
          sourceType: r.batch.sourceType,
          rosterDate: r.batch.rosterDate?.toISOString().slice(0, 10) ?? null,
        },
      };
    }),
  };
}
