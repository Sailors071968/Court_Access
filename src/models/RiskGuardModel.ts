// ============================================
// Court Access — Risk Guard Model (Phase O5)
// Automated Risk Guardrail & Freeze Layer
//
// Defines risk threshold configuration, evaluation input/result,
// freeze state, and freeze event entity types for the
// domain protection governor.
//
// This is a kill switch layer:
//   - Detects unsafe operational conditions
//   - Freezes escalation automation and SES dispatch
//   - Requires explicit manual override to resume
//   - Logs freeze events immutably
//   - Never auto-unfreezes
//
// Architectural boundary:
//   - Does NOT import any engine
//   - Type-only imports from sibling models
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of historical entries
//   - No deletion
//   - No update of prior ledger entries
//   - Append-only discipline
//   - Binary ALLOW/FREEZE only
//   - Deterministic processing
//   - No auto-unfreeze logic
// ============================================

// ---------------------------------------------------------------------------
// Imports — type-only from sibling models
// ---------------------------------------------------------------------------

import type { ReputationMetrics, IntegrityMetrics } from './OperationalMonitoringModel';

// ---------------------------------------------------------------------------
// Risk Status — binary decision
// ---------------------------------------------------------------------------

/**
 * Risk status — binary domain protection decision.
 *
 * ALLOW  — Operations may proceed
 * FREEZE — All outbound operations must stop immediately
 */
export type RiskStatus = 'ALLOW' | 'FREEZE';

// ---------------------------------------------------------------------------
// Risk Threshold Configuration
// ---------------------------------------------------------------------------

/**
 * Configurable risk thresholds for freeze evaluation.
 *
 * All thresholds must be positive integers.
 * No floats. No decimals.
 */
export interface RiskThresholdConfig {
  complaintRatePercentThreshold: number;     // e.g. 1 (%), positive integer
  hardBounceRatePercentThreshold: number;    // e.g. 5 (%), positive integer
  requireIntegrityPass: boolean;             // true = integrity FAIL triggers freeze
  requireTenantIsolationPass: boolean;       // true = isolation FAIL triggers freeze
}

// ---------------------------------------------------------------------------
// Risk Evaluation Input
// ---------------------------------------------------------------------------

/**
 * Input for evaluating operational risk for a single tenant.
 *
 * Caller provides all metrics — engine does not query stores.
 */
export interface RiskEvaluationInput {
  tenantId: string;
  snapshotDate: string;                      // YYYY-MM-DD, caller-provided
  reputationMetrics: ReputationMetrics;
  integrityMetrics: IntegrityMetrics;
  thresholds: RiskThresholdConfig;
}

// ---------------------------------------------------------------------------
// Risk Evaluation Result
// ---------------------------------------------------------------------------

/**
 * Result of evaluating operational risk.
 *
 * Binary ALLOW/FREEZE only.
 * If ANY trigger is true → FREEZE.
 * No partial freeze. No warning mode.
 *
 * Deterministic — same inputs always produce same output.
 */
export interface RiskEvaluationResult {
  tenantId: string;
  snapshotDate: string;
  complaintExceeded: boolean;
  hardBounceExceeded: boolean;
  integrityFailed: boolean;
  tenantIsolationFailed: boolean;
  status: RiskStatus;
}

// ---------------------------------------------------------------------------
// Freeze State
// ---------------------------------------------------------------------------

/**
 * Current freeze state for a single tenant.
 *
 * isFrozen = true → all outbound operations blocked
 * manuallyOverridden = true → freeze was explicitly lifted by operator
 *
 * Auto-unfreeze is prohibited.
 * Only manualOverrideFreeze() can set isFrozen = false.
 */
export interface FreezeState {
  tenantId: string;
  isFrozen: boolean;
  freezeReason: string;                      // Deterministic reason string
  frozenAtTimestamp: string;                 // ISO 8601, caller-provided
  manuallyOverridden: boolean;
  overrideTimestamp: string | null;
}

// ---------------------------------------------------------------------------
// Freeze Event Entity — immutable ledger record
// ---------------------------------------------------------------------------

/**
 * Immutable record of a freeze trigger event.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical (excludes freezeEventId, sha256, sha3_256) → freezeEventId
 *   Pass 2: full canonical (includes freezeEventId, excludes sha256, sha3_256) → dual-hash
 *
 * Only FREEZE events are logged (ALLOW does not create ledger entries).
 * Append-only — no update, no delete.
 */
export interface FreezeEventEntity {
  freezeEventId: string;                     // SHA-256 of canonical pre-ID form (64 hex chars)
  tenantId: string;
  snapshotDate: string;                      // YYYY-MM-DD
  status: RiskStatus;                        // FREEZE only logged
  complaintRatePercent: number;
  hardBounceRatePercent: number;
  integrityStatus: 'PASS' | 'FAIL';
  tenantIsolationStatus: 'PASS' | 'FAIL';
  description: string;                       // Deterministic reason string
  sha256: string;                            // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                          // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Freeze Event Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new freeze event entity.
 *
 * The caller provides all fields except:
 *   - freezeEventId (derived from canonical form)
 *   - sha256 / sha3_256 (computed from canonical form)
 */
export interface FreezeEventInput {
  tenantId: string;
  snapshotDate: string;
  status: RiskStatus;
  complaintRatePercent: number;
  hardBounceRatePercent: number;
  integrityStatus: 'PASS' | 'FAIL';
  tenantIsolationStatus: 'PASS' | 'FAIL';
  description: string;
}

// ---------------------------------------------------------------------------
// Default Risk Thresholds
// ---------------------------------------------------------------------------

/**
 * Default risk thresholds.
 * Conservative defaults for domain protection.
 * All values positive integers.
 */
export const DEFAULT_RISK_THRESHOLDS: RiskThresholdConfig = {
  complaintRatePercentThreshold: 1,          // 1% complaint rate triggers freeze
  hardBounceRatePercentThreshold: 5,         // 5% hard bounce rate triggers freeze
  requireIntegrityPass: true,                // Integrity FAIL triggers freeze
  requireTenantIsolationPass: true,          // Isolation FAIL triggers freeze
};
