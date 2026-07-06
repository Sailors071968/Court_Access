// ============================================
// Court Access — Onboarding Event Ledger (Phase O7)
// Immutable Onboarding Event Entity Builder
//
// Creates immutable, dual-hashed onboarding event entities
// for the attorney onboarding pipeline's audit trail.
//
// Two-pass derivation:
//   Pass 1: pre-ID canonical (excludes onboardingEventId, sha256, sha3_256) → onboardingEventId
//   Pass 2: full canonical (includes onboardingEventId, excludes sha256, sha3_256) → dual-hash
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - Append-only (no update, no delete)
//
// Architectural boundary:
//   - Only imports policyIngestionService for hashing
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access
//   - No SES calls
//   - No escalation building
//   - No dispatch calls
//   - No anchor modifications
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of any entity
//   - No deletion
//   - Deterministic processing
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  OnboardingEventEntity,
  OnboardingEventInput,
} from '../models/AttorneyOnboardingModel';

// ---------------------------------------------------------------------------
// Canonicalize Onboarding Event Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for onboarding event ID derivation.
 *
 * Includes (in fixed order):
 *   applicationId, eventType, actorUserId, eventTimestamp
 *
 * Excludes:
 *   onboardingEventId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 *
 * Explicit string concatenation. Fixed key order.
 */
function canonicalizeOnboardingEventPreId(input: OnboardingEventInput): string {
  return (
    '{' +
    `"applicationId":${JSON.stringify(input.applicationId)},` +
    `"eventType":${JSON.stringify(input.eventType)},` +
    `"actorUserId":${JSON.stringify(input.actorUserId)},` +
    `"eventTimestamp":${JSON.stringify(input.eventTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Onboarding Event Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for dual-hash computation.
 *
 * Includes (in fixed order):
 *   onboardingEventId, applicationId, eventType, actorUserId, eventTimestamp
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 *
 * No circular hash binding.
 */
function canonicalizeOnboardingEventFull(
  onboardingEventId: string,
  input: OnboardingEventInput
): string {
  return (
    '{' +
    `"onboardingEventId":${JSON.stringify(onboardingEventId)},` +
    `"applicationId":${JSON.stringify(input.applicationId)},` +
    `"eventType":${JSON.stringify(input.eventType)},` +
    `"actorUserId":${JSON.stringify(input.actorUserId)},` +
    `"eventTimestamp":${JSON.stringify(input.eventTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Onboarding Event Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete onboarding event entity from input.
 *
 * Pipeline:
 *   1. Canonicalize pre-ID form (excludes onboardingEventId and hashes)
 *   2. Derive onboardingEventId = SHA-256(preIdCanonical)
 *   3. Canonicalize full form (includes onboardingEventId, excludes hashes)
 *   4. Compute dual-hash: SHA-256 and SHA3-256 of full canonical
 *   5. Return complete OnboardingEventEntity
 *
 * No circular hash binding.
 * No mutation of inputs.
 * Async because hash computation uses crypto.subtle.digest.
 * Deterministic — same input always produces same output.
 */
export async function buildOnboardingEvent(
  input: OnboardingEventInput
): Promise<OnboardingEventEntity> {
  // Step 1: Canonicalize pre-ID form
  const preIdCanonical = canonicalizeOnboardingEventPreId(input);

  // Step 2: Derive onboardingEventId
  const onboardingEventId = await computeTextSHA256(preIdCanonical);

  // Step 3: Canonicalize full form
  const fullCanonical = canonicalizeOnboardingEventFull(onboardingEventId, input);

  // Step 4: Compute dual-hash
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  // Step 5: Return complete entity
  return {
    onboardingEventId,
    applicationId: input.applicationId,
    eventType: input.eventType,
    actorUserId: input.actorUserId,
    eventTimestamp: input.eventTimestamp,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Onboarding Event Entity — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify an onboarding event entity by recomputing all hashes.
 *
 * Checks:
 *   1. onboardingEventId matches recomputed pre-ID hash
 *   2. sha256 matches recomputed full canonical hash
 *   3. sha3_256 matches recomputed full canonical hash
 *
 * Binary PASS/FAIL only.
 * Deterministic — same input always produces same result.
 */
export async function verifyOnboardingEvent(
  entity: OnboardingEventEntity
): Promise<{
  onboardingEventIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: OnboardingEventInput = {
    applicationId: entity.applicationId,
    eventType: entity.eventType,
    actorUserId: entity.actorUserId,
    eventTimestamp: entity.eventTimestamp,
  };

  // Recompute onboardingEventId
  const preIdCanonical = canonicalizeOnboardingEventPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const onboardingEventIdMatch = recomputedId === entity.onboardingEventId ? 'PASS' : 'FAIL';

  // Recompute dual-hash
  const fullCanonical = canonicalizeOnboardingEventFull(entity.onboardingEventId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    onboardingEventIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return {
    onboardingEventIdMatch,
    sha256Match,
    sha3_256Match,
    overallResult,
  };
}
