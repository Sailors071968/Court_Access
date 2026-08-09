// ============================================================================
// Identity resolution engine.
//
// The riskiest code in the subsystem. A false match merges two people's arrest
// histories; a missed match splits one person into two and makes them look newly
// arrested every time. Neither produces an error at the moment it happens, so
// the only defence is that every decision carries its evidence and the weak
// tiers refuse to decide alone.
//
// Two rules that the rest of the design depends on:
//
//   1. `near_dob` never merges automatically. A transposed birth year and two
//      different people with a common surname are the same shape of evidence,
//      and no score distinguishes them. A human does.
//   2. The tier decides; the confidence score describes. Deriving the gate from
//      the score would mean a tuning change silently starts merging records.
//
// Pure apart from the candidate list it is given, so it can be tested against
// constructed candidates without a database.
// ============================================================================

import type {
  InmateCandidate, MatchConflict, MatchReason, MatchTier,
  NormalizedRecord, RejectedCandidate, ResolutionOutcome, ResolutionResult,
  SourceDocument,
} from './types.js';

/** Bumped when the tiers or weights change, so old decisions stay readable. */
export const RESOLVER_VERSION = '1.0.0';

/** Edit distance at which two given names are treated as the same name. */
export const FIRST_NAME_DISTANCE = 2;

/**
 * Date-of-birth differences that typing explains: a transposed pair of digits,
 * one wrong digit, or a swapped month and day. Anything else is a different
 * person, not a typo.
 */
export type DobRelation = 'exact' | 'typo' | 'different';

export interface ResolveInput {
  record: NormalizedRecord;
  candidates: InmateCandidate[];
  /** Bookings already known for a candidate, keyed by inmateId, used to detect
   *  the same booking arriving twice. */
  existingBookingKeys: Set<string>;
  /** The booking identity of the incoming row. See deduplication.ts. */
  incomingBookingKey: string;
  sourceDocument: SourceDocument;
  sourceRecordIds?: string[];
}

// ---------------------------------------------------------------------------
// Distance helpers
// ---------------------------------------------------------------------------

/** Levenshtein distance, bounded: once it exceeds `max` the exact value stops
 *  mattering and the work can stop. */
export function editDistance(a: string, b: string, max = 4): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

/** Classify how two dates of birth differ. */
export function compareDob(incoming: string | undefined, existing: Date | null | undefined): DobRelation | 'unknown' {
  if (!incoming || !existing) return 'unknown';
  const a = incoming.slice(0, 10);
  const b = existing.toISOString().slice(0, 10);
  if (a === b) return 'exact';

  const [ay, am, ad] = a.split('-');
  const [by, bm, bd] = b.split('-');

  // Month and day swapped — the classic consequence of two systems disagreeing
  // about mm/dd versus dd/mm.
  if (ay === by && am === bd && ad === bm) return 'typo';

  // Same day, year differs by a single transposition or one digit.
  if (am === bm && ad === bd && isDigitTypo(ay, by)) return 'typo';
  // Same year, one wrong digit in the month or day.
  if (ay === by && ((am === bm && isDigitTypo(ad, bd)) || (ad === bd && isDigitTypo(am, bm)))) return 'typo';

  return 'different';
}

/** One substitution, or one adjacent transposition. */
function isDigitTypo(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const diff: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
  if (diff.length === 1) return true;
  if (diff.length === 2 && diff[1] === diff[0] + 1) {
    return a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
  }
  return false;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

interface Assessment {
  tier: MatchTier;
  confidence: number;
  reasons: MatchReason[];
  conflicts: MatchConflict[];
}

/** Compare one candidate against the incoming row. */
function assess(record: NormalizedRecord, candidate: InmateCandidate): Assessment {
  const reasons: MatchReason[] = [];
  const conflicts: MatchConflict[] = [];

  const lastExact = record.last === candidate.canonicalLast.toUpperCase();
  const firstExact = record.first === candidate.canonicalFirst.toUpperCase();
  const firstDistance = editDistance(record.first, candidate.canonicalFirst.toUpperCase(), FIRST_NAME_DISTANCE + 1);
  const dob = compareDob(record.dateOfBirth, candidate.dateOfBirth);

  if (lastExact) {
    reasons.push({ code: 'last_name_exact', detail: `Surname "${record.last}" matches exactly.`, weight: 30 });
  } else {
    conflicts.push({
      code: 'last_name_differs',
      detail: 'Surnames are not the same.',
      existing: candidate.canonicalLast,
      incoming: record.last,
      blocking: true,
    });
  }

  if (firstExact) {
    reasons.push({ code: 'first_name_exact', detail: `Given name "${record.first}" matches exactly.`, weight: 25 });
  } else if (firstDistance <= FIRST_NAME_DISTANCE) {
    reasons.push({
      code: 'first_name_near',
      detail: `Given name "${record.first}" is ${firstDistance} character${firstDistance === 1 ? '' : 's'} from "${candidate.canonicalFirst}".`,
      weight: 15,
    });
  } else {
    conflicts.push({
      code: 'first_name_differs',
      detail: `Given names differ by more than ${FIRST_NAME_DISTANCE} characters.`,
      existing: candidate.canonicalFirst,
      incoming: record.first,
      blocking: true,
    });
  }

  switch (dob) {
    case 'exact':
      reasons.push({ code: 'dob_exact', detail: `Date of birth ${record.dateOfBirth} matches exactly.`, weight: 40 });
      break;
    case 'typo':
      reasons.push({
        code: 'dob_typo',
        detail: `Dates of birth differ in a way a typing error explains (${record.dateOfBirth} vs ${candidate.dateOfBirth?.toISOString().slice(0, 10)}).`,
        weight: 18,
      });
      conflicts.push({
        code: 'dob_mismatch',
        detail: 'Dates of birth are not identical.',
        existing: candidate.dateOfBirth?.toISOString().slice(0, 10),
        incoming: record.dateOfBirth,
        blocking: false,
      });
      break;
    case 'different':
      conflicts.push({
        code: 'dob_differs',
        detail: 'Dates of birth are different beyond a plausible typing error.',
        existing: candidate.dateOfBirth?.toISOString().slice(0, 10),
        incoming: record.dateOfBirth,
        blocking: true,
      });
      break;
    case 'unknown':
      conflicts.push({
        code: 'dob_unknown',
        detail: record.dateOfBirth
          ? 'The existing record has no date of birth to compare.'
          : 'The incoming row has no date of birth.',
        blocking: false,
      });
      break;
  }

  // Sex disagreeing is not conclusive on its own — rosters record it
  // inconsistently and it is sometimes blank — but it belongs in the evidence.
  if (record.sex && record.sex !== 'unknown' && candidate.sex && candidate.sex !== 'unknown'
      && record.sex !== candidate.sex) {
    conflicts.push({
      code: 'sex_differs',
      detail: 'Recorded sex differs between the two records.',
      existing: candidate.sex,
      incoming: record.sex,
      blocking: false,
    });
  }

  if (record.middle && candidate.canonicalMiddle) {
    const middleExact = record.middle === candidate.canonicalMiddle.toUpperCase();
    const initialMatch = record.middle[0] === candidate.canonicalMiddle[0]?.toUpperCase();
    if (middleExact) {
      reasons.push({ code: 'middle_name_exact', detail: 'Middle name matches.', weight: 5 });
    } else if (initialMatch) {
      reasons.push({ code: 'middle_initial_match', detail: 'Middle initial matches.', weight: 2 });
    } else {
      conflicts.push({
        code: 'middle_name_differs',
        detail: 'Middle names differ.',
        existing: candidate.canonicalMiddle,
        incoming: record.middle,
        blocking: false,
      });
    }
  }

  const tier = deriveTier({ lastExact, firstExact, firstDistance, dob });
  const confidence = Math.max(0, Math.min(100, reasons.reduce((sum, r) => sum + r.weight, 0)));
  return { tier, confidence, reasons, conflicts };
}

function deriveTier(f: {
  lastExact: boolean; firstExact: boolean; firstDistance: number; dob: DobRelation | 'unknown';
}): MatchTier {
  if (!f.lastExact) return 'none';
  if (f.dob === 'exact' && f.firstExact) return 'exact_identity';
  if (f.dob === 'exact' && f.firstDistance <= FIRST_NAME_DISTANCE) return 'near_name';
  if (f.dob === 'typo' && (f.firstExact || f.firstDistance <= FIRST_NAME_DISTANCE)) return 'near_dob';
  // Names alone, with no date of birth on either side, is too weak to merge on:
  // common names are common. It goes to review rather than to a new person, so
  // a human sees the collision.
  if (f.dob === 'unknown' && f.firstExact) return 'near_dob';
  return 'none';
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** Which tiers may be applied without a person looking at them. */
const AUTOMATIC_TIERS: ReadonlySet<MatchTier> = new Set<MatchTier>([
  'exact_booking', 'exact_identity', 'near_name',
]);

/**
 * Decide what the incoming row is: the same booking already held, an existing
 * person, a new person, or something a human has to look at.
 */
export function resolveIdentity(input: ResolveInput): ResolutionResult {
  const { record, candidates, existingBookingKeys, incomingBookingKey, sourceDocument } = input;
  const decidedAt = new Date().toISOString();
  const sourceRecordIds = input.sourceRecordIds ?? [];

  // Tier 1. The same booking, seen again. Checked before identity because it is
  // the only tier that is certain, and re-ingesting a roster must be a no-op.
  if (existingBookingKeys.has(incomingBookingKey)) {
    return {
      outcome: 'duplicate',
      evidence: {
        confidence: 100,
        tier: 'exact_booking',
        reasons: [{
          code: 'booking_already_present',
          detail: 'A booking with this identity is already recorded.',
          weight: 100,
        }],
        conflicts: [],
        sourceDocuments: [sourceDocument],
        sourceRecordIds,
        rejectedCandidates: [],
        humanReviewRequired: false,
        reviewRationale: 'The same booking is already in the repository, so nothing was written.',
        decidedAt,
        resolverVersion: RESOLVER_VERSION,
      },
    };
  }

  const assessments = candidates
    .map((candidate) => ({ candidate, ...assess(record, candidate) }))
    .filter((a) => a.tier !== 'none')
    .sort((a, b) => (tierRank(a.tier) - tierRank(b.tier)) || (b.confidence - a.confidence));

  if (assessments.length === 0) {
    return {
      outcome: 'new_inmate',
      evidence: {
        confidence: 100,
        tier: 'none',
        reasons: [{
          code: 'no_candidate_matched',
          detail: candidates.length === 0
            ? 'No existing record shares this surname.'
            : `${candidates.length} record(s) share the surname; none matched on given name or date of birth.`,
          weight: 100,
        }],
        conflicts: [],
        sourceDocuments: [sourceDocument],
        sourceRecordIds,
        rejectedCandidates: candidates.map((c) => ({
          inmateId: c.inmateId,
          name: `${c.canonicalLast}, ${c.canonicalFirst}`,
          confidence: 0,
          reason: 'Considered by surname; rejected on given name or date of birth.',
        })),
        humanReviewRequired: false,
        reviewRationale: 'Nothing matched, so this is recorded as a person not previously seen.',
        decidedAt,
        resolverVersion: RESOLVER_VERSION,
      },
    };
  }

  const best = assessments[0];
  const rejected: RejectedCandidate[] = assessments.slice(1).map((a) => ({
    inmateId: a.candidate.inmateId,
    name: `${a.candidate.canonicalLast}, ${a.candidate.canonicalFirst}`,
    confidence: a.confidence,
    reason: `Weaker match (${a.tier}) than the chosen candidate.`,
  }));

  // More than one candidate reaching an automatic tier is itself a reason to
  // stop: whichever is picked, the other was nearly as good.
  const contenders = assessments.filter((a) => AUTOMATIC_TIERS.has(a.tier));
  const ambiguous = contenders.length > 1;

  const automatic = AUTOMATIC_TIERS.has(best.tier) && !ambiguous;
  const outcome: ResolutionOutcome = automatic ? 'matched' : 'needs_review';

  const conflicts = [...best.conflicts];
  if (ambiguous) {
    conflicts.push({
      code: 'multiple_strong_candidates',
      detail: `${contenders.length} existing records match strongly enough to be this person.`,
      blocking: true,
    });
  }

  return {
    outcome,
    inmateId: best.candidate.inmateId,
    evidence: {
      confidence: best.confidence,
      tier: best.tier,
      reasons: best.reasons,
      conflicts,
      sourceDocuments: [sourceDocument],
      sourceRecordIds,
      rejectedCandidates: rejected,
      humanReviewRequired: !automatic,
      reviewRationale: buildRationale(best.tier, ambiguous, contenders.length),
      decidedAt,
      resolverVersion: RESOLVER_VERSION,
    },
  };
}

function buildRationale(tier: MatchTier, ambiguous: boolean, contenders: number): string {
  if (ambiguous) {
    return `${contenders} existing people match this row strongly enough to be it. Merging would pick one arbitrarily, so a person must choose.`;
  }
  switch (tier) {
    case 'exact_identity':
      return 'Surname, given name and date of birth all match exactly, so the booking was attached to the existing person.';
    case 'near_name':
      return 'Date of birth and surname match exactly and the given name differs only by spelling, so the booking was attached to the existing person.';
    case 'near_dob':
      return 'The names match but the dates of birth are not identical. A typing error and two different people with the same name look the same here, so this is not merged automatically.';
    default:
      return 'The evidence was too weak to attach this booking to an existing person automatically.';
  }
}

function tierRank(tier: MatchTier): number {
  return { exact_booking: 0, exact_identity: 1, near_name: 2, near_dob: 3, none: 4 }[tier];
}
