// ============================================
// Court Access — Referential Integrity Model (Phase 17)
// Cross-Entity Referential Integrity Layer
//
// Defines validation types for cross-entity linkage verification:
//   - Response-to-Communication linkage
//   - AuditTrace crossPhaseRef validation
//   - Archive-to-artifact reference validation
//   - Cross-tenant isolation enforcement
//   - Orphan detection
//
// This layer ensures no entity can reference a nonexistent,
// fabricated, or cross-tenant artifact. Every linkage is
// verified deterministically against the source entity set.
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
//   - No mutation
//   - No deletion
//   - No update
//   - Binary PASS/FAIL only
//   - ASCII comparator only
//   - Deterministic processing
// ============================================

// ---------------------------------------------------------------------------
// Linkage Domain — which cross-entity relationship is being validated
// ---------------------------------------------------------------------------

/**
 * Linkage domain — identifies the type of cross-entity relationship.
 * Additive-only — new domains may be added, none removed.
 *
 * RESPONSE_TO_COMMUNICATION — Response.linkedCommunicationId exists in communication chain
 * AUDIT_TRACE_CROSS_REF     — AuditTrace.crossPhaseRefs reference valid artifact hashes
 * ARCHIVE_TO_DOCUMENT       — Archive.documentIds / documentHashes reference valid documents
 * ARCHIVE_TO_COMMUNICATION  — Archive events reference valid communication artifacts
 */
export type LinkageDomain =
  | 'RESPONSE_TO_COMMUNICATION'
  | 'AUDIT_TRACE_CROSS_REF'
  | 'ARCHIVE_TO_DOCUMENT'
  | 'ARCHIVE_TO_COMMUNICATION';

// ---------------------------------------------------------------------------
// Linkage Violation Type — what kind of integrity failure was detected
// ---------------------------------------------------------------------------

/**
 * Violation types — categorizes the nature of the integrity failure.
 *
 * ORPHAN_REFERENCE        — Referenced entity does not exist
 * HASH_MISMATCH           — Referenced hash does not match source entity hash
 * CROSS_TENANT_LEAK       — Referenced entity belongs to a different tenant
 * MISSING_FIELD           — Required linkage field is empty or missing
 * DUPLICATE_REFERENCE     — Same artifact referenced multiple times in a single context
 */
export type LinkageViolationType =
  | 'ORPHAN_REFERENCE'
  | 'HASH_MISMATCH'
  | 'CROSS_TENANT_LEAK'
  | 'MISSING_FIELD'
  | 'DUPLICATE_REFERENCE';

// ---------------------------------------------------------------------------
// Single Linkage Violation
// ---------------------------------------------------------------------------

/**
 * A single referential integrity violation.
 *
 * Each violation identifies:
 *   - domain: which cross-entity relationship failed
 *   - violationType: what kind of failure
 *   - sourceEntityId: the entity that holds the bad reference
 *   - sourceField: which field contains the bad reference
 *   - referencedValue: the value that was expected to resolve
 *   - description: human-readable description (no interpretive language)
 */
export interface LinkageViolation {
  domain: LinkageDomain;
  violationType: LinkageViolationType;
  sourceEntityId: string;
  sourceField: string;
  referencedValue: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Response Linkage Validation Result
// ---------------------------------------------------------------------------

/**
 * Result of validating a single Response-to-Communication linkage.
 *
 * Checks:
 *   1. linkedCommunicationId exists in the communication chain
 *   2. The linked communication belongs to the same tenant
 *   3. The linked communication belongs to the same agency
 *   4. bodyHash is not empty
 *
 * Binary only: PASS or FAIL.
 */
export interface ResponseLinkageResult {
  responseId: string;
  linkedCommunicationId: string;
  communicationExists: 'PASS' | 'FAIL';
  tenantMatch: 'PASS' | 'FAIL';
  agencyMatch: 'PASS' | 'FAIL';
  bodyHashPresent: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Audit Trace Cross-Reference Validation Result
// ---------------------------------------------------------------------------

/**
 * Result of validating a single AuditTrace crossPhaseRef.
 *
 * Checks:
 *   1. artifactId resolves to an existing entity
 *   2. artifactHash matches the source entity's sha256
 *   3. phase number is valid (positive integer)
 *
 * Binary only: PASS or FAIL.
 */
export interface CrossRefValidationResult {
  traceId: string;
  phase: number;
  artifactType: string;
  artifactId: string;
  artifactExists: 'PASS' | 'FAIL';
  hashMatch: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Archive Reference Validation Result
// ---------------------------------------------------------------------------

/**
 * Result of validating a single archive-to-artifact reference.
 *
 * Checks:
 *   1. Each documentId in archive exists in the document set
 *   2. Each documentHash matches the source document's contentHash
 *   3. No cross-tenant references
 *
 * Binary only: PASS or FAIL.
 */
export interface ArchiveReferenceResult {
  archiveId: string;
  totalDocumentRefs: number;
  resolvedRefs: number;
  unresolvedRefs: number;
  hashMismatches: number;
  crossTenantViolations: number;
  overallResult: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Batch Referential Integrity Result
// ---------------------------------------------------------------------------

/**
 * Aggregated result of a full referential integrity scan.
 *
 * Contains all violations discovered across all domains.
 * overallResult: PASS only if zero violations across all domains.
 * Binary only. No partial pass.
 */
export interface ReferentialIntegrityScanResult {
  responseLinkageResults: ResponseLinkageResult[];
  crossRefResults: CrossRefValidationResult[];
  archiveReferenceResults: ArchiveReferenceResult[];
  violations: LinkageViolation[];
  totalChecks: number;
  totalViolations: number;
  overallResult: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Referential Integrity Field Validation
// ---------------------------------------------------------------------------

/**
 * Single field validation for referential integrity checks.
 * Binary only: PASS or FAIL.
 */
export interface ReferentialIntegrityFieldValidation {
  field: string;
  result: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Referential Integrity Validation Matrix
// ---------------------------------------------------------------------------

/**
 * Validation matrix for referential integrity.
 * Overall: PASS only if ALL fields pass.
 * No partial pass. Binary only.
 */
export interface ReferentialIntegrityValidationMatrix {
  fields: ReferentialIntegrityFieldValidation[];
  overallResult: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// CI Referential Integrity Enforcement Result
// ---------------------------------------------------------------------------

/**
 * Result of CI enforcement for referential integrity.
 *
 * Binary only: PASS or FAIL.
 * If FAIL, build MUST be blocked.
 * No soft pass. No warning-only mode.
 */
export interface CIReferentialIntegrityEnforcementResult {
  result: 'PASS' | 'FAIL';
  orphanReferences: number;
  hashMismatches: number;
  crossTenantLeaks: number;
  missingFields: number;
  duplicateReferences: number;
  totalChecks: number;
  totalViolations: number;
}

// ---------------------------------------------------------------------------
// Artifact Lookup Map Types
// ---------------------------------------------------------------------------

/**
 * A resolved artifact — the minimal fields needed for linkage validation.
 *
 * Callers build these lookup maps from their entity stores.
 * The engine never imports or queries stores directly.
 * This preserves pure-function discipline.
 */
export interface ResolvedArtifact {
  artifactId: string;
  tenantId: string;
  sha256: string;
}

/**
 * A resolved communication — minimal fields for response linkage validation.
 */
export interface ResolvedCommunication {
  communicationId: string;
  tenantId: string;
  agencyId: string;
  messageHash: string;
  sha256: string;
}

/**
 * A resolved document — minimal fields for archive reference validation.
 */
export interface ResolvedDocument {
  documentId: string;
  tenantId: string;
  contentHash: string;
}
