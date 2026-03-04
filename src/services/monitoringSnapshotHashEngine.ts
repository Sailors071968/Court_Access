// ============================================
// Court Access — Monitoring Snapshot Hash Engine (Phase O4)
// Immutable Dual-Hashed Snapshot Entity Builder
//
// Creates immutable, dual-hashed monitoring snapshot entities
// for anchoring monitoring history.
//
// Two-pass derivation:
//   Pass 1: pre-ID canonical (excludes snapshotId, sha256, sha3_256) → snapshotId
//   Pass 2: full canonical (includes snapshotId, excludes sha256, sha3_256) → dual-hash
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
//   - No anchor modifications
//   - No escalation triggering
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
//   - Binary PASS/FAIL only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  MonitoringSnapshotEntity,
  MonitoringSnapshotInput,
  DailyOperationalSnapshot,
} from '../models/OperationalMonitoringModel';

// ---------------------------------------------------------------------------
// Canonicalize Snapshot Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for snapshot ID derivation.
 *
 * Includes (in fixed order):
 *   tenantId, snapshotDate, snapshotHash
 *
 * Excludes:
 *   snapshotId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 *
 * Explicit string concatenation. Fixed key order.
 * No JSON.stringify key order dependency.
 */
function canonicalizeSnapshotPreId(input: MonitoringSnapshotInput): string {
  return (
    '{' +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"snapshotDate":${JSON.stringify(input.snapshotDate)},` +
    `"snapshotHash":${JSON.stringify(input.snapshotHash)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Snapshot Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for dual-hash computation.
 *
 * Includes (in fixed order):
 *   snapshotId, tenantId, snapshotDate, snapshotHash
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 *
 * No circular hash binding.
 */
function canonicalizeSnapshotFull(
  snapshotId: string,
  input: MonitoringSnapshotInput
): string {
  return (
    '{' +
    `"snapshotId":${JSON.stringify(snapshotId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"snapshotDate":${JSON.stringify(input.snapshotDate)},` +
    `"snapshotHash":${JSON.stringify(input.snapshotHash)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Daily Operational Snapshot for Hashing
// ---------------------------------------------------------------------------

/**
 * Canonical JSON of a DailyOperationalSnapshot for content hashing.
 *
 * Fixed key order. Deterministic.
 * This produces the snapshotHash used in MonitoringSnapshotInput.
 *
 * All nested objects are serialized in fixed field order.
 * No JSON.stringify key order dependency.
 */
function canonicalizeDailySnapshot(snapshot: DailyOperationalSnapshot): string {
  // Warmup block
  const w = snapshot.warmup;
  const warmupJson =
    '{' +
    `"currentTierWeek":${w.currentTierWeek},` +
    `"maxPerDay":${w.maxPerDay},` +
    `"maxPerHour":${w.maxPerHour},` +
    `"todaysDispatchCount":${w.todaysDispatchCount},` +
    `"currentHourDispatchCount":${w.currentHourDispatchCount},` +
    `"dailyUtilizationPercent":${w.dailyUtilizationPercent},` +
    `"hourlyUtilizationPercent":${w.hourlyUtilizationPercent},` +
    `"gateStatus":${JSON.stringify(w.gateStatus)}` +
    '}';

  // Reputation block
  const r = snapshot.reputation;
  const reputationJson =
    '{' +
    `"totalActiveRecipients":${r.totalActiveRecipients},` +
    `"softBounceCount":${r.softBounceCount},` +
    `"hardBounceCount":${r.hardBounceCount},` +
    `"complaintCount":${r.complaintCount},` +
    `"softBounceEscalations":${r.softBounceEscalations},` +
    `"hardBounceRatePercent":${r.hardBounceRatePercent},` +
    `"complaintRatePercent":${r.complaintRatePercent}` +
    '}';

  // Escalation block
  const e = snapshot.escalation;
  const escalationJson =
    '{' +
    `"totalAgencies":${e.totalAgencies},` +
    `"agenciesDue":${e.agenciesDue},` +
    `"agenciesBlocked":${e.agenciesBlocked},` +
    `"agenciesResponded":${e.agenciesResponded},` +
    `"agenciesNotDue":${e.agenciesNotDue},` +
    `"followUp1Created":${e.followUp1Created},` +
    `"followUp2Created":${e.followUp2Created},` +
    `"annualUpdatesCreated":${e.annualUpdatesCreated}` +
    '}';

  // Queue block
  const q = snapshot.queue;
  const queueJson =
    '{' +
    `"totalQueued":${q.totalQueued},` +
    `"totalDispatchedToday":${q.totalDispatchedToday},` +
    `"totalFailedToday":${q.totalFailedToday},` +
    `"totalThrottledToday":${q.totalThrottledToday},` +
    `"backlogSize":${q.backlogSize}` +
    '}';

  // Integrity block
  const i = snapshot.integrity;
  const integrityJson =
    '{' +
    `"communicationChainStatus":${JSON.stringify(i.communicationChainStatus)},` +
    `"referentialIntegrityStatus":${JSON.stringify(i.referentialIntegrityStatus)},` +
    `"tenantIsolationStatus":${JSON.stringify(i.tenantIsolationStatus)},` +
    `"evidencePacketVerificationStatus":${JSON.stringify(i.evidencePacketVerificationStatus)},` +
    `"anchorBindingStatus":${JSON.stringify(i.anchorBindingStatus)}` +
    '}';

  // Full snapshot
  return (
    '{' +
    `"tenantId":${JSON.stringify(snapshot.tenantId)},` +
    `"snapshotDate":${JSON.stringify(snapshot.snapshotDate)},` +
    `"generatedTimestamp":${JSON.stringify(snapshot.generatedTimestamp)},` +
    `"warmup":${warmupJson},` +
    `"reputation":${reputationJson},` +
    `"escalation":${escalationJson},` +
    `"queue":${queueJson},` +
    `"integrity":${integrityJson}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Compute Snapshot Hash
// ---------------------------------------------------------------------------

/**
 * Compute the content hash (SHA-256) of a DailyOperationalSnapshot.
 *
 * This hash is used as the snapshotHash in MonitoringSnapshotInput.
 * Deterministic canonical serialization.
 *
 * Async because hash computation uses crypto.subtle.digest.
 * Deterministic — same snapshot always produces same hash.
 */
export async function computeSnapshotHash(
  snapshot: DailyOperationalSnapshot
): Promise<string> {
  const canonical = canonicalizeDailySnapshot(snapshot);
  return computeTextSHA256(canonical);
}

// ---------------------------------------------------------------------------
// Build Monitoring Snapshot Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete monitoring snapshot entity from input.
 *
 * Pipeline:
 *   1. Canonicalize pre-ID form (excludes snapshotId and hashes)
 *   2. Derive snapshotId = SHA-256(preIdCanonical)
 *   3. Canonicalize full form (includes snapshotId, excludes hashes)
 *   4. Compute dual-hash: SHA-256 and SHA3-256 of full canonical
 *   5. Return complete MonitoringSnapshotEntity
 *
 * No circular hash binding.
 * No mutation of inputs.
 * Async because hash computation uses crypto.subtle.digest.
 * Deterministic — same input always produces same output.
 */
export async function buildMonitoringSnapshotEntity(
  input: MonitoringSnapshotInput
): Promise<MonitoringSnapshotEntity> {
  // Step 1: Canonicalize pre-ID form
  const preIdCanonical = canonicalizeSnapshotPreId(input);

  // Step 2: Derive snapshotId
  const snapshotId = await computeTextSHA256(preIdCanonical);

  // Step 3: Canonicalize full form
  const fullCanonical = canonicalizeSnapshotFull(snapshotId, input);

  // Step 4: Compute dual-hash
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  // Step 5: Return complete entity
  return {
    snapshotId,
    tenantId: input.tenantId,
    snapshotDate: input.snapshotDate,
    snapshotHash: input.snapshotHash,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Monitoring Snapshot Entity — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify a monitoring snapshot entity by recomputing all hashes.
 *
 * Checks:
 *   1. snapshotId matches recomputed pre-ID hash
 *   2. sha256 matches recomputed full canonical hash
 *   3. sha3_256 matches recomputed full canonical hash
 *
 * Binary PASS/FAIL only.
 * Deterministic — same input always produces same result.
 */
export async function verifyMonitoringSnapshotEntity(
  entity: MonitoringSnapshotEntity
): Promise<{
  snapshotIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: MonitoringSnapshotInput = {
    tenantId: entity.tenantId,
    snapshotDate: entity.snapshotDate,
    snapshotHash: entity.snapshotHash,
  };

  // Recompute snapshotId
  const preIdCanonical = canonicalizeSnapshotPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const snapshotIdMatch = recomputedId === entity.snapshotId ? 'PASS' : 'FAIL';

  // Recompute dual-hash
  const fullCanonical = canonicalizeSnapshotFull(entity.snapshotId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    snapshotIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return {
    snapshotIdMatch,
    sha256Match,
    sha3_256Match,
    overallResult,
  };
}
