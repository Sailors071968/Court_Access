// ============================================
// Court Access — Risk Guard Engine (Phase O5)
// Domain Protection Governor — Pure Evaluation
//
// Evaluates operational risk signals and produces a binary
// ALLOW/FREEZE decision. This is the kill switch evaluator.
//
// This engine:
//   - Checks complaint rate against threshold
//   - Checks hard bounce rate against threshold
//   - Checks referential integrity status
//   - Checks tenant isolation status
//   - If ANY trigger fires → FREEZE
//   - Generates deterministic freeze reason string
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - Binary ALLOW/FREEZE only
//
// Architectural boundary:
//   - Does NOT import any engine
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access
//   - No SES calls
//   - No escalation building
//   - No dispatch calls
//   - No anchor modifications
//   - No logging (caller logs)
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
//   - No auto-unfreeze
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type {
  RiskEvaluationInput,
  RiskEvaluationResult,
} from '../models/RiskGuardModel';

// ---------------------------------------------------------------------------
// ASCII Comparator for Deterministic Sorting
// ---------------------------------------------------------------------------

function asciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Evaluate Risk — Binary ALLOW/FREEZE
// ---------------------------------------------------------------------------

/**
 * Evaluate operational risk for a single tenant.
 *
 * Logic:
 *   complaintExceeded =
 *     reputationMetrics.complaintRatePercent > thresholds.complaintRatePercentThreshold
 *
 *   hardBounceExceeded =
 *     reputationMetrics.hardBounceRatePercent > thresholds.hardBounceRatePercentThreshold
 *
 *   integrityFailed =
 *     thresholds.requireIntegrityPass &&
 *     integrityMetrics.referentialIntegrityStatus === 'FAIL'
 *
 *   tenantIsolationFailed =
 *     thresholds.requireTenantIsolationPass &&
 *     integrityMetrics.tenantIsolationStatus === 'FAIL'
 *
 *   If ANY true → status = FREEZE
 *   Else → status = ALLOW
 *
 * No partial freeze. Binary decision only.
 * No logging here — caller logs freeze events.
 *
 * Deterministic — same inputs always produce same output.
 */
export function evaluateRisk(
  input: RiskEvaluationInput
): RiskEvaluationResult {
  const complaintExceeded =
    input.reputationMetrics.complaintRatePercent >
    input.thresholds.complaintRatePercentThreshold;

  const hardBounceExceeded =
    input.reputationMetrics.hardBounceRatePercent >
    input.thresholds.hardBounceRatePercentThreshold;

  const integrityFailed =
    input.thresholds.requireIntegrityPass &&
    input.integrityMetrics.referentialIntegrityStatus === 'FAIL';

  const tenantIsolationFailed =
    input.thresholds.requireTenantIsolationPass &&
    input.integrityMetrics.tenantIsolationStatus === 'FAIL';

  const anyTriggered =
    complaintExceeded ||
    hardBounceExceeded ||
    integrityFailed ||
    tenantIsolationFailed;

  return {
    tenantId: input.tenantId,
    snapshotDate: input.snapshotDate,
    complaintExceeded,
    hardBounceExceeded,
    integrityFailed,
    tenantIsolationFailed,
    status: anyTriggered ? 'FREEZE' : 'ALLOW',
  };
}

// ---------------------------------------------------------------------------
// Build Deterministic Freeze Reason
// ---------------------------------------------------------------------------

/**
 * Build a deterministic freeze reason string from evaluation result.
 *
 * Rules:
 *   - Collect all triggered reason codes
 *   - Sort ASCII ascending
 *   - Join with "|"
 *   - If multiple triggers → "COMBINED_RISK_THRESHOLD_EXCEEDED" NOT used;
 *     instead, each individual reason is listed
 *
 * Reason codes:
 *   "COMPLAINT_RATE_EXCEEDED"
 *   "HARD_BOUNCE_RATE_EXCEEDED"
 *   "REFERENTIAL_INTEGRITY_FAILED"
 *   "TENANT_ISOLATION_FAILED"
 *
 * If no triggers → empty string (should not be called for ALLOW).
 *
 * Deterministic — same inputs always produce same output.
 */
export function buildFreezeReason(
  result: RiskEvaluationResult
): string {
  const reasons: string[] = [];

  if (result.complaintExceeded) {
    reasons.push('COMPLAINT_RATE_EXCEEDED');
  }
  if (result.hardBounceExceeded) {
    reasons.push('HARD_BOUNCE_RATE_EXCEEDED');
  }
  if (result.integrityFailed) {
    reasons.push('REFERENTIAL_INTEGRITY_FAILED');
  }
  if (result.tenantIsolationFailed) {
    reasons.push('TENANT_ISOLATION_FAILED');
  }

  // Sort ASCII ascending for deterministic ordering
  reasons.sort(asciiCompare);

  return reasons.join('|');
}

// ---------------------------------------------------------------------------
// Enforce Freeze Gate — Binary PASS/FAIL for O1 and O3
// ---------------------------------------------------------------------------

/**
 * Binary enforcement gate that O1 scheduler and O3 escalation
 * must check before operating.
 *
 * PASS: operations allowed (not frozen, or manually overridden).
 * FAIL: operations blocked (frozen and not overridden).
 *
 * No bypass. No warning mode.
 * Deterministic — same input always produces same result.
 */
export function enforceFreezeGate(
  isFrozen: boolean
): 'PASS' | 'FAIL' {
  return isFrozen ? 'FAIL' : 'PASS';
}
