// ============================================
// Court Access — Cross-Case Index Model (Phase 14)
// Cross-Case Officer & Pattern Indexing
//
// Defines types for detecting mechanical variations
// across cases involving same officer, department,
// policy citation, or report language structure.
//
// This is documentation intelligence infrastructure:
//   - No allegations
//   - No claims of pattern
//   - No claims of misconduct
//   - No statistical inference
//   - Allowed: "Identical language detected in X cases."
//   - Not allowed: "Pattern of misconduct" / "Systemic issue"
//
// Architectural boundary:
//   - Does NOT import any engine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction
//   - No credibility analysis / intent inference
//   - No "pattern strength" / probabilistic scoring
//   - Deterministic processing
//   - Two-pass hash derivation
//   - Cross-tenant isolation enforced
// ============================================

// ---------------------------------------------------------------------------
// Officer Registry Entity — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of an officer across cases within a single tenant.
 *
 * Name normalization: uppercase only, strip punctuation, deterministic.
 * Two-pass hash derivation.
 *
 * Must never compare across tenants.
 * Append-only. No update. No delete.
 */
export interface OfficerRegistryEntity {
  officerId: string;                         // SHA-256 of canonical pre-ID form
  normalizedOfficerName: string;             // Uppercase, punctuation stripped
  departmentId: string;
  tenantId: string;                          // Tenant isolation field
  associatedCaseIds: string[];               // Sorted ASCII ascending
  sha256: string;
  sha3_256: string;
}

// ---------------------------------------------------------------------------
// Officer Registry Input
// ---------------------------------------------------------------------------

export interface OfficerRegistryInput {
  normalizedOfficerName: string;
  departmentId: string;
  tenantId: string;
  associatedCaseIds: string[];
}

// ---------------------------------------------------------------------------
// Cross-Case Variation Entity — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of a detected variation across cases.
 *
 * comparisonSummary must:
 *   - Contain citation references
 *   - Contain language excerpts only
 *   - No narrative commentary
 *
 * Two-pass hash derivation.
 * Append-only. No update. No delete.
 */
export interface CrossCaseVariationEntity {
  variationId: string;                       // SHA-256 of canonical pre-ID form
  officerId: string;
  tenantId: string;                          // Tenant isolation field
  involvedCaseIds: string[];                 // Sorted ASCII ascending
  comparisonSummary: string;                 // Structured citation + excerpt only
  sha256: string;
  sha3_256: string;
}

// ---------------------------------------------------------------------------
// Cross-Case Variation Input
// ---------------------------------------------------------------------------

export interface CrossCaseVariationInput {
  officerId: string;
  tenantId: string;
  involvedCaseIds: string[];
  comparisonSummary: string;
}

// ---------------------------------------------------------------------------
// Cross-Case Segment Pair
// ---------------------------------------------------------------------------

/**
 * A pair of token-aligned segments from different cases
 * for cross-case comparison.
 */
export interface CrossCaseSegmentPair {
  caseIdA: string;
  caseIdB: string;
  citationA: string;
  citationB: string;
  tokensA: string[];
  tokensB: string[];
}

// ---------------------------------------------------------------------------
// Cross-Case Comparison Result
// ---------------------------------------------------------------------------

/**
 * Result of comparing segments across cases.
 *
 * identicalLanguage: true if token sequences are identical
 * differingTokenCount: number of tokens that differ
 *
 * No "pattern strength". No probabilistic scoring.
 */
export interface CrossCaseComparisonResult {
  caseIdA: string;
  caseIdB: string;
  citationA: string;
  citationB: string;
  identicalLanguage: boolean;
  differingTokenCount: number;
}
