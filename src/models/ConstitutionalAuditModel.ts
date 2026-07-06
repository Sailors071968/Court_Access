// ============================================
// Court Access — Constitutional Audit Model (Phase 25)
// Constitutional Audit & Self-Verification Engine
//
// System must verify itself daily.
// Runs all verifications and generates a report.
// Automatic freeze trigger if overall FAIL.
//
// Architectural boundary:
//   - Does NOT import any engine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction
//   - Deterministic processing
// ============================================

// ---------------------------------------------------------------------------
// Constitutional Audit Report — daily self-verification
// ---------------------------------------------------------------------------

/**
 * Daily constitutional audit report.
 *
 * Aggregates all verification results.
 * Binary PASS/FAIL per category + overall.
 *
 * If overallStatus === FAIL -> trigger Phase O5 freeze.
 */
export interface ConstitutionalAuditReport {
  snapshotDate: string;            // ISO 8601 date, caller-provided
  tenantId: string;
  tenantIsolationStatus: 'PASS' | 'FAIL';
  versionIntegrityStatus: 'PASS' | 'FAIL';
  outputComplianceStatus: 'PASS' | 'FAIL';
  modelDriftStatus: 'PASS' | 'FAIL';
  documentIntegrityStatus: 'PASS' | 'FAIL';
  portfolioIsolationStatus: 'PASS' | 'FAIL';
  overallStatus: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Constitutional Audit Input — pre-computed verification results
// ---------------------------------------------------------------------------

/**
 * Input for building a constitutional audit report.
 *
 * All verification results must be pre-computed by their
 * respective engines. This model only aggregates.
 */
export interface ConstitutionalAuditInput {
  snapshotDate: string;
  tenantId: string;
  tenantIsolationStatus: 'PASS' | 'FAIL';
  versionIntegrityStatus: 'PASS' | 'FAIL';
  outputComplianceStatus: 'PASS' | 'FAIL';
  modelDriftStatus: 'PASS' | 'FAIL';
  documentIntegrityStatus: 'PASS' | 'FAIL';
  portfolioIsolationStatus: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Freeze Trigger Result
// ---------------------------------------------------------------------------

/**
 * Result of evaluating whether a constitutional freeze is required.
 *
 * If any verification category is FAIL -> freezeRequired = true.
 * Binary determination. No partial freeze.
 */
export interface FreezeTriggerResult {
  freezeRequired: boolean;
  failedCategories: string[];
}
