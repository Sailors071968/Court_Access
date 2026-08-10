// ============================================================================
// Merge policy — phase 3 of identity resolution.
//
// Three phases, deliberately separate files so they cannot be conflated:
//
//   1. candidateGeneration.ts  maximise RECALL — find everyone who might be them
//   2. identityResolution.ts   maximise PRECISION — rank the evidence
//   3. mergePolicy.ts          DECIDE — rule-based, deterministic
//
// This file contains the decision and nothing else. It reads an assessment and
// returns an action. It does not score, does not query, and does not know how the
// candidates were found.
//
// The rule that makes the separation worth enforcing: **scoring weights alone may
// never decide a merge.** If the gate were `confidence >= 80`, re-weighting a
// signal — routine maintenance — could silently begin merging records that
// previously went to review. The policy below reads named facts, not a number.
// Confidence explains the decision; it does not make it.
//
// Date-of-birth policy, as set by the operator:
//
//   - Exact DOB is the strongest name-based evidence.
//   - A minor discrepancy (transposition, OCR error) is **supporting evidence
//     only**, and never sufficient on its own — it may contribute only when
//     multiple other identifiers align.
//   - Conflicting DOBs go to human review unless there is overwhelming
//     corroboration, meaning a stable unique identifier such as the facility's
//     own person number.
//
// The policy favours avoiding false merges over maximising automatic matches: a
// missed match can be corrected later, an incorrect merge contaminates a person's
// historical record and is much harder to unwind.
// ============================================================================

import type { MatchTier } from './types.js';

/** The named facts the policy is allowed to read. Nothing else. */
export interface PolicyInput {
  tier: MatchTier;
  /** The facility's own person identifier matched an existing person. */
  externalPersonIdMatched: boolean;
  /** Surnames agree exactly after normalization. */
  surnameExact: boolean;
  /** The surname did not match exactly, but the candidate was reached by a
   *  variant key — phonetic, collapsed shape, an alias, or a compound part. */
  surnameVariantKey: boolean;
  /** Given names agree exactly. */
  givenNameExact: boolean;
  /** Given names are known forms of the same name (ROBERT / BOB). */
  givenNameNickname: boolean;
  /** Given names differ only by spelling, within the edit-distance bound. */
  givenNameNear: boolean;
  /** Dates of birth are identical. */
  dobExact: boolean;
  /** Dates of birth differ in a way a typing error explains. */
  dobTypo: boolean;
  /** Dates of birth differ beyond a plausible typing error. */
  dobConflict: boolean;
  /** Neither side has a date of birth to compare. */
  dobUnknown: boolean;
  /** Middle names or initials agree. */
  middleAgrees: boolean;
  /** Middle names are both present and disagree. */
  middleConflict: boolean;
  /** Generational suffixes are compatible (absent counts as compatible). */
  suffixCompatible: boolean;
  /** Recorded sex is present on both sides and disagrees. */
  sexConflict: boolean;
  /** More than one candidate reached a tier the policy would act on. */
  ambiguous: boolean;
}

export type PolicyAction = 'merge' | 'new_person' | 'review';

export interface PolicyDecision {
  action: PolicyAction;
  /** The rule that fired, by name, so a decision can be traced to a line here. */
  rule: string;
  /** Why, in a sentence an administrator reads. */
  rationale: string;
}

/** Bumped when any rule below changes. Stored on every decision. */
export const MERGE_POLICY_VERSION = '1.1.0';

/**
 * How many independent identifiers agree, excluding date of birth.
 *
 * Used only by the DOB-typo rule, which requires "multiple other identifiers
 * aligned". Counted, not weighted, so the requirement is a fact rather than a
 * threshold on a score.
 */
export function corroboratingIdentifiers(input: PolicyInput): string[] {
  const aligned: string[] = [];
  if (input.surnameExact) aligned.push('surname exact');
  if (input.givenNameExact) aligned.push('given name exact');
  else if (input.givenNameNickname) aligned.push('given name a known form of the same name');
  if (input.middleAgrees) aligned.push('middle name or initial agrees');
  if (input.externalPersonIdMatched) aligned.push("the facility's own person identifier");
  return aligned;
}

/**
 * Decide. Rules are evaluated in order and the first match wins, so the ordering
 * is the policy.
 */
export function decideMerge(input: PolicyInput): PolicyDecision {
  // --- Blocking conditions, before any positive rule ----------------------

  // Two different people, one of whom is the other's father or son. Rosters
  // record these with identical names and identical addresses.
  if (!input.suffixCompatible) {
    return {
      action: 'review',
      rule: 'suffix_conflict',
      rationale: 'The generational suffixes differ (for example JR and SR). These are frequently father and son with the same name, so this is never merged automatically.',
    };
  }

  // Whichever candidate were chosen, another was nearly as good.
  if (input.ambiguous) {
    return {
      action: 'review',
      rule: 'ambiguous_candidates',
      rationale: 'More than one existing person matches this row strongly enough to be it. Merging would pick one arbitrarily, so a person must choose.',
    };
  }

  // --- The unique identifier: stronger than name and date of birth together --

  if (input.externalPersonIdMatched) {
    if (input.dobConflict && !input.surnameExact) {
      return {
        action: 'review',
        rule: 'external_id_with_two_conflicts',
        rationale: "The facility's own person identifier matches, but both the surname and the date of birth disagree. That is more likely a reused or mistyped identifier than the same person, so a human decides.",
      };
    }
    return {
      action: 'merge',
      rule: 'external_person_id',
      rationale: "The facility's own person identifier matches an existing person. That identifier is assigned by the jail and is stable across bookings, so it is stronger evidence than name and date of birth together.",
    };
  }

  // --- Name and date of birth ---------------------------------------------

  // --- Inexact surname: never a merge, but not automatically a new person ----
  //
  // This is false-split prevention, and it is the reason phonetic and collapsed
  // blocking are worth having at all. SMYTH with SMITH's exact date of birth and
  // given name is very probably one person — but merging on an inexact surname is
  // the false merge the whole design avoids. So it is surfaced rather than
  // decided: recording it as someone new would create the duplicate silently, and
  // a silent duplicate is what puts an already-known person on the newly
  // discovered report.
  if (!input.surnameExact) {
    if (input.surnameVariantKey && input.dobExact
        && (input.givenNameExact || input.givenNameNickname || input.givenNameNear)) {
      return {
        action: 'review',
        rule: 'surname_variant_probable_split',
        rationale: 'The surnames differ but sound or look alike, and the date of birth and given name both agree. That is more likely one person recorded two ways than two people, but an inexact surname is never merged automatically — so a person decides.',
      };
    }
    if (input.surnameVariantKey && input.dobExact) {
      return {
        action: 'review',
        rule: 'surname_variant_exact_dob',
        rationale: 'The surnames differ but sound or look alike and the dates of birth are identical. Queued for a person rather than recorded as someone new, because a silent duplicate is as damaging as a wrong merge.',
      };
    }
    return {
      action: 'new_person',
      rule: 'surname_differs',
      rationale: 'No existing person shares this surname, and no variant of it matched with corroborating evidence. Recorded as a person not previously seen.',
    };
  }

  if (input.dobExact) {
    if (input.givenNameExact) {
      return {
        action: 'merge',
        rule: 'exact_identity',
        rationale: 'Surname, given name and date of birth all match exactly, so the booking was attached to the existing person.',
      };
    }
    if (input.givenNameNear || input.givenNameNickname) {
      // A middle-name conflict on top of an inexact given name is two
      // disagreements about the same person's name, which is enough to stop.
      if (input.middleConflict) {
        return {
          action: 'review',
          rule: 'near_name_with_middle_conflict',
          rationale: 'The date of birth matches and the given name is close, but the middle names disagree. Two family members often share a date of birth is rare — but two records of different people with one shared birthday and a similar first name is not, so a person decides.',
        };
      }
      return {
        action: 'merge',
        rule: input.givenNameNickname ? 'nickname_with_exact_dob' : 'near_name',
        rationale: input.givenNameNickname
          ? 'Surname and date of birth match exactly and the given names are known forms of the same name, so the booking was attached to the existing person.'
          : 'Surname and date of birth match exactly and the given name differs only by spelling, so the booking was attached to the existing person.',
      };
    }
    return {
      action: 'review',
      rule: 'exact_dob_unrelated_given_name',
      rationale: 'The surname and date of birth match but the given names are unrelated. That is as likely to be two siblings or a data error as one person, so a human decides.',
    };
  }

  // --- The date-of-birth discrepancy rule ---------------------------------
  //
  // Policy: a minor discrepancy is supporting evidence only, and never
  // sufficient on its own. It may contribute when multiple other identifiers
  // align — and even then it does not reach merge, because no combination of
  // name evidence is "overwhelming corroboration" in the sense the policy means.
  // Only a stable unique identifier is, and that was handled above.

  if (input.dobTypo) {
    const aligned = corroboratingIdentifiers(input);
    return {
      action: 'review',
      rule: 'dob_typo_supporting_only',
      rationale:
        `The names match but the dates of birth are not identical. A typing error and two different people with the same name look the same here, so a discrepancy is treated as supporting evidence only and never merges on its own. ` +
        (aligned.length >= 2
          ? `${aligned.length} other identifiers do align (${aligned.join('; ')}), which is why this is queued for a person rather than recorded as someone new.`
          : `Only ${aligned.length} other identifier aligns, so the evidence is weak as well as inconclusive.`),
    };
  }

  if (input.dobConflict) {
    return {
      action: 'new_person',
      rule: 'dob_conflict_no_unique_identifier',
      rationale: 'The dates of birth differ beyond a plausible typing error and there is no stable unique identifier to corroborate. Recorded as a person not previously seen rather than merged.',
    };
  }

  if (input.dobUnknown) {
    // Names alone. Common names are common, and creating a duplicate silently is
    // as damaging as merging incorrectly, so the collision is surfaced.
    if (input.givenNameExact || input.givenNameNickname) {
      return {
        action: 'review',
        rule: 'names_match_no_dob',
        rationale: 'The names match but neither record has a date of birth to confirm it. Common names are common, so this is queued for a person rather than merged or silently duplicated.',
      };
    }
    return {
      action: 'new_person',
      rule: 'weak_name_no_dob',
      rationale: 'The surname matches but the given names differ and there is no date of birth on either side. Too little evidence to attach this to an existing person.',
    };
  }

  return {
    action: 'new_person',
    rule: 'no_rule_matched',
    rationale: 'No rule found sufficient evidence to attach this booking to an existing person.',
  };
}

/**
 * Deterministic tie-breaking between candidates the policy would treat alike.
 *
 * Used only when ranking has already produced equal tiers and equal confidence.
 * Ordering by `inmateId` is arbitrary but **stable**, which is the requirement:
 * identical inputs must produce identical outputs, and a database's natural order
 * is not a guarantee of anything.
 */
export function breakTie<T extends { inmateId: string; confidence: number; tier: MatchTier }>(
  candidates: T[],
  tierRank: (t: MatchTier) => number,
): T[] {
  return [...candidates].sort((a, b) =>
    (tierRank(a.tier) - tierRank(b.tier))
    || (b.confidence - a.confidence)
    || a.inmateId.localeCompare(b.inmateId));
}
