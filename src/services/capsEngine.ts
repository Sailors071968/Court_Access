// ============================================
// Court Access — CAPS v1.0 Engine (Phase 8)
// Cryptographic Audit Proof Structure Engine
//
// Implements:
//   - CAPS proof envelope construction
//   - Canonical JSON serialization (fixed key order)
//   - Dual-hash verification rules
//   - Signature binding construction
//   - Export embedding rules
//   - Validation matrix (PASS/FAIL only)
//
// No UI dependencies. No React imports.
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

import type {
  CAPSProofEnvelope,
  CAPSProofInput,
  CAPSSignatureBinding,
  CAPSSignedProof,
  CAPSFieldValidation,
  CAPSValidationMatrix,
  CAPSEmbeddedExport,
  CAPSIntegrityResult,
} from '../models/CAPSModel';
import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

// ---------------------------------------------------------------------------
// Canonical JSON Serialization — CAPS Proof Envelope
// ---------------------------------------------------------------------------

/**
 * Canonical JSON serialization for CAPS v1.0 Proof Envelope.
 *
 * Key order is FIXED and DOCUMENTED:
 *   1. "version"
 *   2. "sha256"
 *   3. "sha3_256"
 *   4. "scopeHash"
 *   5. "immutableCoreHash"
 *   6. "merkleRoot"
 *   7. "anchorEpoch"
 *   8. "nonInterpretiveDeclaration"
 *
 * Key order enforced via explicit string construction.
 * NOT relying on JSON.stringify object key insertion order.
 * Uses JSON.stringify on individual values for RFC 8259 escaping.
 *
 * This is a pure function — same input always produces same output.
 */
export function canonicalizeCAPSProof(
  version: string,
  sha256: string,
  sha3_256: string,
  scopeHash: string,
  immutableCoreHash: string,
  merkleRoot: string,
  anchorEpoch: number,
  nonInterpretiveDeclaration: true
): string {
  return (
    '{' +
    `"version":${JSON.stringify(version)},` +
    `"sha256":${JSON.stringify(sha256)},` +
    `"sha3_256":${JSON.stringify(sha3_256)},` +
    `"scopeHash":${JSON.stringify(scopeHash)},` +
    `"immutableCoreHash":${JSON.stringify(immutableCoreHash)},` +
    `"merkleRoot":${JSON.stringify(merkleRoot)},` +
    `"anchorEpoch":${JSON.stringify(anchorEpoch)},` +
    `"nonInterpretiveDeclaration":${JSON.stringify(nonInterpretiveDeclaration)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonical JSON Serialization — CAPS Signature Binding
// ---------------------------------------------------------------------------

/**
 * Canonical JSON serialization for CAPS Signature Binding.
 *
 * Key order is FIXED and DOCUMENTED:
 *   1. "proofSha256"
 *   2. "proofSha3_256"
 *   3. "signerIdentifier"
 *   4. "signatureAlgorithm"
 *   5. "signatureValue"
 *   6. "signedAt"
 *
 * Key order enforced via explicit string construction.
 * NOT relying on JSON.stringify object key insertion order.
 *
 * This is a pure function — same input always produces same output.
 */
export function canonicalizeCAPSSignature(
  proofSha256: string,
  proofSha3_256: string,
  signerIdentifier: string,
  signatureAlgorithm: string,
  signatureValue: string,
  signedAt: string
): string {
  return (
    '{' +
    `"proofSha256":${JSON.stringify(proofSha256)},` +
    `"proofSha3_256":${JSON.stringify(proofSha3_256)},` +
    `"signerIdentifier":${JSON.stringify(signerIdentifier)},` +
    `"signatureAlgorithm":${JSON.stringify(signatureAlgorithm)},` +
    `"signatureValue":${JSON.stringify(signatureValue)},` +
    `"signedAt":${JSON.stringify(signedAt)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// CAPS Proof Envelope Construction
// ---------------------------------------------------------------------------

/**
 * Build a CAPS v1.0 Proof Envelope from input values.
 *
 * All required fields are provided by the caller.
 * The engine assembles the envelope with:
 *   - version = "1.0"
 *   - nonInterpretiveDeclaration = true
 *   - All other fields from input
 *
 * No computation here — hashes are pre-computed by the export engine.
 * This function is a pure assembler.
 *
 * This is a pure function — same input always produces same output.
 */
export function buildCAPSProofEnvelope(
  input: CAPSProofInput
): CAPSProofEnvelope {
  return {
    version: '1.0',
    sha256: input.exportSha256,
    sha3_256: input.exportSha3_256,
    scopeHash: input.scopeHash,
    immutableCoreHash: input.immutableCoreHash,
    merkleRoot: input.merkleRoot,
    anchorEpoch: input.anchorEpoch,
    nonInterpretiveDeclaration: true,
  };
}

// ---------------------------------------------------------------------------
// CAPS Signature Binding Construction
// ---------------------------------------------------------------------------

/**
 * Build a CAPS Signature Binding for a proof envelope.
 *
 * Pipeline:
 *   1. Canonicalize the proof envelope to JSON (fixed key order)
 *   2. Compute dual-hash of canonical proof JSON
 *   3. Assemble signature binding with signer metadata
 *
 * Phase 8 establishes the structure.
 * The signatureValue will be a placeholder until actual signing is implemented.
 *
 * Constraints:
 *   - signedAt must be provided as input (no Date.now())
 *   - signatureAlgorithm must be provided (no default fallback)
 *   - No optional security downgrade paths
 */
export async function buildCAPSSignatureBinding(
  proof: CAPSProofEnvelope,
  signerIdentifier: string,
  signatureAlgorithm: string,
  signatureValue: string,
  signedAt: string
): Promise<CAPSSignatureBinding> {
  // Step 1: Canonicalize proof envelope
  const canonicalProof = canonicalizeCAPSProof(
    proof.version,
    proof.sha256,
    proof.sha3_256,
    proof.scopeHash,
    proof.immutableCoreHash,
    proof.merkleRoot,
    proof.anchorEpoch,
    proof.nonInterpretiveDeclaration
  );

  // Step 2: Compute dual-hash of canonical proof JSON
  const proofSha256 = await computeTextSHA256(canonicalProof);
  const proofSha3_256 = computeTextSHA3_256(canonicalProof);

  // Step 3: Assemble signature binding
  return {
    proofSha256,
    proofSha3_256,
    signerIdentifier,
    signatureAlgorithm,
    signatureValue,
    signedAt,
  };
}

/**
 * Build a CAPS Signed Proof (envelope + signature binding).
 * Convenience function that combines proof and signature construction.
 */
export async function buildCAPSSignedProof(
  input: CAPSProofInput,
  signerIdentifier: string,
  signatureAlgorithm: string,
  signatureValue: string,
  signedAt: string
): Promise<CAPSSignedProof> {
  const proof = buildCAPSProofEnvelope(input);
  const signature = await buildCAPSSignatureBinding(
    proof,
    signerIdentifier,
    signatureAlgorithm,
    signatureValue,
    signedAt
  );
  return { proof, signature };
}

// ---------------------------------------------------------------------------
// CAPS Dual-Hash Verification
// ---------------------------------------------------------------------------

/**
 * Verify the integrity of a CAPS Proof Envelope.
 *
 * Computes SHA-256 and SHA3-256 from canonical proof JSON on demand.
 * Hashes are DERIVED, not stored.
 *
 * The caller provides reference hashes to compare against.
 * Returns verified: true ONLY if BOTH computed hashes match reference.
 *
 * Does NOT auto-correct. Never modifies the envelope.
 *
 * This is a pure function — same input always produces same output.
 */
export async function verifyCAPSIntegrity(
  proof: CAPSProofEnvelope,
  referenceSha256: string,
  referenceSha3_256: string
): Promise<CAPSIntegrityResult> {
  // Build canonical JSON from proof fields
  const canonical = canonicalizeCAPSProof(
    proof.version,
    proof.sha256,
    proof.sha3_256,
    proof.scopeHash,
    proof.immutableCoreHash,
    proof.merkleRoot,
    proof.anchorEpoch,
    proof.nonInterpretiveDeclaration
  );

  // Compute dual-hash on demand
  const computedSha256 = await computeTextSHA256(canonical);
  const computedSha3_256 = computeTextSHA3_256(canonical);

  return {
    verified: computedSha256 === referenceSha256 && computedSha3_256 === referenceSha3_256,
    computedSha256,
    computedSha3_256,
  };
}

/**
 * Verify a CAPS Signature Binding against its proof envelope.
 *
 * Re-computes dual-hash of canonical proof JSON
 * and compares to the stored proofSha256 and proofSha3_256 in the signature.
 *
 * Returns verified: true ONLY if BOTH hashes match.
 *
 * This does NOT verify the cryptographic signature itself —
 * that requires the signer's public key (future phases).
 * This verifies that the signature binding references the correct proof.
 *
 * This is a pure function — same input always produces same output.
 */
export async function verifyCAPSSignatureBinding(
  proof: CAPSProofEnvelope,
  signature: CAPSSignatureBinding
): Promise<CAPSIntegrityResult> {
  return verifyCAPSIntegrity(proof, signature.proofSha256, signature.proofSha3_256);
}

// ---------------------------------------------------------------------------
// CAPS Validation Matrix
// ---------------------------------------------------------------------------

/**
 * Validate a CAPS Proof Envelope against its requirements.
 *
 * Each required field is validated independently:
 *   - version: must be "1.0"
 *   - sha256: must be non-empty string starting with "sha256:"
 *   - sha3_256: must be non-empty string starting with "sha3-256:"
 *   - scopeHash: must be non-empty string starting with "sha256:"
 *   - immutableCoreHash: must be non-empty string
 *   - merkleRoot: must be non-empty string starting with "sha256:"
 *   - anchorEpoch: must be positive integer
 *   - nonInterpretiveDeclaration: must be true
 *
 * Overall result: PASS only if ALL fields pass.
 * No partial pass. No percentage. No scoring.
 * Binary output only: PASS or FAIL per field.
 *
 * This is a pure function — same input always produces same output.
 */
export function validateCAPSEnvelope(
  proof: CAPSProofEnvelope
): CAPSValidationMatrix {
  const fields: CAPSFieldValidation[] = [];

  // version: must be "1.0"
  fields.push({
    field: 'version',
    result: proof.version === '1.0' ? 'PASS' : 'FAIL',
  });

  // sha256: must be non-empty string starting with "sha256:"
  fields.push({
    field: 'sha256',
    result:
      typeof proof.sha256 === 'string' &&
      proof.sha256.length > 0 &&
      proof.sha256.startsWith('sha256:')
        ? 'PASS'
        : 'FAIL',
  });

  // sha3_256: must be non-empty string starting with "sha3-256:"
  fields.push({
    field: 'sha3_256',
    result:
      typeof proof.sha3_256 === 'string' &&
      proof.sha3_256.length > 0 &&
      proof.sha3_256.startsWith('sha3-256:')
        ? 'PASS'
        : 'FAIL',
  });

  // scopeHash: must be non-empty string starting with "sha256:"
  fields.push({
    field: 'scopeHash',
    result:
      typeof proof.scopeHash === 'string' &&
      proof.scopeHash.length > 0 &&
      proof.scopeHash.startsWith('sha256:')
        ? 'PASS'
        : 'FAIL',
  });

  // immutableCoreHash: must be non-empty string
  fields.push({
    field: 'immutableCoreHash',
    result:
      typeof proof.immutableCoreHash === 'string' &&
      proof.immutableCoreHash.length > 0
        ? 'PASS'
        : 'FAIL',
  });

  // merkleRoot: must be non-empty string starting with "sha256:"
  fields.push({
    field: 'merkleRoot',
    result:
      typeof proof.merkleRoot === 'string' &&
      proof.merkleRoot.length > 0 &&
      proof.merkleRoot.startsWith('sha256:')
        ? 'PASS'
        : 'FAIL',
  });

  // anchorEpoch: must be positive integer
  fields.push({
    field: 'anchorEpoch',
    result:
      typeof proof.anchorEpoch === 'number' &&
      Number.isInteger(proof.anchorEpoch) &&
      proof.anchorEpoch > 0
        ? 'PASS'
        : 'FAIL',
  });

  // nonInterpretiveDeclaration: must be true
  fields.push({
    field: 'nonInterpretiveDeclaration',
    result: proof.nonInterpretiveDeclaration === true ? 'PASS' : 'FAIL',
  });

  // Overall: PASS only if ALL fields pass
  const allPass = fields.every((f) => f.result === 'PASS');

  return {
    fields,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}

// ---------------------------------------------------------------------------
// CAPS Export Embedding
// ---------------------------------------------------------------------------

/**
 * Embed a CAPS v1.0 proof envelope alongside an export's canonical JSON.
 *
 * Embedding rules:
 *   - The export canonical JSON is the source of the proof hashes
 *   - The proof envelope is placed alongside (not inside) the export
 *   - The embedded structure contains both the canonical JSON and the proof
 *   - No modification of the export canonical JSON during embedding
 *
 * This is a pure function — same input always produces same output.
 */
export function embedCAPSInExport(
  exportCanonicalJson: string,
  proof: CAPSProofEnvelope
): CAPSEmbeddedExport {
  return {
    exportCanonicalJson,
    proof,
  };
}

/**
 * Canonical JSON serialization for CAPS Embedded Export.
 *
 * Key order is FIXED:
 *   1. "exportCanonicalJson" (as escaped string)
 *   2. "proof" (canonical CAPS proof JSON, inline)
 *
 * This is a pure function — same input always produces same output.
 */
export function canonicalizeCAPSEmbeddedExport(
  embedded: CAPSEmbeddedExport
): string {
  const proofJson = canonicalizeCAPSProof(
    embedded.proof.version,
    embedded.proof.sha256,
    embedded.proof.sha3_256,
    embedded.proof.scopeHash,
    embedded.proof.immutableCoreHash,
    embedded.proof.merkleRoot,
    embedded.proof.anchorEpoch,
    embedded.proof.nonInterpretiveDeclaration
  );

  return (
    '{' +
    `"exportCanonicalJson":${JSON.stringify(embedded.exportCanonicalJson)},` +
    `"proof":${proofJson}` +
    '}'
  );
}
