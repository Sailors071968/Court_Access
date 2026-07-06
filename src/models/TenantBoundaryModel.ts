// ============================================
// Court Access — Tenant Boundary Model (Phase 21)
// Tenant Boundary Hardening Layer
//
// Ensures no cross-case leakage even under edge cases.
// Global tenant guard wraps all cross-module operations.
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
// Tenant Guarded Entity — any entity with tenantId
// ---------------------------------------------------------------------------

export interface TenantGuardedEntity {
  tenantId: string;
}

// ---------------------------------------------------------------------------
// Cross-Module Tenant Audit Result
// ---------------------------------------------------------------------------

/**
 * Result of scanning entire entity tree for tenant consistency.
 *
 * Binary PASS/FAIL per entity + overall.
 */
export interface CrossModuleTenantAuditResult {
  expectedTenantId: string;
  totalEntities: number;
  matchedEntities: number;
  mismatchedEntities: number;
  overallStatus: 'PASS' | 'FAIL';
  mismatches: TenantMismatchEntry[];
}

// ---------------------------------------------------------------------------
// Tenant Mismatch Entry
// ---------------------------------------------------------------------------

export interface TenantMismatchEntry {
  entityIndex: number;
  foundTenantId: string;
}
