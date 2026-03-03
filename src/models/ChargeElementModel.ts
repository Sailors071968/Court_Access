// ============================================
// Court Access — Charge Element Model (Phase 4)
// Structured Issue Index Engine (CALCRIM Layer)
//
// Core legal structuring entities.
// Deterministic. Tenant-scoped. Dual-hashed.
//
// Constitutional boundaries (Phase 5 — Structured Element Mapping):
//   - No strength scores
//   - No probabilities
//   - No element ranking
//   - No intent inference
//   - No strategy recommendations
//   - No outcome predictions
//   - Binary structural mapping only
// ============================================

// ---------------------------------------------------------------------------
// Element Status — strictly bounded
// ---------------------------------------------------------------------------

/**
 * The status of a charge element.
 * Determined by explicit structural conditions only.
 *
 * Established — at least one supporting citation exists
 * Disputed    — conflicting citations exist
 * Unclear     — citations exist but are incomplete
 * NotFound    — no citations reference this element
 *
 * No confidence levels. No strength percentages.
 * No likelihood. No risk ratings.
 */
export type ElementStatus = 'Established' | 'Disputed' | 'Unclear' | 'NotFound';

// ---------------------------------------------------------------------------
// Charge Element Entity
// ---------------------------------------------------------------------------

/**
 * A single provable element within a criminal charge.
 * Maps to a CALCRIM jury instruction element.
 *
 * Binary state rule (Phase 4 + Phase 35):
 *   - contentHash and sha3Hash are REQUIRED (non-null).
 *   - A ChargeElementEntity only exists after full construction.
 *
 * Immutability contract:
 *   - contentHash (SHA-256) is REQUIRED and IMMUTABLE once set.
 *   - sha3Hash (SHA3-256) is REQUIRED and IMMUTABLE once set.
 *   - supportingDocumentIds and supportingCitationReferences are sorted and frozen.
 *
 * Dual-hash doctrine (Phase 24 — Crypto Survivability Horizon):
 *   - Both hashes computed from canonical JSON serialization of element data.
 *   - Both are immutable once set.
 */
export interface ChargeElementEntity {
  id: string;                              // Deterministic — derived from contentHash
  tenantId: string;
  caseId: string;
  chargeId: string;

  elementNumber: number;                   // CALCRIM element number (1-indexed, ascending)
  elementDescription: string;              // Statutory element text

  status: ElementStatus;                   // Binary structural status — no scores

  supportingDocumentIds: string[];         // Explicit, sorted (ascending lexicographic)
  supportingCitationReferences: string[];  // Explicit, sorted (ascending lexicographic)

  contentHash: string;                     // SHA-256 — REQUIRED, immutable
  sha3Hash: string;                        // SHA3-256 — REQUIRED, immutable
}

// ---------------------------------------------------------------------------
// Structured Issue Index Result
// ---------------------------------------------------------------------------

/**
 * The result of structuring a charge into its element index.
 * Contains all elements for a single charge, dual-hashed for integrity.
 *
 * The result itself is dual-hashed:
 *   - resultContentHash: SHA-256 of canonical JSON serialization
 *   - resultSha3Hash: SHA3-256 of same serialization
 *
 * Canonical JSON key order is fixed and documented in the engine.
 */
export interface StructuredIssueIndexResult {
  chargeId: string;
  elements: ChargeElementEntity[];         // Sorted by elementNumber (ascending)
  integrityVerified: boolean;              // True once all element hashes verified
  resultContentHash: string;               // SHA-256 of canonical JSON — REQUIRED
  resultSha3Hash: string;                  // SHA3-256 of canonical JSON — REQUIRED
}

// ---------------------------------------------------------------------------
// Issue Index Construction Input
// ---------------------------------------------------------------------------

/**
 * Input for constructing a structured issue index for a charge.
 * The caller provides the charge metadata and element data;
 * the engine computes hashes, assigns statuses, and returns the result.
 */
export interface IssueIndexInput {
  tenantId: string;
  caseId: string;
  chargeId: string;
  elements: ElementInput[];
}

/**
 * Input for a single element within a charge.
 * Status is NOT provided by the caller — it is determined by the engine
 * based on structural conditions (citation presence/conflict).
 */
export interface ElementInput {
  elementNumber: number;
  elementDescription: string;
  supportingDocumentIds: string[];
  supportingCitationReferences: string[];
  /** Optional: explicitly conflicting citation references (triggers Disputed status) */
  conflictingCitationReferences: string[];
}
