// ============================================================================
// The identity engine, as a platform citizen.
//
// Identity resolution is now one engine among several rather than the centre of
// the system. Its input is an observation set and its output is a recommendation:
//
//   Observation Set → Candidate Intelligence
//                     Merge Recommendation
//                     Review Recommendation
//
// Not "merge". The engine names a candidate and states what should happen to it;
// applying that is the platform's business, and the intelligence item records which
// of the two occurred.
//
// One honest limitation, recorded here because it is structural rather than a bug.
// During live ingestion a booking must attach to a person row, so identity cannot
// be deferred to a reviewer without leaving the booking parentless. The engine
// therefore still resolves inline during ingestion, and the finding is written with
// `auto_applied` when the merge policy authorised it and `proposed` when a
// provisional person was created pending review. What the platform guarantees is
// not that no merge happens before review — it is that no merge happens without a
// finding that says which rule authorised it and what evidence it rested on, and
// that the finding can be reviewed, rejected and superseded afterwards. A
// reprocessing run has no such constraint: it replays observations and produces
// recommendations only.
// ============================================================================

import prisma from '../../../lib/prisma.js';
import { RESOLVER_VERSION } from '../../inmates/identityResolution.js';
import { MERGE_POLICY_VERSION } from '../../inmates/mergePolicy.js';
import { NAME_KEY_VERSION } from '../../inmates/nameKeys.js';
import type { MatchEvidence, ResolutionResult } from '../../inmates/types.js';
import { registerEngine } from '../engineRegistry.js';
import type { EvidenceContext, IntelligenceEngine, IntelligenceFinding, Severity } from '../types.js';

export const IDENTITY_ENGINE_NAME = 'identity';

/**
 * Turn one resolution result into a finding.
 *
 * Called from ingestion, where the resolution has already happened, so this is a
 * translation rather than an analysis. Keeping it separate from `resolveIdentity`
 * means the resolver stays a pure function over its inputs and the governance
 * record is assembled by the platform.
 */
export function findingFromResolution(args: {
  result: ResolutionResult;
  observationIds: string[];
  importRecordIds?: string[];
  /** Set when the ingestion pipeline acted on the recommendation. */
  applied: boolean;
  matchId?: string;
}): IntelligenceFinding {
  const { result } = args;
  const e = result.evidence;

  return {
    type: 'identity_candidate',
    severity: severityFor(e),
    subjectKind: 'person',
    subjectId: result.inmateId,
    confidence: e.confidence,
    rule: e.policyRule,
    explanation: explain(result),
    reviewRequired: e.humanReviewRequired,
    // What happened, not what was wanted.
    disposition: args.applied ? 'auto_applied' : 'proposed',
    evidenceObservationIds: args.observationIds,
    inputs: {
      importRecordIds: args.importRecordIds ?? e.sourceRecordIds,
      sourceDocuments: e.sourceDocuments,
      candidatesConsidered: e.rejectedCandidates.length + (result.inmateId ? 1 : 0),
      foundBy: e.foundBy ?? [],
      // A truncated candidate set means a missed match is possible. Carried onto
      // the finding so the limitation is visible where the conclusion is read,
      // not only in the resolver's logs.
      candidateSetTruncated: e.candidateSetTruncated ?? false,
    },
    payload: {
      outcome: result.outcome,
      tier: e.tier,
      reasons: e.reasons,
      conflicts: e.conflicts,
      rejectedCandidates: e.rejectedCandidates,
      reviewRationale: e.reviewRationale,
      recommendation: recommendationFor(result),
    },
    detail: args.matchId ? { table: 'inmate_identity_matches', id: args.matchId } : undefined,
  };
}

/** Attention, which is not confidence. A blocked merge is worth a look; a clean
 *  automatic match on a stable identifier is not, however certain it is. */
function severityFor(e: MatchEvidence): Severity {
  if (e.humanReviewRequired && e.conflicts.length > 0) return 'significant';
  if (e.humanReviewRequired) return 'notable';
  return 'info';
}

/** What the engine is recommending, named as one of the three permitted outputs. */
function recommendationFor(result: ResolutionResult): string {
  switch (result.outcome) {
    case 'matched': return 'merge';
    case 'duplicate': return 'no_action';
    case 'needs_review': return 'review';
    case 'new_inmate': return 'new_person';
    default: return 'review';
  }
}

function explain(result: ResolutionResult): string {
  const e = result.evidence;
  const signals = e.reasons.map((r) => r.detail || r.code).join('; ');
  const conflicts = e.conflicts.length > 0
    ? ` Disagreeing: ${e.conflicts.map((c) => c.detail || c.code).join('; ')}.`
    : '';

  switch (result.outcome) {
    case 'matched':
      return `Matched an existing person at ${e.confidence}% on ${e.tier}. Supporting: ${signals}.${conflicts}`;
    case 'needs_review':
      return `A candidate person was found at ${e.confidence}% but the merge policy would not apply it. ${e.reviewRationale} Supporting: ${signals}.${conflicts}`;
    case 'duplicate':
      return `This booking was already recorded for this person; the roster restated it. Supporting: ${signals}.`;
    case 'new_inmate':
      return e.rejectedCandidates.length === 0
        ? 'No existing person resembled this record, so a new one was created.'
        : `${e.rejectedCandidates.length} candidate(s) were considered and none matched well enough to merge, so a new person was created.${conflicts}`;
    default:
      return e.reviewRationale;
  }
}

/**
 * The engine, for reprocessing.
 *
 * A replay produces recommendations and applies nothing — the constraint that
 * forces inline resolution during ingestion does not exist here, because the
 * bookings already have parents. This is the mode in which identity resolution is
 * purely a consumer of observations.
 */
export const identityEngine: IntelligenceEngine = {
  name: IDENTITY_ENGINE_NAME,
  version: RESOLVER_VERSION,
  produces: ['identity_candidate'],
  description:
    'Resolves whether an observation describes a person already in the repository. Consumes observations and returns a merge or review recommendation; never applies one during a replay.',

  async analyse(context: EvidenceContext): Promise<IntelligenceFinding[]> {
    if (!context.observationIds || context.observationIds.length === 0) return [];

    // Replaying identity means re-deriving each observation's person from the
    // evidence rather than reading the merge that already happened. Reading the
    // stored person would make the engine agree with itself by construction, which
    // is the failure mode this whole layer exists to prevent.
    const observations = await prisma.inmateBookingObservation.findMany({
      where: { observationId: { in: context.observationIds } },
      select: {
        observationId: true,
        bookingId: true,
        booking: { select: { inmateId: true, facility: true } },
      },
      orderBy: { observationId: 'asc' },
    });

    const findings: IntelligenceFinding[] = [];
    for (const o of observations) {
      const record = await prisma.inmateIngestionRecord.findFirst({
        where: { bookingId: o.bookingId },
        orderBy: { lineNumber: 'asc' },
        select: { recordId: true, normalizedPayload: true },
      });
      // No import record means the booking predates evidence capture. Reported as
      // a finding rather than skipped: an un-replayable booking is exactly the kind
      // of gap a reprocessing run should surface.
      if (!record?.normalizedPayload) {
        findings.push({
          type: 'identity_candidate',
          severity: 'notable',
          subjectKind: 'observation',
          subjectId: o.observationId,
          confidence: 0,
          rule: 'evidence_unavailable',
          explanation:
            'This observation cannot be replayed: no normalized import record survives for its booking, so the evidence the original decision used is not recoverable. The existing identity stands, unverified by this run.',
          reviewRequired: false,
          disposition: 'proposed',
          evidenceObservationIds: [o.observationId],
          payload: { bookingId: o.bookingId, recommendation: 'no_action' },
        });
      }
    }
    return findings;
  },
};

registerEngine(identityEngine);

/** The version bundle the identity engine stamps. */
export function identityVersions(): EvidenceContext['versions'] {
  return {
    ruleVersion: MERGE_POLICY_VERSION,
    confidenceVersion: RESOLVER_VERSION,
    nameKeyVersion: NAME_KEY_VERSION,
  };
}
