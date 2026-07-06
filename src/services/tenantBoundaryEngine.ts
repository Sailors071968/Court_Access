// ============================================
// Court Access — Tenant Boundary Engine (Phase 21)
// Tenant Boundary Hardening Layer
//
// Ensures no cross-case leakage even under edge cases.
// GlobalTenantGuard wraps all cross-module operations.
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
  TenantGuardedEntity,
  CrossModuleTenantAuditResult,
  TenantMismatchEntry,
} from '../models/TenantBoundaryModel';

// ---------------------------------------------------------------------------
// Global Tenant Guard — wraps all cross-module operations
// ---------------------------------------------------------------------------

/**
 * Verify a single entity belongs to the expected tenant.
 *
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function globalTenantGuard(
  expectedTenantId: string,
  entity: TenantGuardedEntity
): 'PASS' | 'FAIL' {
  if (entity.tenantId === expectedTenantId) {
    return 'PASS';
  }
  return 'FAIL';
}

// ---------------------------------------------------------------------------
// Batch Tenant Guard — verify multiple entities
// ---------------------------------------------------------------------------

/**
 * Verify all entities belong to the expected tenant.
 *
 * Returns FAIL on first mismatch.
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function batchTenantGuard(
  expectedTenantId: string,
  entities: readonly TenantGuardedEntity[]
): 'PASS' | 'FAIL' {
  for (let i = 0; i < entities.length; i++) {
    if (entities[i].tenantId !== expectedTenantId) {
      return 'FAIL';
    }
  }
  return 'PASS';
}

// ---------------------------------------------------------------------------
// Cross-Module Tenant Audit — scan entire entity tree
// ---------------------------------------------------------------------------

/**
 * Scan entire entity tree for tenant consistency before export.
 *
 * Checks every entity in the tree against expectedTenantId.
 * Records all mismatches.
 * Binary PASS/FAIL overall.
 *
 * Deterministic — same inputs always produce same result.
 */
export function crossModuleTenantAudit(
  expectedTenantId: string,
  entities: readonly TenantGuardedEntity[]
): CrossModuleTenantAuditResult {
  const mismatches: TenantMismatchEntry[] = [];
  let matchedEntities = 0;

  for (let i = 0; i < entities.length; i++) {
    if (entities[i].tenantId === expectedTenantId) {
      matchedEntities++;
    } else {
      mismatches.push({
        entityIndex: i,
        foundTenantId: entities[i].tenantId,
      });
    }
  }

  return {
    expectedTenantId,
    totalEntities: entities.length,
    matchedEntities,
    mismatchedEntities: mismatches.length,
    overallStatus: mismatches.length === 0 ? 'PASS' : 'FAIL',
    mismatches,
  };
}

// ---------------------------------------------------------------------------
// Enforce Tenant Isolation for Annotation Access
// ---------------------------------------------------------------------------

/**
 * Verify annotation belongs to current tenant before access.
 *
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function enforceAnnotationTenantBoundary(
  expectedTenantId: string,
  annotationTenantId: string
): 'PASS' | 'FAIL' {
  return annotationTenantId === expectedTenantId ? 'PASS' : 'FAIL';
}

// ---------------------------------------------------------------------------
// Enforce Tenant Isolation for Portfolio Aggregation
// ---------------------------------------------------------------------------

/**
 * Verify all case metrics belong to the same tenant before aggregation.
 *
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function enforcePortfolioTenantBoundary(
  expectedTenantId: string,
  caseTenantIds: readonly string[]
): 'PASS' | 'FAIL' {
  for (let i = 0; i < caseTenantIds.length; i++) {
    if (caseTenantIds[i] !== expectedTenantId) {
      return 'FAIL';
    }
  }
  return 'PASS';
}

// ---------------------------------------------------------------------------
// Enforce Tenant Isolation for Version Chain Verification
// ---------------------------------------------------------------------------

/**
 * Verify all versions belong to the same tenant before chain verification.
 *
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function enforceVersionChainTenantBoundary(
  expectedTenantId: string,
  versionTenantIds: readonly string[]
): 'PASS' | 'FAIL' {
  for (let i = 0; i < versionTenantIds.length; i++) {
    if (versionTenantIds[i] !== expectedTenantId) {
      return 'FAIL';
    }
  }
  return 'PASS';
}

// ---------------------------------------------------------------------------
// Enforce Tenant Isolation for Cross-Case Comparison
// ---------------------------------------------------------------------------

/**
 * Verify all cases in cross-case comparison belong to same tenant.
 *
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function enforceCrossCaseTenantBoundary(
  expectedTenantId: string,
  caseTenantIds: readonly string[]
): 'PASS' | 'FAIL' {
  for (let i = 0; i < caseTenantIds.length; i++) {
    if (caseTenantIds[i] !== expectedTenantId) {
      return 'FAIL';
    }
  }
  return 'PASS';
}
