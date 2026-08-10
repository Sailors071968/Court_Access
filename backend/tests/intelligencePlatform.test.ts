// ============================================================================
// Tests for the intelligence platform's pure logic.
//
// These cover the parts that decide something without a database: how a finding is
// shaped from evidence, what an engine may and may not claim, and the registry's
// refusal to let two implementations share a name. The persistence behaviour —
// supersession, promotion, review packets — is exercised against a real database by
// scripts/verify-intelligence-platform.ts, because its correctness is a property of
// the transactions rather than of the functions.
//
// The property most worth defending here is that an engine's output distinguishes
// what it did from what it recommends. A finding that says `auto_applied` asserts
// the repository was changed; one that says `proposed` asserts it was not. Confusing
// the two would make the audit trail describe events that never happened.
// ============================================================================

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  changeEngine, conflictEngine, findingFromChange, findingFromConflict,
  repeatOffenderEngine, watchListEngine,
} from '../src/intelligence/platform/engines/derivedEngines.js';
import { findingFromResolution } from '../src/intelligence/platform/engines/identityEngine.js';
import { clearRegistry, describeEngines, getEngine, listEngines, registerEngine } from '../src/intelligence/platform/engineRegistry.js';
import type { IntelligenceEngine } from '../src/intelligence/platform/types.js';
import type { MatchEvidence, ResolutionResult } from '../src/intelligence/inmates/types.js';

// ---------------------------------------------------------------------------
// Conflict findings — the case the platform exists to hold
// ---------------------------------------------------------------------------

const bailConflict = {
  conflictId: 'c1',
  field: 'bailAmountCents',
  valueA: '50000.00',
  sourceA: 'pdf_text',
  valueB: '75000.00',
  sourceB: 'csv',
  resolution: 'unknown',
  observationAId: 'o1',
  observationBId: 'o2',
  bookingId: 'b1',
  inmateId: 'i1',
};

test('an unresolved conflict states UNKNOWN rather than choosing a value', () => {
  const finding = findingFromConflict(bailConflict);
  const payload = finding.payload as { currentTruth: string; observations: unknown[] };

  assert.equal(payload.currentTruth, 'UNKNOWN');
  assert.equal(finding.reviewRequired, true);
  // Nothing was applied, which is the difference between holding a conflict and
  // resolving one.
  assert.equal(finding.disposition, 'proposed');
  assert.equal(payload.observations.length, 2);
});

test('both stated values survive, because the losing value is evidence', () => {
  const payload = findingFromConflict(bailConflict).payload as {
    observations: { source: string; stated: string | null }[];
  };
  const stated = payload.observations.map((o) => `${o.source}=${o.stated}`).sort();
  assert.deepEqual(stated, ['csv=75000.00', 'pdf_text=50000.00']);
});

test('a conflict is certain even when its resolution is not', () => {
  // Confidence describes the conclusion — that the sources disagree — not how sure
  // the platform is about which is right. An unresolved conflict is not a
  // low-confidence finding.
  assert.equal(findingFromConflict(bailConflict).confidence, 100);
});

test('a resolved conflict names the value that won and applies it', () => {
  const finding = findingFromConflict({ ...bailConflict, resolution: 'prefer_b' });
  const payload = finding.payload as { currentTruth: string };

  assert.equal(payload.currentTruth, '75000.00');
  assert.equal(finding.reviewRequired, false);
  assert.equal(finding.disposition, 'auto_applied');
});

test('money and liberty outrank housing in severity', () => {
  const bail = findingFromConflict(bailConflict);
  const housing = findingFromConflict({ ...bailConflict, field: 'housingLocation' });
  const release = findingFromConflict({ ...bailConflict, field: 'releasedAt' });

  assert.equal(bail.severity, 'significant');
  assert.equal(release.severity, 'significant');
  assert.equal(housing.severity, 'info');
});

test('a conflict against a missing value says so instead of showing an empty string', () => {
  const finding = findingFromConflict({ ...bailConflict, valueA: null });
  assert.match(finding.explanation, /states nothing/);
});

test('a conflict points at its typed detail row rather than duplicating it', () => {
  const finding = findingFromConflict(bailConflict);
  assert.deepEqual(finding.detail, { table: 'inmate_source_conflicts', id: 'c1' });
});

// ---------------------------------------------------------------------------
// Change findings
// ---------------------------------------------------------------------------

test('a change is an observed fact, so it is applied rather than proposed', () => {
  const finding = findingFromChange({
    eventId: 'e1', changeType: 'bail_changed', field: 'bailAmountCents',
    previousValue: '50000.00', newValue: '75000.00', material: true,
    inmateId: 'i1', bookingId: 'b1', observationId: 'o1',
  });

  assert.equal(finding.disposition, 'auto_applied');
  assert.equal(finding.reviewRequired, false);
  assert.deepEqual(finding.evidenceObservationIds, ['o1']);
});

test('an immaterial change is recorded but not raised in severity', () => {
  const finding = findingFromChange({
    eventId: 'e2', changeType: 'housing_changed', field: 'housingLocation',
    previousValue: 'A-1', newValue: 'A-2', material: false,
    inmateId: 'i1', bookingId: 'b1', observationId: 'o1',
  });
  assert.equal(finding.severity, 'info');
});

test('a new inmate outranks a release, which outranks a housing move', () => {
  const make = (changeType: string) => findingFromChange({
    eventId: 'e', changeType, field: null, previousValue: null, newValue: null,
    material: true, inmateId: 'i1', bookingId: 'b1', observationId: null,
  }).severity;

  assert.equal(make('new_inmate'), 'significant');
  assert.equal(make('released'), 'notable');
  assert.equal(make('housing_changed'), 'info');
});

// ---------------------------------------------------------------------------
// Identity findings — the recommendation, not the merge
// ---------------------------------------------------------------------------

function evidence(overrides: Partial<MatchEvidence> = {}): MatchEvidence {
  return {
    confidence: 92,
    tier: 'exact_dob',
    reasons: [{ code: 'dob_exact', detail: 'Date of birth matches exactly', weight: 40 }],
    conflicts: [],
    sourceDocuments: [],
    sourceRecordIds: ['r1'],
    rejectedCandidates: [],
    humanReviewRequired: false,
    reviewRationale: 'Automatic.',
    decidedAt: new Date().toISOString(),
    resolverVersion: '1.1.0',
    policyRule: 'exact_identifier',
    ...overrides,
  };
}

function resolution(outcome: ResolutionResult['outcome'], overrides: Partial<MatchEvidence> = {}): ResolutionResult {
  return { outcome, inmateId: 'i1', evidence: evidence(overrides) };
}

test('a finding says what happened, not what was wanted', () => {
  const applied = findingFromResolution({
    result: resolution('matched'), observationIds: ['o1'], applied: true,
  });
  const notApplied = findingFromResolution({
    result: resolution('needs_review', { humanReviewRequired: true }),
    observationIds: ['o1'], applied: false,
  });

  assert.equal(applied.disposition, 'auto_applied');
  assert.equal(notApplied.disposition, 'proposed');
});

test('the recommendation is one of the three permitted outputs, never a merge instruction', () => {
  const recommendationOf = (outcome: ResolutionResult['outcome']) =>
    (findingFromResolution({ result: resolution(outcome), observationIds: [], applied: false }).payload as { recommendation: string }).recommendation;

  assert.equal(recommendationOf('matched'), 'merge');
  assert.equal(recommendationOf('needs_review'), 'review');
  assert.equal(recommendationOf('new_inmate'), 'new_person');
  assert.equal(recommendationOf('duplicate'), 'no_action');
});

test('a truncated candidate set is carried onto the finding', () => {
  // A capped candidate set means a missed match is possible. If that limitation
  // stayed in the resolver's own output it would not be visible where the
  // conclusion is read.
  const finding = findingFromResolution({
    result: resolution('matched', { candidateSetTruncated: true }),
    observationIds: ['o1'], applied: true,
  });
  assert.equal((finding.inputs as { candidateSetTruncated: boolean }).candidateSetTruncated, true);
});

test('a review with conflicts is more significant than a review without', () => {
  const plain = findingFromResolution({
    result: resolution('needs_review', { humanReviewRequired: true }),
    observationIds: [], applied: false,
  });
  const conflicted = findingFromResolution({
    result: resolution('needs_review', {
      humanReviewRequired: true,
      conflicts: [{ code: 'dob_mismatch', detail: 'Dates of birth differ', blocking: true }],
    }),
    observationIds: [], applied: false,
  });

  assert.equal(plain.severity, 'notable');
  assert.equal(conflicted.severity, 'significant');
});

test('an automatic match is low severity however confident it is', () => {
  const finding = findingFromResolution({
    result: resolution('matched', { confidence: 100 }), observationIds: [], applied: true,
  });
  // Attention and certainty are different axes. A clean match needs no attention.
  assert.equal(finding.severity, 'info');
  assert.equal(finding.confidence, 100);
});

test('the explanation names the disagreeing signals, not only the supporting ones', () => {
  const finding = findingFromResolution({
    result: resolution('matched', {
      conflicts: [{ code: 'sex_mismatch', detail: 'Sex differs', blocking: false }],
    }),
    observationIds: [], applied: true,
  });
  assert.match(finding.explanation, /Disagreeing: Sex differs/);
});

test('a finding traces to a named rule rather than to a score', () => {
  const finding = findingFromResolution({
    result: resolution('matched', { policyRule: 'external_person_id' }),
    observationIds: [], applied: true,
  });
  assert.equal(finding.rule, 'external_person_id');
});

// ---------------------------------------------------------------------------
// The engine contract
// ---------------------------------------------------------------------------

test('every engine declares a name, a version and what it produces', () => {
  for (const engine of [conflictEngine, changeEngine, watchListEngine, repeatOffenderEngine]) {
    assert.ok(engine.name.length > 0, `${engine.name} has a name`);
    assert.match(engine.version, /^\d+\.\d+\.\d+$/, `${engine.name} is semantically versioned`);
    assert.ok(engine.produces.length > 0, `${engine.name} declares its output`);
    assert.ok(engine.description.length > 20, `${engine.name} explains itself`);
  }
});

test('the watch list engine is versioned 2.x, because it no longer consumes bookings', () => {
  // The major version records the change in what it reads. A watch list engine
  // that consumed rosters and one that consumes intelligence are not the same
  // engine, and findings from each must be distinguishable.
  assert.match(watchListEngine.version, /^2\./);
  assert.deepEqual(watchListEngine.produces, ['watch_list_hit']);
});

test('the repeat offender engine has no typed detail table, which is the extensibility proof', async () => {
  // It concludes something the schema knows nothing about. If adding an engine
  // required a migration, this is where it would fail.
  const findings = await repeatOffenderEngine.analyse({ versions: {}, dryRun: true });
  assert.deepEqual(findings, [], 'no observations in scope yields no findings');
  assert.deepEqual(repeatOffenderEngine.produces, ['repeat_offender']);
});

test('an engine given no observations concludes nothing rather than everything', async () => {
  // A missing scope must not be read as "all evidence". An engine that analysed the
  // entire repository when asked about nothing would be catastrophic on a dry run.
  const findings = await repeatOffenderEngine.analyse({ versions: {}, dryRun: true });
  assert.equal(findings.length, 0);
});

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

function stubEngine(name: string, version = '1.0.0'): IntelligenceEngine {
  return {
    name, version, produces: ['identity_candidate'],
    description: 'A stub engine used only by the registry tests.',
    analyse: async () => [],
  };
}

test('two implementations cannot share a name', () => {
  clearRegistry();
  registerEngine(stubEngine('duplicate'));
  // The name is stored on every item the engine produces, so sharing one would make
  // those items ambiguous about which code drew the conclusion — unrecoverable
  // after the fact, hence a throw rather than a warning.
  assert.throws(() => registerEngine(stubEngine('duplicate', '2.0.0')), /must identify exactly one implementation/);
  clearRegistry();
});

test('registering the same instance twice is harmless', () => {
  clearRegistry();
  const engine = stubEngine('idempotent');
  registerEngine(engine);
  assert.doesNotThrow(() => registerEngine(engine));
  assert.equal(listEngines().length, 1);
  clearRegistry();
});

test('the registry enumerates deterministically', () => {
  clearRegistry();
  for (const name of ['zulu', 'alpha', 'mike']) registerEngine(stubEngine(name));
  assert.deepEqual(listEngines().map((e) => e.name), ['alpha', 'mike', 'zulu']);
  clearRegistry();
});

test('an unregistered engine is absent rather than fabricated', () => {
  clearRegistry();
  assert.equal(getEngine('nonexistent'), undefined);
  clearRegistry();
});

test('describeEngines exposes the version, since that is what items are stamped with', () => {
  clearRegistry();
  registerEngine(stubEngine('described', '3.1.4'));
  const [described] = describeEngines();
  assert.equal(described.version, '3.1.4');
  assert.equal(described.name, 'described');
  clearRegistry();
});
