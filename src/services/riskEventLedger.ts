// ============================================
// Court Access — Risk Event Ledger (Phase O5)
// Immutable Freeze Event Entity Builder
//
// Creates immutable, dual-hashed freeze event entities
// for the domain protection governor's audit trail.
//
// Two-pass derivation:
//   Pass 1: pre-ID canonical (excludes freezeEventId, sha256, sha3_256) → freezeEventId
//   Pass 2: full canonical (includes freezeEventId, excludes sha256, sha3_256) → dual-hash
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
//   - Binary ALLOW/FREEZE only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  FreezeEventEntity,
  FreezeEventInput,
} from '../models/RiskGuardModel';

// ---------------------------------------------------------------------------
// Canonicalize Freeze Event Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for freeze event ID derivation.
 *
 * Includes (in fixed order):
 *   tenantId, snapshotDate, status, complaintRatePercent,
 *   hardBounceRatePercent, integrityStatus, tenantIsolationStatus,
 *   description
 *
 * Excludes:
 *   freezeEventId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 *
 * Explicit string concatenation. Fixed key order.
 * No JSON.stringify key order dependency.
 */
function canonicalizeFreezeEventPreId(input: FreezeEventInput): string {
  return (
    '{' +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"snapshotDate":${JSON.stringify(input.snapshotDate)},` +
    `"status":${JSON.stringify(input.status)},` +
    `"complaintRatePercent":${input.complaintRatePercent},` +
    `"hardBounceRatePercent":${input.hardBounceRatePercent},` +
    `"integrityStatus":${JSON.stringify(input.integrityStatus)},` +
    `"tenantIsolationStatus":${JSON.stringify(input.tenantIsolationStatus)},` +
    `"description":${JSON.stringify(input.description)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Freeze Event Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for dual-hash computation.
 *
 * Includes (in fixed order):
 *   freezeEventId, tenantId, snapshotDate, status,
 *   complaintRatePercent, hardBounceRatePercent,
 *   integrityStatus, tenantIsolationStatus, description
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 *
 * No circular hash binding.
 */
function canonicalizeFreezeEventFull(
  freezeEventId: string,
  input: FreezeEventInput
): string {
  return (
    '{' +
    `"freezeEventId":${JSON.stringify(freezeEventId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"snapshotDate":${JSON.stringify(input.snapshotDate)},` +
    `"status":${JSON.stringify(input.status)},` +
    `"complaintRatePercent":${input.complaintRatePercent},` +
    `"hardBounceRatePercent":${input.hardBounceRatePercent},` +
    `"integrityStatus":${JSON.stringify(input.integrityStatus)},` +
    `"tenantIsolationStatus":${JSON.stringify(input.tenantIsolationStatus)},` +
    `"description":${JSON.stringify(input.description)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Freeze Event Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete freeze event entity from input.
 *
 * Pipeline:
 *   1. Canonicalize pre-ID form (excludes freezeEventId and hashes)
 *   2. Derive freezeEventId = SHA-256(preIdCanonical)
 *   3. Canonicalize full form (includes freezeEventId, excludes hashes)
 *   4. Compute dual-hash: SHA-256 and SHA3-256 of full canonical
 *   5. Return complete FreezeEventEntity
 *
 * No circular hash binding.
 * No mutation of inputs.
 * Async because hash computation uses crypto.subtle.digest.
 * Deterministic — same input always produces same output.
 */
export async function buildFreezeEvent(
  input: FreezeEventInput
): Promise<FreezeEventEntity> {
  // Step 1: Canonicalize pre-ID form
  const preIdCanonical = canonicalizeFreezeEventPreId(input);

  // Step 2: Derive freezeEventId
  const freezeEventId = await computeTextSHA256(preIdCanonical);

  // Step 3: Canonicalize full form
  const fullCanonical = canonicalizeFreezeEventFull(freezeEventId, input);

  // Step 4: Compute dual-hash
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  // Step 5: Return complete entity
  return {
    freezeEventId,
    tenantId: input.tenantId,
    snapshotDate: input.snapshotDate,
    status: input.status,
    complaintRatePercent: input.complaintRatePercent,
    hardBounceRatePercent: input.hardBounceRatePercent,
    integrityStatus: input.integrityStatus,
    tenantIsolationStatus: input.tenantIsolationStatus,
    description: input.description,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Freeze Event Entity — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify a freeze event entity by recomputing all hashes.
 *
 * Checks:
 *   1. freezeEventId matches recomputed pre-ID hash
 *   2. sha256 matches recomputed full canonical hash
 *   3. sha3_256 matches recomputed full canonical hash
 *
 * Binary PASS/FAIL only.
 * Deterministic — same input always produces same result.
 */
export async function verifyFreezeEvent(
  entity: FreezeEventEntity
): Promise<{
  freezeEventIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: FreezeEventInput = {
    tenantId: entity.tenantId,
    snapshotDate: entity.snapshotDate,
    status: entity.status,
    complaintRatePercent: entity.complaintRatePercent,
    hardBounceRatePercent: entity.hardBounceRatePercent,
    integrityStatus: entity.integrityStatus,
    tenantIsolationStatus: entity.tenantIsolationStatus,
    description: entity.description,
  };

  // Recompute freezeEventId
  const preIdCanonical = canonicalizeFreezeEventPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const freezeEventIdMatch = recomputedId === entity.freezeEventId ? 'PASS' : 'FAIL';

  // Recompute dual-hash
  const fullCanonical = canonicalizeFreezeEventFull(entity.freezeEventId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    freezeEventIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return {
    freezeEventIdMatch,
    sha256Match,
    sha3_256Match,
    overallResult,
  };
}
