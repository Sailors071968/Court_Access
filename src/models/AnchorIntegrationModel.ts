// ============================================
// Court Access — Anchor Integration Model (Phase 11)
// Daily Anchor Chain Integration with CAPS + Hybrid Signatures
//
// Cross-layer binding types for the complete trust chain:
//   Export → CAPS → Merkle → Anchor → Signature
//
// Deterministic. Canonical. Binary verification only.
// No circular dependencies. No mutation of prior records.
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
//   - No circular dependencies
//   - Additive-only cryptographic posture
//   - Append-only anchor discipline
//   - Raw lowercase hex only (no prefix encoding)
//   - ASCII comparator only (no localeCompare)
//   - No Date object usage in core logic
// ============================================

import type { CAPSProofEnvelope } from './CAPSModel';
import type { DailyAnchorEntity } from './AnchorModel';
import type { HybridSignatureBundle } from './SignatureModel';

// ---------------------------------------------------------------------------
// Anchor-Integrated Proof Record — full trust chain binding
// ---------------------------------------------------------------------------

/**
 * A complete anchor-integrated proof record.
 *
 * Binds together:
 *   1. capsProof: the CAPS v1.0 proof envelope (export integrity)
 *   2. anchor: the daily anchor entity (time binding)
 *   3. signatureBundle: the hybrid signature bundle (multi-algorithm attestation)
 *   4. exportHash: SHA-256 of the canonical export JSON (linkage root)
 *   5. merkleLeafHash: the hashed leaf used in the Merkle tree (domain-separated)
 *
 * Cross-layer hash linkage (directed, no cycles):
 *   exportHash → capsProof.sha256 (export binds to CAPS)
 *   capsProof.merkleRoot → anchor.merkleRoot (CAPS binds to anchor)
 *   capsProof.immutableCoreHash → anchor.immutableCoreHash (shared reference)
 *   capsProof.scopeHash → anchor.scopeHash (shared scope)
 *   capsProof.anchorEpoch → anchor.epoch (shared epoch)
 *   signatureBundle.payloadHash → SHA-256 of canonical CAPS proof (signature binds to CAPS)
 *
 * No circular dependencies. Each layer references only layers below it.
 * No mutation of prior records. Append-only.
 */
export interface AnchorIntegratedProofRecord {
  capsProof: CAPSProofEnvelope;
  anchor: DailyAnchorEntity;
  signatureBundle: HybridSignatureBundle;
  exportHash: string;                    // SHA-256 of canonical export JSON (raw 64-char hex)
  merkleLeafHash: string;               // Domain-separated leaf hash (raw 64-char hex)
  anchorDate: string;                    // YYYY-MM-DD — matches anchor.date
  recordEpoch: number;                   // Matches anchor.epoch and capsProof.anchorEpoch
}

// ---------------------------------------------------------------------------
// Integration Construction Input
// ---------------------------------------------------------------------------

/**
 * Input for constructing an anchor-integrated proof record.
 *
 * The caller provides all required components.
 * The engine validates cross-layer consistency and assembles the record.
 */
export interface AnchorIntegrationInput {
  capsProof: CAPSProofEnvelope;
  anchor: DailyAnchorEntity;
  signatureBundle: HybridSignatureBundle;
  exportHash: string;
  capsCanonicalHash: string;             // SHA-256 of canonical CAPS proof JSON
  merkleLeafHash: string;
  anchorDate: string;
}

// ---------------------------------------------------------------------------
// Cross-Layer Consistency Result — binary per-linkage
// ---------------------------------------------------------------------------

/**
 * Result of verifying cross-layer hash consistency.
 *
 * Each linkage is verified independently:
 *   - exportHashMatch: capsProof.sha256 === exportHash
 *   - merkleRootMatch: capsProof.merkleRoot === anchor.merkleRoot
 *   - immutableCoreMatch: capsProof.immutableCoreHash === anchor.immutableCoreHash
 *   - scopeHashMatch: capsProof.scopeHash === anchor.scopeHash
 *   - epochMatch: capsProof.anchorEpoch === anchor.epoch
 *   - signaturePayloadMatch: signatureBundle.payloadHash === capsCanonicalHash
 *   - anchorDateMatch: anchorDate === anchor.date
 *
 * allConsistent = true ONLY if ALL linkages pass.
 * No partial pass. Binary only.
 */
export interface CrossLayerConsistencyResult {
  exportHashMatch: boolean;
  merkleRootMatch: boolean;
  immutableCoreMatch: boolean;
  scopeHashMatch: boolean;
  epochMatch: boolean;
  signaturePayloadMatch: boolean;
  anchorDateMatch: boolean;
  allConsistent: boolean;
}

// ---------------------------------------------------------------------------
// Replay Validation Result — deterministic reconstruction
// ---------------------------------------------------------------------------

/**
 * Result of replay validation.
 *
 * Replay validation reconstructs the trust chain from inputs
 * and verifies that every hash and binding is reproducible.
 *
 * Binary only:
 *   - crossLayerConsistency: all cross-layer linkages verified
 *   - capsIntegrity: CAPS proof hashes are reproducible
 *   - anchorIntegrity: anchor hashes are reproducible
 *   - signatureVerification: all signatures verified
 *   - replayValid: true ONLY if ALL checks pass
 *
 * No partial pass. No scoring. No narrative.
 */
export interface ReplayValidationResult {
  crossLayerConsistency: CrossLayerConsistencyResult;
  capsIntegrityVerified: boolean;
  anchorIntegrityVerified: boolean;
  signatureVerified: boolean;
  replayValid: boolean;
}

// ---------------------------------------------------------------------------
// Integration Field Validation — binary per-field
// ---------------------------------------------------------------------------

/**
 * Single field validation entry for an integrated proof record.
 * Binary only: PASS or FAIL. No scoring. No narrative.
 */
export interface IntegrationFieldValidation {
  field: string;
  result: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Integration Validation Matrix — overall binary
// ---------------------------------------------------------------------------

/**
 * Validation matrix for an anchor-integrated proof record.
 *
 * Each required field is validated independently.
 * Overall result: PASS only if ALL fields pass.
 * No partial pass. No percentage. No scoring.
 */
export interface IntegrationValidationMatrix {
  fields: IntegrationFieldValidation[];
  overallResult: 'PASS' | 'FAIL';
}
