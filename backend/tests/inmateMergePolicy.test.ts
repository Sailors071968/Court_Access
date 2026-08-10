// ============================================================================
// Tests for the merge policy — phase 3 of identity resolution.
//
// The policy is the only thing allowed to decide a merge, so these tests are the
// specification of when two records become one person. Two properties matter more
// than any individual case:
//
//   The policy reads named facts, never a score. A test that passes a high
//   confidence and expects a merge would be testing the wrong thing — there is no
//   confidence parameter here at all.
//
//   The date-of-birth policy: a discrepancy is supporting evidence only and never
//   merges on its own. Only a stable unique identifier is overwhelming
//   corroboration.
// ============================================================================

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  breakTie, corroboratingIdentifiers, decideMerge, MERGE_POLICY_VERSION,
  type PolicyInput,
} from '../src/intelligence/inmates/mergePolicy.js';
import type { MatchTier } from '../src/intelligence/inmates/types.js';

/** A same-person case: everything agrees. Individual tests vary one fact. */
function facts(over: Partial<PolicyInput> = {}): PolicyInput {
  return {
    tier: 'exact_identity',
    externalPersonIdMatched: false,
    surnameExact: true,
    surnameVariantKey: false,
    givenNameExact: true,
    givenNameNickname: false,
    givenNameNear: false,
    dobExact: true,
    dobTypo: false,
    dobConflict: false,
    dobUnknown: false,
    middleAgrees: false,
    middleConflict: false,
    suffixCompatible: true,
    sexConflict: false,
    ambiguous: false,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// The policy has no access to a score
// ---------------------------------------------------------------------------

test('the policy input contains no confidence field at all', () => {
  const input = facts();
  assert.equal('confidence' in input, false,
    'if a score could reach the policy, re-weighting a signal could start merging records');
});

// ---------------------------------------------------------------------------
// Automatic merges
// ---------------------------------------------------------------------------

test('exact surname, given name and date of birth merges', () => {
  const d = decideMerge(facts());
  assert.equal(d.action, 'merge');
  assert.equal(d.rule, 'exact_identity');
});

test('a spelling variant of the given name with an exact date of birth merges', () => {
  const d = decideMerge(facts({ givenNameExact: false, givenNameNear: true, tier: 'near_name' }));
  assert.equal(d.action, 'merge');
  assert.equal(d.rule, 'near_name');
});

test('a known nickname with an exact date of birth merges', () => {
  const d = decideMerge(facts({ givenNameExact: false, givenNameNickname: true, tier: 'near_name' }));
  assert.equal(d.action, 'merge');
  assert.equal(d.rule, 'nickname_with_exact_dob');
  assert.match(d.rationale, /known forms of the same name/);
});

test("the facility's own person identifier merges even without a date of birth", () => {
  const d = decideMerge(facts({
    externalPersonIdMatched: true, tier: 'external_person_id',
    dobExact: false, dobUnknown: true, givenNameExact: false, givenNameNear: true,
  }));
  assert.equal(d.action, 'merge');
  assert.equal(d.rule, 'external_person_id');
  assert.match(d.rationale, /assigned by the jail/);
});

// ---------------------------------------------------------------------------
// The date-of-birth policy — the operator's explicit instruction
// ---------------------------------------------------------------------------

test('a date-of-birth discrepancy NEVER merges on its own', () => {
  const d = decideMerge(facts({ dobExact: false, dobTypo: true, tier: 'near_dob' }));
  assert.equal(d.action, 'review');
  assert.equal(d.rule, 'dob_typo_supporting_only');
  assert.match(d.rationale, /supporting evidence only and never merges on its own/);
});

test('a date-of-birth discrepancy does not merge even when several identifiers align', () => {
  const d = decideMerge(facts({
    dobExact: false, dobTypo: true, tier: 'near_dob',
    givenNameExact: true, middleAgrees: true,
  }));
  assert.equal(d.action, 'review', 'name evidence is never overwhelming corroboration');
  assert.match(d.rationale, /3 other identifiers do align/);
});

test('a date-of-birth discrepancy WITH a unique identifier merges — the only exception', () => {
  const d = decideMerge(facts({
    dobExact: false, dobTypo: true, externalPersonIdMatched: true, tier: 'external_person_id',
  }));
  assert.equal(d.action, 'merge');
  assert.equal(d.rule, 'external_person_id');
});

test('conflicting dates of birth with no unique identifier is a new person', () => {
  const d = decideMerge(facts({ dobExact: false, dobConflict: true, tier: 'none' }));
  assert.equal(d.action, 'new_person');
  assert.equal(d.rule, 'dob_conflict_no_unique_identifier');
});

test('a unique identifier plus TWO conflicts goes to review, not a merge', () => {
  const d = decideMerge(facts({
    externalPersonIdMatched: true, dobExact: false, dobConflict: true, surnameExact: false,
  }));
  assert.equal(d.action, 'review');
  assert.equal(d.rule, 'external_id_with_two_conflicts');
  assert.match(d.rationale, /reused or mistyped identifier/);
});

test('names matching with no date of birth anywhere goes to review', () => {
  const d = decideMerge(facts({ dobExact: false, dobUnknown: true, tier: 'near_dob' }));
  assert.equal(d.action, 'review');
  assert.equal(d.rule, 'names_match_no_dob');
  assert.match(d.rationale, /Common names are common/);
});

// ---------------------------------------------------------------------------
// Blocking conditions
// ---------------------------------------------------------------------------

test('incompatible suffixes never merge — the father-and-son case', () => {
  const d = decideMerge(facts({ suffixCompatible: false }));
  assert.equal(d.action, 'review');
  assert.equal(d.rule, 'suffix_conflict');
  assert.match(d.rationale, /father and son/);
});

test('a suffix conflict outranks even a matching unique identifier', () => {
  const d = decideMerge(facts({ suffixCompatible: false, externalPersonIdMatched: true }));
  assert.equal(d.action, 'review', 'JR and SR sharing an SO number is a data problem, not a merge');
});

test('two strong candidates never merge', () => {
  const d = decideMerge(facts({ ambiguous: true }));
  assert.equal(d.action, 'review');
  assert.equal(d.rule, 'ambiguous_candidates');
});

test('a differing surname with no variant key is a new person', () => {
  const d = decideMerge(facts({ surnameExact: false }));
  assert.equal(d.action, 'new_person');
  assert.equal(d.rule, 'surname_differs');
});

test('a surname VARIANT with an exact date of birth and given name goes to review — false-split prevention', () => {
  const d = decideMerge(facts({ surnameExact: false, surnameVariantKey: true }));
  assert.equal(d.action, 'review', 'SMYTH against SMITH must not silently create a duplicate');
  assert.equal(d.rule, 'surname_variant_probable_split');
  assert.match(d.rationale, /more likely one person recorded two ways/);
});

test('a surname variant is never MERGED automatically, however strong the rest', () => {
  for (const over of [
    { givenNameExact: true, middleAgrees: true },
    { givenNameNickname: true, givenNameExact: false },
    { givenNameNear: true, givenNameExact: false },
  ]) {
    const d = decideMerge(facts({ surnameExact: false, surnameVariantKey: true, ...over }));
    assert.notEqual(d.action, 'merge', `merged on an inexact surname: ${JSON.stringify(over)}`);
  }
});

test('a surname variant WITHOUT an exact date of birth is a new person, not review', () => {
  const d = decideMerge(facts({
    surnameExact: false, surnameVariantKey: true, dobExact: false, dobUnknown: true,
  }));
  assert.equal(d.action, 'new_person', 'a sound-alike surname alone is far too weak to queue');
});

test('an exact date of birth with unrelated given names goes to review, not a merge', () => {
  const d = decideMerge(facts({ givenNameExact: false, givenNameNear: false, givenNameNickname: false }));
  assert.equal(d.action, 'review');
  assert.equal(d.rule, 'exact_dob_unrelated_given_name');
  assert.match(d.rationale, /siblings/);
});

test('a near name plus a middle-name conflict goes to review', () => {
  const d = decideMerge(facts({
    givenNameExact: false, givenNameNear: true, middleConflict: true, tier: 'near_name',
  }));
  assert.equal(d.action, 'review');
  assert.equal(d.rule, 'near_name_with_middle_conflict');
});

// ---------------------------------------------------------------------------
// Every decision is explainable
// ---------------------------------------------------------------------------

test('every decision names a rule and gives a rationale', () => {
  const cases: Partial<PolicyInput>[] = [
    {}, { suffixCompatible: false }, { ambiguous: true }, { surnameExact: false },
    { externalPersonIdMatched: true }, { dobExact: false, dobTypo: true },
    { dobExact: false, dobConflict: true }, { dobExact: false, dobUnknown: true },
    { givenNameExact: false }, { givenNameExact: false, givenNameNear: true, middleConflict: true },
    { dobExact: false, dobUnknown: true, givenNameExact: false },
  ];
  for (const over of cases) {
    const d = decideMerge(facts(over));
    assert.ok(d.rule.length > 0, `no rule for ${JSON.stringify(over)}`);
    assert.ok(d.rationale.length > 20, `rationale too thin for ${JSON.stringify(over)}`);
    assert.ok(['merge', 'review', 'new_person'].includes(d.action));
  }
});

test('the policy is deterministic', () => {
  const input = facts({ dobExact: false, dobTypo: true });
  assert.deepEqual(decideMerge(input), decideMerge(input));
});

test('the policy version is pinned and recorded separately from the resolver', () => {
  assert.equal(MERGE_POLICY_VERSION, '1.1.0');
});

// ---------------------------------------------------------------------------
// Corroborating identifiers
// ---------------------------------------------------------------------------

test('corroborating identifiers are counted, not weighted', () => {
  // Surname, given name, middle name and the identifier: four.
  const aligned = corroboratingIdentifiers(facts({ middleAgrees: true, externalPersonIdMatched: true }));
  assert.equal(aligned.length, 4);
  assert.ok(aligned.some((a) => a.includes('surname')));
  assert.ok(aligned.some((a) => a.includes('given name')));
  assert.ok(aligned.some((a) => a.includes('person identifier')));
});

test('a nickname counts as a given-name identifier', () => {
  const aligned = corroboratingIdentifiers(facts({ givenNameExact: false, givenNameNickname: true }));
  assert.ok(aligned.some((a) => a.includes('known form')));
});

// ---------------------------------------------------------------------------
// Deterministic tie-breaking
// ---------------------------------------------------------------------------

const rank = (t: MatchTier): number =>
  ({ exact_booking: 0, external_person_id: 1, exact_identity: 2, near_name: 3, near_dob: 4, none: 5 })[t];

test('tie-breaking orders by tier, then confidence, then a stable id', () => {
  const input = [
    { inmateId: 'ccc', confidence: 90, tier: 'exact_identity' as MatchTier },
    { inmateId: 'aaa', confidence: 90, tier: 'exact_identity' as MatchTier },
    { inmateId: 'bbb', confidence: 95, tier: 'near_name' as MatchTier },
  ];
  const out = breakTie(input, rank);
  assert.deepEqual(out.map((c) => c.inmateId), ['aaa', 'ccc', 'bbb'],
    'tier beats confidence, and the id breaks a true tie');
});

test('tie-breaking gives identical output for identical input regardless of arrival order', () => {
  const a = [
    { inmateId: 'zzz', confidence: 80, tier: 'near_dob' as MatchTier },
    { inmateId: 'aaa', confidence: 80, tier: 'near_dob' as MatchTier },
  ];
  const b = [...a].reverse();
  assert.deepEqual(breakTie(a, rank).map((c) => c.inmateId), breakTie(b, rank).map((c) => c.inmateId));
});

test('tie-breaking does not mutate its input', () => {
  const input = [
    { inmateId: 'zzz', confidence: 80, tier: 'near_dob' as MatchTier },
    { inmateId: 'aaa', confidence: 80, tier: 'near_dob' as MatchTier },
  ];
  const before = input.map((c) => c.inmateId).join(',');
  breakTie(input, rank);
  assert.equal(input.map((c) => c.inmateId).join(','), before);
});
