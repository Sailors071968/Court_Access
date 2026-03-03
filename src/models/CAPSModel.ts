// ============================================
// Court Access — CAPS v1.0 Public Proof Standard (Phase 8)
// Cryptographic Audit Proof Structure
//
// Defines the canonical proof envelope, signature binding,
// validation matrix, and embedding structure.
//
// CAPS v1.0 is the public-facing cryptographic proof standard.
// It binds export artifacts to dual-hash integrity proofs,
// anchor chain references, and immutable core identity.
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No ranking
//   - No anomaly detection
//   - No likelihood
//   - No confidence
//   - No prediction
//   - No intent inference
//   - No interpretive language
//   - No mutation
//   - No randomness
//   - No optional security downgrade paths
//   - Additive-only cryptographic posture
// ============================================

// ---------------------------------------------------------------------------
// CAPS v1.0 Proof Envelope
// ---------------------------------------------------------------------------

/**
 * CAPS v1.0 Proof Envelope.
 *
 * This is the canonical cryptographic proof structure for Court Access exports.
 * All fields are REQUIRED. No optional fields. No null fields.
 *
 * Canonical JSON key order (FIXED and DOCUMENTED):
 *   1. "version"
 *   2. "sha256"
 *   3. "sha3_256"
 *   4. "scopeHash"
 *   5. "immutableCoreHash"
 *   6. "merkleRoot"
 *   7. "anchorEpoch"
 *   8. "nonInterpretiveDeclaration"
 *
 * Serialization enforced via explicit string construction.
 * NOT relying on JSON.stringify object key insertion order.
 *
 * Constraints:
 *   - sha256 and sha3_256 are dual-hash of canonical export JSON
 *   - scopeHash is the per-export scope hash
 *   - immutableCoreHash is the system-wide immutable core constant
 *   - merkleRoot is from the daily anchor chain (TATL)
 *   - anchorEpoch is the fixed anchor year
 *   - nonInterpretiveDeclaration is always true (structural assertion)
 *   - version is always "1.0" for CAPS v1.0
 */
export interface CAPSProofEnvelope {
  version: string;                     // Always "1.0" for CAPS v1.0
  sha256: string;                      // SHA-256 of canonical export JSON
  sha3_256: string;                    // SHA3-256 of canonical export JSON
  scopeHash: string;                   // Per-export scope hash
  immutableCoreHash: string;           // System-wide immutable core hash reference
  merkleRoot: string;                  // Daily anchor Merkle root (from TATL)
  anchorEpoch: number;                 // Fixed anchor year (e.g. 2026)
  nonInterpretiveDeclaration: true;    // Always true — structural assertion
}

// ---------------------------------------------------------------------------
// CAPS Signature Binding
// ---------------------------------------------------------------------------

/**
 * CAPS Signature Binding.
 *
 * Binds a proof envelope to a cryptographic signature.
 * The signature attests to the integrity of the proof envelope.
 *
 * Canonical JSON key order (FIXED and DOCUMENTED):
 *   1. "proofSha256"
 *   2. "proofSha3_256"
 *   3. "signerIdentifier"
 *   4. "signatureAlgorithm"
 *   5. "signatureValue"
 *   6. "signedAt"
 *
 * Constraints:
 *   - proofSha256 and proofSha3_256 are dual-hash of canonical CAPS proof JSON
 *   - signerIdentifier is the identity of the signer (tenant, system, etc.)
 *   - signatureAlgorithm is the algorithm used (e.g. "Ed25519", "ECDSA-P256")
 *   - signatureValue is the hex-encoded signature
 *   - signedAt is a deterministic timestamp (ISO 8601 UTC, passed as input — no Date.now())
 *
 * Phase 8 establishes the structure.
 * Actual cryptographic signing will be implemented in later phases.
 */
export interface CAPSSignatureBinding {
  proofSha256: string;                 // SHA-256 of canonical CAPS proof JSON
  proofSha3_256: string;               // SHA3-256 of canonical CAPS proof JSON
  signerIdentifier: string;            // Identity of the signer
  signatureAlgorithm: string;          // Algorithm (e.g. "Ed25519")
  signatureValue: string;              // Hex-encoded signature value
  signedAt: string;                    // ISO 8601 UTC timestamp (deterministic input)
}

// ---------------------------------------------------------------------------
// CAPS Signed Proof (Envelope + Signature)
// ---------------------------------------------------------------------------

/**
 * A CAPS proof envelope with its signature binding.
 * The signature attests to the proof envelope's integrity.
 */
export interface CAPSSignedProof {
  proof: CAPSProofEnvelope;
  signature: CAPSSignatureBinding;
}

// ---------------------------------------------------------------------------
// CAPS Validation Field Result
// ---------------------------------------------------------------------------

/**
 * Validation result for a single CAPS field.
 * Binary output only: PASS or FAIL.
 * No explanation text. No scoring.
 */
export interface CAPSFieldValidation {
  field: string;                       // Field name being validated
  result: 'PASS' | 'FAIL';            // Binary only
}

// ---------------------------------------------------------------------------
// CAPS Validation Matrix
// ---------------------------------------------------------------------------

/**
 * Full CAPS validation matrix.
 *
 * Each required field is validated independently.
 * Overall result is PASS only if ALL fields pass.
 * Binary output only: PASS or FAIL.
 *
 * No partial pass. No percentage. No scoring.
 * No explanation text for individual failures.
 */
export interface CAPSValidationMatrix {
  fields: CAPSFieldValidation[];       // Per-field validation results
  overallResult: 'PASS' | 'FAIL';     // PASS only if ALL fields pass
}

// ---------------------------------------------------------------------------
// CAPS Embedded Export
// ---------------------------------------------------------------------------

/**
 * A court packet export with its CAPS v1.0 proof envelope embedded.
 *
 * This is the final deliverable structure:
 *   - The canonical export artifact
 *   - The CAPS v1.0 proof envelope binding the export to integrity proofs
 *
 * The proof envelope is embedded alongside (not inside) the export.
 * The export canonical JSON is the source of the proof hashes.
 */
export interface CAPSEmbeddedExport {
  exportCanonicalJson: string;         // The canonical JSON of the export artifact
  proof: CAPSProofEnvelope;           // The CAPS v1.0 proof envelope
}

// ---------------------------------------------------------------------------
// CAPS Proof Construction Input
// ---------------------------------------------------------------------------

/**
 * Input for constructing a CAPS v1.0 proof envelope.
 * The caller provides all required values; the engine validates and assembles.
 */
export interface CAPSProofInput {
  exportSha256: string;                // SHA-256 of canonical export JSON
  exportSha3_256: string;              // SHA3-256 of canonical export JSON
  scopeHash: string;                   // Per-export scope hash
  immutableCoreHash: string;           // System-wide immutable core hash reference
  merkleRoot: string;                  // Daily anchor Merkle root
  anchorEpoch: number;                 // Fixed anchor year
}

// ---------------------------------------------------------------------------
// CAPS Integrity Verification Result
// ---------------------------------------------------------------------------

/**
 * Result of verifying a CAPS proof envelope's integrity.
 * Dual-hash of the canonical CAPS proof JSON is computed on demand.
 * Hashes are derived, not stored.
 */
export interface CAPSIntegrityResult {
  verified: boolean;                   // True ONLY if BOTH hashes match reference
  computedSha256: string;              // SHA-256 of canonical CAPS proof JSON
  computedSha3_256: string;            // SHA3-256 of canonical CAPS proof JSON
}
