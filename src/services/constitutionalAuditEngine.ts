// ============================================
// Court Access — Constitutional Audit Engine (Phase 25)
// Constitutional Audit & Self-Verification Engine
//
// System must verify itself daily.
// Runs all verifications and generates a report.
// Automatic freeze trigger if overall FAIL.
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - No side effects
//
// Architectural boundary:
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access
//   - No SES calls
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction
//   - Deterministic processing only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type {
  ConstitutionalAuditReport,
  ConstitutionalAuditInput,
  FreezeTriggerResult,
} from '../models/ConstitutionalAuditModel';

// ---------------------------------------------------------------------------
// Build Constitutional Audit Report
// ---------------------------------------------------------------------------

/**
 * Build a constitutional audit report from pre-computed verification results.
 *
 * Aggregates all verification statuses.
 * overallStatus = PASS only if ALL categories pass.
 *
 * Deterministic — same inputs always produce same output.
 */
export function buildConstitutionalAuditReport(
  input: ConstitutionalAuditInput
): ConstitutionalAuditReport {
  const overallStatus =
    input.tenantIsolationStatus === 'PASS' &&
    input.versionIntegrityStatus === 'PASS' &&
    input.outputComplianceStatus === 'PASS' &&
    input.modelDriftStatus === 'PASS' &&
    input.documentIntegrityStatus === 'PASS' &&
    input.portfolioIsolationStatus === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return {
    snapshotDate: input.snapshotDate,
    tenantId: input.tenantId,
    tenantIsolationStatus: input.tenantIsolationStatus,
    versionIntegrityStatus: input.versionIntegrityStatus,
    outputComplianceStatus: input.outputComplianceStatus,
    modelDriftStatus: input.modelDriftStatus,
    documentIntegrityStatus: input.documentIntegrityStatus,
    portfolioIsolationStatus: input.portfolioIsolationStatus,
    overallStatus,
  };
}

// ---------------------------------------------------------------------------
// Evaluate Freeze Trigger
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a constitutional freeze is required.
 *
 * If any verification category is FAIL -> freezeRequired = true.
 * Lists all failed categories.
 *
 * Binary determination. No partial freeze.
 * Deterministic — same inputs always produce same output.
 */
export function evaluateFreezeTrigger(
  report: ConstitutionalAuditReport
): FreezeTriggerResult {
  const failedCategories: string[] = [];

  if (report.tenantIsolationStatus === 'FAIL') {
    failedCategories.push('TENANT_ISOLATION');
  }
  if (report.versionIntegrityStatus === 'FAIL') {
    failedCategories.push('VERSION_INTEGRITY');
  }
  if (report.outputComplianceStatus === 'FAIL') {
    failedCategories.push('OUTPUT_COMPLIANCE');
  }
  if (report.modelDriftStatus === 'FAIL') {
    failedCategories.push('MODEL_DRIFT');
  }
  if (report.documentIntegrityStatus === 'FAIL') {
    failedCategories.push('DOCUMENT_INTEGRITY');
  }
  if (report.portfolioIsolationStatus === 'FAIL') {
    failedCategories.push('PORTFOLIO_ISOLATION');
  }

  return {
    freezeRequired: failedCategories.length > 0,
    failedCategories,
  };
}

// ---------------------------------------------------------------------------
// Validate Audit Report Completeness
// ---------------------------------------------------------------------------

/**
 * Validate that all required verification categories are present.
 *
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function validateAuditReportCompleteness(
  report: ConstitutionalAuditReport
): 'PASS' | 'FAIL' {
  // All fields must be non-empty
  if (report.snapshotDate.length === 0) {
    return 'FAIL';
  }
  if (report.tenantId.length === 0) {
    return 'FAIL';
  }
  // All status fields must be either PASS or FAIL (type system enforces this)
  // Verify overallStatus is consistent
  const expectedOverall =
    report.tenantIsolationStatus === 'PASS' &&
    report.versionIntegrityStatus === 'PASS' &&
    report.outputComplianceStatus === 'PASS' &&
    report.modelDriftStatus === 'PASS' &&
    report.documentIntegrityStatus === 'PASS' &&
    report.portfolioIsolationStatus === 'PASS'
      ? 'PASS'
      : 'FAIL';

  if (report.overallStatus !== expectedOverall) {
    return 'FAIL';
  }

  return 'PASS';
}
