// ============================================
// Court Access — Case Version Model (Phase 15)
// Immutable Versioned Case Evolution Engine
//
// Defines types for tracking case evolution over time.
// No overwrites. Append-only version chain.
//
// This is documentation intelligence infrastructure:
//   - Track document uploads, issue index versions,
//     CALCRIM mappings, policy comparisons, media alignments
//   - previousVersionHash integrity enforced
//   - No branching — linear chain only
//   - No mutation — append-only
//   - No deletion — archive only
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
//   - Deterministic processing
//   - Two-pass hash derivation
// ============================================

// ---------------------------------------------------------------------------
// Case Version Entity — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of a case version in the evolution chain.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> versionId
 *   Pass 2: full canonical -> dual-hash
 *
 * Chain enforcement:
 *   - previousVersionHash must match the sha256 of the prior version
 *   - First version has previousVersionHash === null
 *   - No branching — linear chain only
 *   - No mutation — append-only
 *   - No deletion — archive only, archived versions still verifiable
 */
export interface CaseVersionEntity {
  versionId: string;                         // SHA-256 of canonical pre-ID form
  caseId: string;
  tenantId: string;
  versionNumber: number;                     // 1-indexed, sequential
  previousVersionHash: string | null;        // sha256 of prior version, null for first
  snapshotHash: string;                      // Hash of the analysis snapshot at this version
  createdTimestamp: string;                   // ISO 8601, caller-provided
  sha256: string;
  sha3_256: string;
}

// ---------------------------------------------------------------------------
// Case Version Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new case version entity.
 */
export interface CaseVersionInput {
  caseId: string;
  tenantId: string;
  versionNumber: number;
  previousVersionHash: string | null;
  snapshotHash: string;
  createdTimestamp: string;
}

// ---------------------------------------------------------------------------
// Version Chain Verification Result
// ---------------------------------------------------------------------------

/**
 * Result of verifying an entire version chain.
 *
 * Binary PASS/FAIL per version + overall.
 * Checks chronological sequence and previousVersionHash linkage.
 */
export interface VersionChainVerificationResult {
  totalVersions: number;
  verifiedVersions: number;
  failedVersions: number;
  chainIntegrityStatus: 'PASS' | 'FAIL';
  versionResults: VersionVerificationEntry[];
}

// ---------------------------------------------------------------------------
// Version Verification Entry
// ---------------------------------------------------------------------------

/**
 * Verification result for a single version in the chain.
 */
export interface VersionVerificationEntry {
  versionId: string;
  versionNumber: number;
  versionIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  previousVersionLinkage: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}
