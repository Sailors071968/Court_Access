// ============================================
// Court Access — Evidence Anchor Binding Engine (Phase 20)
// Anchor-Coupled Evidence Packet Binding
//
// Binds EvidencePackets to the anchor chain:
//   1. Compute deterministic anchorLeafHash from packetId
//   2. Build canonical AnchorBindingEntity with two-pass hash derivation
//   3. Replay-verify all hashes from canonical JSON
//   4. CI enforcement gate (binary PASS/FAIL)
//
// Phase 20 does NOT compute Merkle roots.
// Phase 20 does NOT call anchor engine or signature engine.
// Instead:
//   - Caller provides anchorRootHash, anchorId, integrationHash, signatureHash
//   - Engine records the binding deterministically
//   - Separation preserved.
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - Async where SHA-256/SHA3-256 computation required
//   - Binary PASS/FAIL only (no scoring, no partial pass)
//
// Architectural boundary:
//   - Does NOT import anchorEngine
//   - Does NOT import signatureEngine
//   - Does NOT import merkleProofEngine
//   - Does NOT import exportEngine
//   - Only shared hashing functions from policyIngestionService
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access (callers provide all data)
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of input entities
//   - No deletion
//   - No update
//   - Binary PASS/FAIL only
//   - ASCII comparator only
//   - Canonical JSON only
//   - Deterministic processing
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  EvidenceAnchorBindingEntity,
  EvidenceAnchorBindingInput,
  EvidenceAnchorBindingVerificationResult,
  AnchorIntegrationLookup,
  SignatureLookup,
  CIEvidenceAnchorBindingEnforcementResult,
} from '../models/EvidenceAnchorBindingModel';

// ---------------------------------------------------------------------------
// Domain-Separated Anchor Leaf Hash
// ---------------------------------------------------------------------------

/**
 * Compute the anchor leaf hash for a packet.
 *
 * Uses Phase 9 domain separation rules:
 *   Leaf → SHA-256("00" + packetId)
 *
 * "00" is the domain separator for leaves.
 * packetId is the EvidencePacket.packetId (64-char lowercase hex).
 *
 * Async because computeTextSHA256 uses crypto.subtle.digest.
 * Deterministic — same packetId always produces same leaf hash.
 */
async function computeAnchorLeafHash(packetId: string): Promise<string> {
  return computeTextSHA256('00' + packetId);
}

// ---------------------------------------------------------------------------
// Canonical JSON — Binding Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for binding ID derivation.
 *
 * Includes (in fixed order):
 *   tenantId, packetId, packetSha256, anchorLeafHash,
 *   anchorRootHash, anchorId, integrationHash, signatureHash,
 *   generatedTimestamp, description
 *
 * Excludes:
 *   bindingId (derived FROM this form)
 *   sha256 (computed FROM full canonical form)
 *   sha3_256 (computed FROM full canonical form)
 *
 * Explicit string concatenation. Fixed key order.
 * No JSON.stringify key order dependency.
 */
function canonicalizeBindingPreId(
  input: EvidenceAnchorBindingInput,
  anchorLeafHash: string
): string {
  return (
    '{' +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"packetId":${JSON.stringify(input.packetId)},` +
    `"packetSha256":${JSON.stringify(input.packetSha256)},` +
    `"anchorLeafHash":${JSON.stringify(anchorLeafHash)},` +
    `"anchorRootHash":${JSON.stringify(input.anchorRootHash)},` +
    `"anchorId":${JSON.stringify(input.anchorId)},` +
    `"integrationHash":${JSON.stringify(input.integrationHash)},` +
    `"signatureHash":${JSON.stringify(input.signatureHash)},` +
    `"generatedTimestamp":${JSON.stringify(input.generatedTimestamp)},` +
    `"description":${JSON.stringify(input.description)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonical JSON — Binding Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for dual-hash computation.
 *
 * Includes (in fixed order):
 *   bindingId, tenantId, packetId, packetSha256, anchorLeafHash,
 *   anchorRootHash, anchorId, integrationHash, signatureHash,
 *   generatedTimestamp, description
 *
 * Excludes:
 *   sha256 (computed FROM this form)
 *   sha3_256 (computed FROM this form)
 *
 * No circular hash binding — hashes derived FROM this form, appended AFTER.
 */
function canonicalizeBindingFull(
  bindingId: string,
  input: EvidenceAnchorBindingInput,
  anchorLeafHash: string
): string {
  return (
    '{' +
    `"bindingId":${JSON.stringify(bindingId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"packetId":${JSON.stringify(input.packetId)},` +
    `"packetSha256":${JSON.stringify(input.packetSha256)},` +
    `"anchorLeafHash":${JSON.stringify(anchorLeafHash)},` +
    `"anchorRootHash":${JSON.stringify(input.anchorRootHash)},` +
    `"anchorId":${JSON.stringify(input.anchorId)},` +
    `"integrationHash":${JSON.stringify(input.integrationHash)},` +
    `"signatureHash":${JSON.stringify(input.signatureHash)},` +
    `"generatedTimestamp":${JSON.stringify(input.generatedTimestamp)},` +
    `"description":${JSON.stringify(input.description)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Evidence Anchor Binding
// ---------------------------------------------------------------------------

/**
 * Build a complete evidence anchor binding from input.
 *
 * Pipeline:
 *   1. Compute anchorLeafHash = SHA-256("00" + packetId)
 *   2. Canonicalize pre-ID form (excludes bindingId and hashes)
 *   3. Derive bindingId = SHA-256(preIdCanonical)
 *   4. Canonicalize full form (includes bindingId, excludes hashes)
 *   5. Compute dual-hash: SHA-256 and SHA3-256 of full canonical
 *   6. Return complete EvidenceAnchorBindingEntity
 *
 * No circular hash binding:
 *   - bindingId derived from pre-ID canonical (which excludes bindingId)
 *   - sha256/sha3_256 derived from full canonical (which excludes hashes)
 *   - Hashes appended AFTER computation
 *
 * Async because hash computation uses crypto.subtle.digest.
 * Deterministic — same input always produces same output.
 */
export async function buildEvidenceAnchorBinding(
  input: EvidenceAnchorBindingInput
): Promise<EvidenceAnchorBindingEntity> {
  // Step 1: Compute domain-separated anchor leaf hash
  const anchorLeafHash = await computeAnchorLeafHash(input.packetId);

  // Step 2: Canonicalize pre-ID form
  const preIdCanonical = canonicalizeBindingPreId(input, anchorLeafHash);

  // Step 3: Derive bindingId
  const bindingId = await computeTextSHA256(preIdCanonical);

  // Step 4: Canonicalize full form
  const fullCanonical = canonicalizeBindingFull(bindingId, input, anchorLeafHash);

  // Step 5: Compute dual-hash
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  // Step 6: Return complete entity
  return {
    bindingId,
    tenantId: input.tenantId,
    packetId: input.packetId,
    packetSha256: input.packetSha256,
    anchorLeafHash,
    anchorRootHash: input.anchorRootHash,
    anchorId: input.anchorId,
    integrationHash: input.integrationHash,
    signatureHash: input.signatureHash,
    generatedTimestamp: input.generatedTimestamp,
    description: input.description,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Evidence Anchor Binding — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify an evidence anchor binding by recomputing all hashes.
 *
 * Recomputes:
 *   1. anchorLeafHash from packetId (SHA-256("00" + packetId))
 *   2. bindingId from pre-ID canonical
 *   3. sha256 from full canonical
 *   4. sha3_256 from full canonical
 *
 * Also validates:
 *   - integrationLookup[integrationHash] === anchorId (not just existence)
 *   - signatureLookup[signatureHash] === anchorId (not just existence)
 *
 * Binary only. No partial pass.
 * Async because SHA-256 uses crypto.subtle.digest.
 * Deterministic — same input always produces same output.
 */
export async function verifyEvidenceAnchorBinding(
  binding: EvidenceAnchorBindingEntity,
  integrationLookup: AnchorIntegrationLookup,
  signatureLookup: SignatureLookup
): Promise<EvidenceAnchorBindingVerificationResult> {
  // Recompute anchorLeafHash
  const recomputedLeafHash = await computeAnchorLeafHash(binding.packetId);
  const anchorLeafHashMatch = binding.anchorLeafHash === recomputedLeafHash;

  // Reconstruct input for canonical forms
  const inputForCanonical: EvidenceAnchorBindingInput = {
    tenantId: binding.tenantId,
    packetId: binding.packetId,
    packetSha256: binding.packetSha256,
    anchorRootHash: binding.anchorRootHash,
    anchorId: binding.anchorId,
    integrationHash: binding.integrationHash,
    signatureHash: binding.signatureHash,
    generatedTimestamp: binding.generatedTimestamp,
    description: binding.description,
  };

  // Recompute bindingId
  const preIdCanonical = canonicalizeBindingPreId(inputForCanonical, binding.anchorLeafHash);
  const recomputedBindingId = await computeTextSHA256(preIdCanonical);
  const bindingIdMatch = binding.bindingId === recomputedBindingId;

  // Recompute dual-hash
  const fullCanonical = canonicalizeBindingFull(binding.bindingId, inputForCanonical, binding.anchorLeafHash);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3_256 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = binding.sha256 === recomputedSha256;
  const sha3_256Match = binding.sha3_256 === recomputedSha3_256;

  // Validate integrationHash maps to binding's anchorId (not just existence)
  const integrationLookupValue = integrationLookup.get(binding.integrationHash);
  const integrationHashMatch = integrationLookupValue === binding.anchorId;

  // Validate signatureHash maps to binding's anchorId (not just existence)
  const signatureLookupValue = signatureLookup.get(binding.signatureHash);
  const signatureHashMatch = signatureLookupValue === binding.anchorId;

  const allPass =
    anchorLeafHashMatch &&
    bindingIdMatch &&
    sha256Match &&
    sha3_256Match &&
    integrationHashMatch &&
    signatureHashMatch;

  return {
    anchorLeafHashMatch: anchorLeafHashMatch ? 'PASS' : 'FAIL',
    bindingIdMatch: bindingIdMatch ? 'PASS' : 'FAIL',
    sha256Match: sha256Match ? 'PASS' : 'FAIL',
    sha3_256Match: sha3_256Match ? 'PASS' : 'FAIL',
    integrationHashMatch: integrationHashMatch ? 'PASS' : 'FAIL',
    signatureHashMatch: signatureHashMatch ? 'PASS' : 'FAIL',
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}

// ---------------------------------------------------------------------------
// CI Enforcement Hook — Binary PASS/FAIL Build Gate
// ---------------------------------------------------------------------------

/**
 * CI enforcement hook for evidence anchor binding integrity.
 *
 * Binary PASS/FAIL only.
 * If FAIL, build MUST be blocked.
 * No soft pass. No warning-only mode. No bypass.
 *
 * Async because verification recomputes hashes.
 * Deterministic — same inputs always produce same output.
 */
export async function enforceEvidenceAnchorBindingIntegrity(
  binding: EvidenceAnchorBindingEntity,
  integrationLookup: AnchorIntegrationLookup,
  signatureLookup: SignatureLookup
): Promise<CIEvidenceAnchorBindingEnforcementResult> {
  const verification = await verifyEvidenceAnchorBinding(
    binding,
    integrationLookup,
    signatureLookup
  );

  return {
    result: verification.overallResult,
    bindingIdValid: verification.bindingIdMatch === 'PASS',
    anchorLeafHashValid: verification.anchorLeafHashMatch === 'PASS',
    sha256Valid: verification.sha256Match === 'PASS',
    sha3_256Valid: verification.sha3_256Match === 'PASS',
    integrationHashValid: verification.integrationHashMatch === 'PASS',
    signatureHashValid: verification.signatureHashMatch === 'PASS',
  };
}
