// ============================================
// Court Access — Acquisition Event Ledger (Phase O6)
// Immutable Discovery Event Entity Builder
//
// Creates immutable, dual-hashed acquisition event entities
// for the agency discovery pipeline's audit trail.
//
// Two-pass derivation:
//   Pass 1: pre-ID canonical (excludes acquisitionEventId, sha256, sha3_256) → acquisitionEventId
//   Pass 2: full canonical (includes acquisitionEventId, excludes sha256, sha3_256) → dual-hash
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
  AcquisitionEventEntity,
  AcquisitionEventInput,
} from '../models/AgencyDiscoveryModel';

// ---------------------------------------------------------------------------
// Canonicalize Acquisition Event Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for acquisition event ID derivation.
 *
 * Includes (in fixed order):
 *   candidateId, sourceUrl, discoveryTimestamp
 *
 * Excludes:
 *   acquisitionEventId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 *
 * Explicit string concatenation. Fixed key order.
 */
function canonicalizeAcquisitionEventPreId(input: AcquisitionEventInput): string {
  return (
    '{' +
    `"candidateId":${JSON.stringify(input.candidateId)},` +
    `"sourceUrl":${JSON.stringify(input.sourceUrl)},` +
    `"discoveryTimestamp":${JSON.stringify(input.discoveryTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Acquisition Event Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for dual-hash computation.
 *
 * Includes (in fixed order):
 *   acquisitionEventId, candidateId, sourceUrl, discoveryTimestamp
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 *
 * No circular hash binding.
 */
function canonicalizeAcquisitionEventFull(
  acquisitionEventId: string,
  input: AcquisitionEventInput
): string {
  return (
    '{' +
    `"acquisitionEventId":${JSON.stringify(acquisitionEventId)},` +
    `"candidateId":${JSON.stringify(input.candidateId)},` +
    `"sourceUrl":${JSON.stringify(input.sourceUrl)},` +
    `"discoveryTimestamp":${JSON.stringify(input.discoveryTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Acquisition Event Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete acquisition event entity from input.
 *
 * Pipeline:
 *   1. Canonicalize pre-ID form (excludes acquisitionEventId and hashes)
 *   2. Derive acquisitionEventId = SHA-256(preIdCanonical)
 *   3. Canonicalize full form (includes acquisitionEventId, excludes hashes)
 *   4. Compute dual-hash: SHA-256 and SHA3-256 of full canonical
 *   5. Return complete AcquisitionEventEntity
 *
 * No circular hash binding.
 * No mutation of inputs.
 * Async because hash computation uses crypto.subtle.digest.
 * Deterministic — same input always produces same output.
 */
export async function buildAcquisitionEvent(
  input: AcquisitionEventInput
): Promise<AcquisitionEventEntity> {
  // Step 1: Canonicalize pre-ID form
  const preIdCanonical = canonicalizeAcquisitionEventPreId(input);

  // Step 2: Derive acquisitionEventId
  const acquisitionEventId = await computeTextSHA256(preIdCanonical);

  // Step 3: Canonicalize full form
  const fullCanonical = canonicalizeAcquisitionEventFull(acquisitionEventId, input);

  // Step 4: Compute dual-hash
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  // Step 5: Return complete entity
  return {
    acquisitionEventId,
    candidateId: input.candidateId,
    sourceUrl: input.sourceUrl,
    discoveryTimestamp: input.discoveryTimestamp,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Acquisition Event Entity — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify an acquisition event entity by recomputing all hashes.
 *
 * Checks:
 *   1. acquisitionEventId matches recomputed pre-ID hash
 *   2. sha256 matches recomputed full canonical hash
 *   3. sha3_256 matches recomputed full canonical hash
 *
 * Binary PASS/FAIL only.
 * Deterministic — same input always produces same result.
 */
export async function verifyAcquisitionEvent(
  entity: AcquisitionEventEntity
): Promise<{
  acquisitionEventIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: AcquisitionEventInput = {
    candidateId: entity.candidateId,
    sourceUrl: entity.sourceUrl,
    discoveryTimestamp: entity.discoveryTimestamp,
  };

  // Recompute acquisitionEventId
  const preIdCanonical = canonicalizeAcquisitionEventPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const acquisitionEventIdMatch = recomputedId === entity.acquisitionEventId ? 'PASS' : 'FAIL';

  // Recompute dual-hash
  const fullCanonical = canonicalizeAcquisitionEventFull(entity.acquisitionEventId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    acquisitionEventIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return {
    acquisitionEventIdMatch,
    sha256Match,
    sha3_256Match,
    overallResult,
  };
}
