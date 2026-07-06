// ============================================
// Court Access — Tenant Isolation Model (Phase 18)
// Tenant Isolation Verification Layer
//
// Defines validation types for system-wide tenant containment:
//   - Communication isolation
//   - Response isolation
//   - Archive isolation (manifest + document references)
//   - Audit trace isolation (entries + cross-phase refs)
//   - Artifact lookup isolation
//   - Mixed collection detection
//
// This layer ensures no entity from Tenant A appears
// anywhere in Tenant B structures. Even if a database
// is compromised, a store is merged, or a migration
// misfires, Phase 18 catches it.
//
// Architectural boundary:
//   - Does NOT import any engine
//   - Type-only imports from sibling models
//   - No circular dependencies
//   - No hash recomputation
//   - No crypto operations
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation
//   - No deletion
//   - No update
//   - Binary PASS/FAIL only
//   - ASCII comparator only
//   - Deterministic processing
// ============================================

// ---------------------------------------------------------------------------
// Tenant Isolation Violation Type
// ---------------------------------------------------------------------------

/**
 * Violation types — categorizes the nature of the tenant isolation failure.
 * Additive-only — new types may be added, none removed.
 *
 * FOREIGN_COMMUNICATION     — Communication entity has wrong tenantId
 * FOREIGN_RESPONSE          — Response entity has wrong tenantId
 * FOREIGN_ARCHIVE_DOCUMENT  — Archive manifest or referenced document has wrong tenantId
 * FOREIGN_TRACE_REFERENCE   — Audit trace entry or crossPhaseRef artifact has wrong tenantId
 * FOREIGN_ANCHOR_LEAF       — Anchor leaf belongs to wrong tenant (reserved for tenant-scoped anchors)
 * FOREIGN_LEDGER_EVENT      — Ledger event (credit, subscription) has wrong tenantId (reserved)
 */
export type TenantIsolationViolationType =
  | 'FOREIGN_COMMUNICATION'
  | 'FOREIGN_RESPONSE'
  | 'FOREIGN_ARCHIVE_DOCUMENT'
  | 'FOREIGN_TRACE_REFERENCE'
  | 'FOREIGN_ANCHOR_LEAF'
  | 'FOREIGN_LEDGER_EVENT';

// ---------------------------------------------------------------------------
// Single Tenant Isolation Violation
// ---------------------------------------------------------------------------

/**
 * A single tenant isolation violation.
 *
 * Each violation identifies:
 *   - violationType: which domain was contaminated
 *   - entityId: the ID of the entity that violates isolation
 *   - entityTenantId: the actual tenantId found on the entity
 *   - expectedTenantId: the tenantId that was expected
 *   - description: human-readable description (no interpretive language)
 */
export interface TenantIsolationViolation {
  violationType: TenantIsolationViolationType;
  entityId: string;
  entityTenantId: string;
  expectedTenantId: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Domain Isolation Result — per-domain summary
// ---------------------------------------------------------------------------

/**
 * Result of isolation check for a single domain.
 *
 * totalEntities: how many entities were checked
 * foreignEntities: how many had wrong tenantId
 * overallResult: PASS only if foreignEntities === 0
 */
export interface DomainIsolationResult {
  domain: string;
  totalEntities: number;
  foreignEntities: number;
  overallResult: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Tenant Isolation Scan Result
// ---------------------------------------------------------------------------

/**
 * Aggregated result of a full tenant isolation scan.
 *
 * Contains per-domain results and all violations.
 * overallResult: PASS only if zero violations across all domains.
 * Binary only. No partial pass.
 */
export interface TenantIsolationScanResult {
  tenantId: string;
  communicationIsolation: DomainIsolationResult;
  responseIsolation: DomainIsolationResult;
  archiveIsolation: DomainIsolationResult;
  auditTraceIsolation: DomainIsolationResult;
  artifactLookupIsolation: DomainIsolationResult;
  violations: TenantIsolationViolation[];
  totalChecks: number;
  totalViolations: number;
  overallResult: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// CI Tenant Isolation Enforcement Result
// ---------------------------------------------------------------------------

/**
 * Result of CI enforcement for tenant isolation.
 *
 * Binary only: PASS or FAIL.
 * If FAIL, build MUST be blocked.
 * No soft pass. No warning-only mode. No bypass.
 */
export interface CITenantIsolationEnforcementResult {
  result: 'PASS' | 'FAIL';
  foreignCommunications: number;
  foreignResponses: number;
  foreignArchiveDocuments: number;
  foreignTraceReferences: number;
  totalChecks: number;
  totalViolations: number;
}
