// ============================================
// Court Access — Policy Comparison Model (Phase 10)
// Policy Language vs Conduct Mapping
//
// Defines types for mechanically comparing department
// policy text to conduct description.
//
// This is documentation intelligence infrastructure:
//   - No claim of violation
//   - No accusation
//   - Only language alignment comparison
//   - Allowed phrasing: "Language differs."
//
// Architectural boundary:
//   - Does NOT import any engine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction / strategy
//   - No credibility analysis / intent inference
//   - No "likely" / "appears to" / "suggests"
//   - No "weak" / "strong" / "contradiction" / "violation"
//   - Deterministic processing
//   - Two-pass hash derivation
// ============================================

// ---------------------------------------------------------------------------
// Department Policy
// ---------------------------------------------------------------------------

/**
 * A department policy section with verbatim text.
 * No paraphrasing. Exact policy language only.
 */
export interface DepartmentPolicy {
  departmentId: string;
  policySectionId: string;
  verbatimText: string;                      // Exact policy text
}

// ---------------------------------------------------------------------------
// Policy Comparison Result
// ---------------------------------------------------------------------------

/**
 * Result of comparing a conduct description to a policy section.
 *
 * languageDifferenceDetected: true if language differs
 *
 * No "inconsistent" phrasing.
 * Only: "Language differs."
 */
export interface PolicyComparisonResult {
  conductCitation: string;                   // Citation to conduct description
  policyCitation: string;                    // Citation to policy section
  languageDifferenceDetected: boolean;       // true = language differs
}

// ---------------------------------------------------------------------------
// Policy Comparison Entity — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of policy-to-conduct comparison for a case.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> comparisonId
 *   Pass 2: full canonical -> dual-hash
 *
 * Append-only. No update. No delete.
 */
export interface PolicyComparisonEntity {
  comparisonId: string;                      // SHA-256 of canonical pre-ID form
  caseId: string;
  departmentId: string;
  results: PolicyComparisonResult[];
  totalComparisons: number;
  differencesDetected: number;
  sha256: string;
  sha3_256: string;
}

// ---------------------------------------------------------------------------
// Policy Comparison Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a policy comparison entity.
 */
export interface PolicyComparisonInput {
  caseId: string;
  departmentId: string;
  results: PolicyComparisonResult[];
}

// ---------------------------------------------------------------------------
// Conduct Segment
// ---------------------------------------------------------------------------

/**
 * A segment of conduct description with citation reference.
 */
export interface ConductSegment {
  conductCitation: string;
  tokens: string[];
  rawText: string;
}

// ---------------------------------------------------------------------------
// Policy Segment
// ---------------------------------------------------------------------------

/**
 * A segment of policy text with citation reference.
 */
export interface PolicySegment {
  policyCitation: string;
  policySectionId: string;
  tokens: string[];
  rawText: string;
}
