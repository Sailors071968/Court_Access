// ============================================
// Court Access — Hybrid Signature Model (Phase 10)
// RSA + Ed25519 + Dilithium
//
// All signature-related domain types.
// Deterministic. Canonical. Binary verification only.
// Additive-only cryptographic posture.
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
//   - No randomness in verification layer
//   - No optional security downgrade paths
//   - No single-algorithm dependency
//   - No silent fallback behavior
//   - No algorithm removal from registry
//   - Additive-only cryptographic posture
//   - Raw lowercase hex only (no prefix encoding)
//   - ASCII comparator only (no localeCompare)
//   - No Date object usage in core logic
// ============================================

// ---------------------------------------------------------------------------
// Algorithm Identifier — additive-only registry
// ---------------------------------------------------------------------------

/**
 * Supported signature algorithm identifiers.
 *
 * Registry rules:
 *   - Algorithms can only be ADDED, never removed
 *   - No single-algorithm dependency: system requires multi-algorithm signing
 *   - No silent fallback: if an algorithm is listed, it must be verified
 *   - No runtime selection: algorithm set is fixed at signing time
 *   - Identifiers are lowercase string constants
 *
 * Current registry (Phase 10):
 *   - 'rsa-sha256': RSA with SHA-256 (classical, widely deployed)
 *   - 'ed25519': Edwards-curve Digital Signature Algorithm (modern, compact)
 *   - 'dilithium3': CRYSTALS-Dilithium Level 3 (post-quantum, NIST standardized)
 *
 * Future algorithms are additive-only. Existing entries are immutable.
 */
export type SignatureAlgorithmId = 'rsa-sha256' | 'ed25519' | 'dilithium3';

// ---------------------------------------------------------------------------
// Algorithm Registry Entry — immutable definition
// ---------------------------------------------------------------------------

/**
 * A single entry in the signature algorithm registry.
 *
 * Properties:
 *   - id: algorithm identifier (matches SignatureAlgorithmId)
 *   - name: human-readable name (for documentation only, not used in verification)
 *   - keyType: type of key used ('rsa' | 'ed25519' | 'dilithium')
 *   - signatureHexLength: expected length of signature in hex characters
 *   - publicKeyHexLength: expected length of public key in hex characters
 *   - postQuantum: whether this algorithm is post-quantum resistant
 *   - registeredEpoch: the epoch at which this algorithm was added to the registry
 *
 * Registry entries are immutable. No field may be modified after registration.
 * No entry may be removed.
 */
export interface SignatureAlgorithmEntry {
  id: SignatureAlgorithmId;
  name: string;
  keyType: 'rsa' | 'ed25519' | 'dilithium';
  signatureHexLength: number;
  publicKeyHexLength: number;
  postQuantum: boolean;
  registeredEpoch: number;
}

// ---------------------------------------------------------------------------
// Signature Algorithm Registry — additive-only, immutable
// ---------------------------------------------------------------------------

/**
 * The full signature algorithm registry.
 *
 * Rules:
 *   - entries: array of SignatureAlgorithmEntry, sorted by id (ASCII comparator)
 *   - registryVersion: monotonically increasing integer (increments on addition only)
 *   - No removal. No mutation. Additive-only.
 *   - No downgrade: once an algorithm is registered, it cannot be disabled
 */
export interface SignatureAlgorithmRegistry {
  entries: SignatureAlgorithmEntry[];
  registryVersion: number;
}

// ---------------------------------------------------------------------------
// Individual Signature — one algorithm's output
// ---------------------------------------------------------------------------

/**
 * A single signature produced by one algorithm.
 *
 * Properties:
 *   - algorithmId: which algorithm produced this signature
 *   - publicKeyHex: the signer's public key (raw lowercase hex)
 *   - signatureHex: the signature value (raw lowercase hex)
 *   - signedPayloadHash: SHA-256 hash of the canonical payload that was signed (raw 64-char hex)
 *
 * No metadata. No timestamps. No interpretive fields.
 * The signature is bound to the payload via signedPayloadHash.
 */
export interface IndividualSignature {
  algorithmId: SignatureAlgorithmId;
  publicKeyHex: string;
  signatureHex: string;
  signedPayloadHash: string;
}

// ---------------------------------------------------------------------------
// Hybrid Signature Bundle — multi-algorithm binding
// ---------------------------------------------------------------------------

/**
 * A complete hybrid signature bundle.
 *
 * Contains one signature per registered algorithm.
 * All signatures must sign the SAME canonical payload hash.
 *
 * Properties:
 *   - signatures: array of IndividualSignature, one per algorithm
 *     Sorted by algorithmId (ASCII comparator)
 *   - payloadHash: the canonical payload hash all signatures are bound to (raw 64-char hex)
 *   - registryVersion: the registry version at time of signing
 *
 * Rules:
 *   - Every registered algorithm MUST have a signature entry
 *   - All signedPayloadHash values MUST match payloadHash
 *   - No partial bundles. No optional signatures.
 *   - No silent fallback to fewer algorithms.
 */
export interface HybridSignatureBundle {
  signatures: IndividualSignature[];
  payloadHash: string;
  registryVersion: number;
}

// ---------------------------------------------------------------------------
// Signature Verification Result — per-algorithm, binary
// ---------------------------------------------------------------------------

/**
 * Verification result for a single algorithm's signature.
 *
 * Binary only:
 *   - algorithmId: which algorithm was verified
 *   - verified: true ONLY if signature is valid for the given public key and payload
 *   - payloadHashMatch: true ONLY if signedPayloadHash === bundle payloadHash
 *
 * No partial verification. No scoring. No auto-correction.
 */
export interface IndividualSignatureVerificationResult {
  algorithmId: SignatureAlgorithmId;
  verified: boolean;
  payloadHashMatch: boolean;
}

// ---------------------------------------------------------------------------
// Hybrid Verification Result — all algorithms, binary
// ---------------------------------------------------------------------------

/**
 * Verification result for a complete hybrid signature bundle.
 *
 * Binary only:
 *   - results: per-algorithm verification results
 *   - allVerified: true ONLY if every algorithm's signature is verified AND payload hashes match
 *   - algorithmCount: number of algorithms verified
 *   - registryVersionMatch: true ONLY if bundle registryVersion matches current registry
 *
 * No partial pass. No scoring. No downgrade.
 * allVerified = true requires ALL algorithms to pass.
 */
export interface HybridSignatureVerificationResult {
  results: IndividualSignatureVerificationResult[];
  allVerified: boolean;
  algorithmCount: number;
  registryVersionMatch: boolean;
}

// ---------------------------------------------------------------------------
// Signature Field Validation — binary per-field
// ---------------------------------------------------------------------------

/**
 * Single field validation entry for a signature.
 * Binary only: PASS or FAIL. No scoring. No narrative.
 */
export interface SignatureFieldValidation {
  field: string;
  result: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Signature Validation Matrix — overall binary
// ---------------------------------------------------------------------------

/**
 * Validation matrix for a hybrid signature bundle.
 *
 * Each required field is validated independently.
 * Overall result: PASS only if ALL fields pass.
 * No partial pass. No percentage. No scoring.
 */
export interface SignatureValidationMatrix {
  fields: SignatureFieldValidation[];
  overallResult: 'PASS' | 'FAIL';
}
