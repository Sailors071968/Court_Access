// ============================================================================
// Publishing intelligence for a completed import.
//
// Ingestion writes evidence: import records, observations, identity matches,
// conflicts, change events. This pass reads that evidence and records what the
// engines concluded from it, in order:
//
//   identity → conflicts → changes → watch lists → patterns
//
// The order is the dependency order, and it is what makes the chain real rather
// than nominal. The watch list engine runs fourth because its input is the
// intelligence the first three produced; if it ran first it would have to read
// bookings, which is the coupling the platform is meant to remove.
//
// Publication is separable from ingestion on purpose. It can be re-run for a batch
// after an engine is added, so a facility's history gains the new engine's
// conclusions without re-parsing a single document.
// ============================================================================

import prisma from '../../lib/prisma.js';
import { changeEngine, conflictEngine, findingFromChange, findingFromConflict, repeatOffenderEngine, watchListEngine } from './engines/derivedEngines.js';
import { IDENTITY_ENGINE_NAME, identityVersions } from './engines/identityEngine.js';
import { recordFindings } from './intelligenceRepository.js';
import type { EvidenceContext, IntelligenceFinding } from './types.js';

export interface PublicationResult {
  identity: number;
  conflicts: number;
  changes: number;
  watchListHits: number;
  patterns: number;
  notifications: number;
}

/**
 * Record what the engines concluded about one import.
 *
 * Idempotent by refusal rather than by merge: a second publication for the same
 * batch would double every finding, and a duplicated conclusion is worse than a
 * missing one because a reviewer cannot tell which of the two was acted on.
 */
export async function publishBatchIntelligence(args: {
  batchId: string;
  /** The versions the import ran under, stamped onto every finding. */
  versions?: EvidenceContext['versions'];
}): Promise<PublicationResult> {
  const existing = await prisma.inmateIntelligenceItem.count({
    where: { batchId: args.batchId, runId: null },
  });
  if (existing > 0) {
    return { identity: 0, conflicts: 0, changes: 0, watchListHits: 0, patterns: 0, notifications: 0 };
  }

  const versions = { ...identityVersions(), ...(args.versions ?? {}) };
  const context: EvidenceContext = { batchId: args.batchId, versions, dryRun: false };

  const identity = await publishIdentity(context);
  const conflicts = await publishFrom(conflictEngine, context);
  const changes = await publishChanges(context);

  // Only now, with the batch's intelligence in place, can the watch list engine
  // read it.
  const watchFindings = await watchListEngine.analyse(context);
  const watchIds = await recordFindings(watchListEngine, watchFindings, context);
  const notifications = await raiseNotifications(watchFindings, watchIds, args.batchId);

  const patternContext: EvidenceContext = {
    ...context,
    observationIds: await observationIdsForBatch(args.batchId),
  };
  const patterns = await publishFrom(repeatOffenderEngine, patternContext);

  return {
    identity,
    conflicts,
    changes,
    watchListHits: watchIds.length,
    patterns,
    notifications,
  };
}

/** Identity findings, translated from the matches ingestion already recorded. */
async function publishIdentity(context: EvidenceContext): Promise<number> {
  const records = await prisma.inmateIngestionRecord.findMany({
    where: { batchId: context.batchId },
    orderBy: { lineNumber: 'asc' },
    select: { recordId: true, bookingId: true, resolvedInmateId: true, matchEvidence: true, resolution: true },
  });

  const matches = await prisma.inmateIdentityMatch.findMany({
    where: { importRecordId: { in: records.map((r) => r.recordId) } },
    select: { matchId: true, importRecordId: true },
  });
  const matchByRecord = new Map(matches.map((m) => [m.importRecordId, m.matchId]));

  const bookingIds = records.map((r) => r.bookingId).filter((v): v is string => Boolean(v));
  const observations = bookingIds.length > 0
    ? await prisma.inmateBookingObservation.findMany({
        where: { batchId: context.batchId, bookingId: { in: bookingIds } },
        select: { observationId: true, bookingId: true },
      })
    : [];
  const observationByBooking = new Map(observations.map((o) => [o.bookingId, o.observationId]));

  const findings: IntelligenceFinding[] = [];
  for (const record of records) {
    const evidence = record.matchEvidence as Record<string, unknown> | null;
    if (!evidence) continue;

    const observationId = record.bookingId ? observationByBooking.get(record.bookingId) : undefined;
    const reviewRequired = evidence.humanReviewRequired === true;

    findings.push({
      type: 'identity_candidate',
      severity: reviewRequired ? (Array.isArray(evidence.conflicts) && evidence.conflicts.length > 0 ? 'significant' : 'notable') : 'info',
      subjectKind: 'person',
      subjectId: record.resolvedInmateId ?? undefined,
      confidence: typeof evidence.confidence === 'number' ? evidence.confidence : 0,
      rule: typeof evidence.policyRule === 'string' ? evidence.policyRule : undefined,
      explanation: typeof evidence.reviewRationale === 'string'
        ? evidence.reviewRationale
        : `Identity resolved as ${record.resolution}.`,
      reviewRequired,
      // The import applied the resolution because a booking needs a parent row.
      // Recorded as what happened rather than as a proposal — see the note in
      // identityEngine.ts about why inline application is structural.
      disposition: reviewRequired ? 'proposed' : 'auto_applied',
      evidenceObservationIds: observationId ? [observationId] : [],
      inputs: {
        importRecordIds: [record.recordId],
        foundBy: evidence.foundBy ?? [],
        candidateSetTruncated: evidence.candidateSetTruncated ?? false,
      },
      payload: {
        outcome: record.resolution,
        tier: evidence.tier,
        reasons: evidence.reasons,
        conflicts: evidence.conflicts,
        rejectedCandidates: evidence.rejectedCandidates,
        recommendation: record.resolution === 'matched' ? 'merge'
          : record.resolution === 'needs_review' ? 'review'
          : record.resolution === 'new_inmate' ? 'new_person' : 'no_action',
      },
      detail: matchByRecord.has(record.recordId)
        ? { table: 'inmate_identity_matches', id: matchByRecord.get(record.recordId)! }
        : undefined,
    });
  }

  const ids = await recordFindings({ name: IDENTITY_ENGINE_NAME, version: String(context.versions.confidenceVersion ?? '1.0.0') }, findings, context);
  return ids.length;
}

/** Change findings, translated from the events ingestion already recorded. */
async function publishChanges(context: EvidenceContext): Promise<number> {
  const events = await prisma.inmateChangeEvent.findMany({
    where: { batchId: context.batchId },
    orderBy: { eventId: 'asc' },
    take: 20_000,
  });
  const findings = events.map(findingFromChange);
  const ids = await recordFindings(changeEngine, findings, context);
  return ids.length;
}

/** Conflict findings. */
async function publishFrom(
  engine: typeof conflictEngine | typeof repeatOffenderEngine,
  context: EvidenceContext,
): Promise<number> {
  if (engine === conflictEngine) {
    const conflicts = await prisma.inmateSourceConflict.findMany({
      where: { batchId: context.batchId },
      orderBy: { conflictId: 'asc' },
      take: 20_000,
    });
    const ids = await recordFindings(engine, conflicts.map(findingFromConflict), context);
    return ids.length;
  }
  const findings = await engine.analyse(context);
  const ids = await recordFindings(engine, findings, context);
  return ids.length;
}

async function observationIdsForBatch(batchId: string): Promise<string[]> {
  const rows = await prisma.inmateBookingObservation.findMany({
    where: { batchId },
    select: { observationId: true },
    orderBy: { observationId: 'asc' },
  });
  return rows.map((r) => r.observationId);
}

/**
 * Turn watch list intelligence into the operational records.
 *
 * The match row and the notification are downstream of the finding, not parallel to
 * it: each carries the item id, so a notification an administrator receives at
 * 3am traces back through the finding to the observation to the page of the PDF.
 */
async function raiseNotifications(
  findings: IntelligenceFinding[],
  itemIds: string[],
  batchId: string,
): Promise<number> {
  let raised = 0;

  for (const [index, finding] of findings.entries()) {
    const itemId = itemIds[index];
    const payload = (finding.payload ?? {}) as { entryId?: string; matchType?: string; notify?: boolean };
    if (!payload.entryId || !finding.subjectId) continue;

    const booking = finding.evidenceObservationIds.length > 0
      ? await prisma.inmateBookingObservation.findUnique({
          where: { observationId: finding.evidenceObservationIds[0] },
          select: { bookingId: true, rosterDate: true },
        })
      : null;

    const match = await prisma.inmateWatchListMatch.create({
      data: {
        entryId: payload.entryId,
        inmateId: finding.subjectId,
        bookingId: booking?.bookingId ?? null,
        batchId,
        matchType: payload.matchType ?? 'new_booking',
        rosterDate: booking?.rosterDate ?? null,
      },
      select: { matchId: true },
    });

    if (payload.notify !== false) {
      await prisma.inmateNotification.create({
        data: {
          kind: `watch_list_${payload.matchType ?? 'new_booking'}`,
          severity: finding.severity,
          title: 'Watch list match',
          // The finding's own words, so what an administrator reads is what the
          // engine concluded rather than a second rendering of it.
          body: finding.explanation,
          inmateId: finding.subjectId,
          batchId,
          // Points at the intelligence, not at the booking. A notification is the
          // end of the chain and must lead back up it.
          referenceId: itemId,
        },
      });
      raised += 1;
    }

    await prisma.inmateIntelligenceItem.update({
      where: { itemId },
      data: { detailTable: 'inmate_watch_list_matches', detailId: match.matchId },
    });
  }

  return raised;
}
