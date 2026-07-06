// ============================================
// Court Access — Anchor Integration Engine (Phase 11)
// Daily Anchor Chain Integration with CAPS + Hybrid Signatures
//
// Implements:
//   - Cross-layer hash linkage (Export → CAPS → Merkle → Anchor → Signature)
//   - Deterministic binding construction
//   - Cross-layer consistency verification
//   - Replay validation logic
//   - Canonical JSON serialization
//   - Validation matrix (PASS/FAIL only)
//
// Dependency direction (no circular dependencies):
//   Export → CAPS → Anchor → Signature
//   Each layer references only layers below it.
//
// VERIFICATION-ONLY ENGINE.
// No key generation. No signing. No entropy.
// Signatures are external deterministic inputs.
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
//   - No mutation of prior records
//   - No randomness
//   - No optional security downgrade paths
//   - No circular dependencies
//   - Additive-only cryptographic posture
//   - Append-only anchor discipline
//   - Raw lowercase hex only (no prefix encoding)
//   - ASCII comparator only (no localeCompare)
//   - No Date object usage in core logic
// ============================================

import type {
  AnchorIntegratedProofRecord,
  AnchorIntegrationInput,
  CrossLayerConsistencyResult,
  ReplayValidationResult,
  IntegrationFieldValidation,
  IntegrationValidationMatrix,
} from '../models/AnchorIntegrationModel';
import type { CAPSProofEnvelope } from '../models/CAPSModel';
import type { DailyAnchorEntity } from '../models/AnchorModel';
import type { HybridSignatureBundle } from '../models/SignatureModel';
import { verifyCAPSIntegrity } from './capsEngine';
import { verifyAnchorIntegrity } from './anchorEngine';
import { verifyHybridSignatureBundle } from './signatureEngine';

// ---------------------------------------------------------------------------
// Cross-Layer Consistency Verification
// ---------------------------------------------------------------------------

/**
 * Verify cross-layer hash consistency between CAPS, Anchor, and Signature.
 *
 * Cross-layer linkage rules (directed, no cycles):
 *   1. exportHashMatch: capsProof.sha256 === exportHash
 *      (Export binds to CAPS — the CAPS proof attests to the export)
 *   2. merkleRootMatch: capsProof.merkleRoot === anchor.merkleRoot
 *      (CAPS binds to Anchor — the proof references the daily Merkle root)
 *   3. immutableCoreMatch: capsProof.immutableCoreHash === anchor.immutableCoreHash
 *      (Shared system-wide immutable reference)
 *   4. scopeHashMatch: capsProof.scopeHash === anchor.scopeHash
 *      (Shared scope binding)
 *   5. epochMatch: capsProof.anchorEpoch === anchor.epoch
 *      (Shared epoch binding)
 *   6. signaturePayloadMatch: signatureBundle.payloadHash === capsCanonicalHash
 *      (Signature binds to CAPS — the signature attests to the CAPS proof)
 *   7. anchorDateMatch: anchorDate === anchor.date
 *      (Date consistency)
 *
 * allConsistent = true ONLY if ALL linkages pass.
 * No partial pass. Binary only.
 *
 * This is a pure function — same input always produces same output.
 */
export function verifyCrossLayerConsistency(
  capsProof: CAPSProofEnvelope,
  anchor: DailyAnchorEntity,
  signatureBundle: HybridSignatureBundle,
  exportHash: string,
  capsCanonicalHash: string,
  anchorDate: string
): CrossLayerConsistencyResult {
  const exportHashMatch = capsProof.sha256 === exportHash;
  const merkleRootMatch = capsProof.merkleRoot === anchor.merkleRoot;
  const immutableCoreMatch = capsProof.immutableCoreHash === anchor.immutableCoreHash;
  const scopeHashMatch = capsProof.scopeHash === anchor.scopeHash;
  const epochMatch = capsProof.anchorEpoch === anchor.epoch;
  const signaturePayloadMatch = signatureBundle.payloadHash === capsCanonicalHash;
  const anchorDateMatch = anchorDate === anchor.date;

  const allConsistent =
    exportHashMatch &&
    merkleRootMatch &&
    immutableCoreMatch &&
    scopeHashMatch &&
    epochMatch &&
    signaturePayloadMatch &&
    anchorDateMatch;

  return {
    exportHashMatch,
    merkleRootMatch,
    immutableCoreMatch,
    scopeHashMatch,
    epochMatch,
    signaturePayloadMatch,
    anchorDateMatch,
    allConsistent,
  };
}

// ---------------------------------------------------------------------------
// Deterministic Binding Construction
// ---------------------------------------------------------------------------

/**
 * Build an anchor-integrated proof record.
 *
 * Validates cross-layer consistency and assembles the record.
 *
 * Throws if any cross-layer linkage fails.
 * No mutation of input objects. Returns a new record.
 *
 * This is a pure function — same input always produces same output.
 */
export function buildAnchorIntegratedProofRecord(
  input: AnchorIntegrationInput
): AnchorIntegratedProofRecord {
  // Verify cross-layer consistency before assembly
  const consistency = verifyCrossLayerConsistency(
    input.capsProof,
    input.anchor,
    input.signatureBundle,
    input.exportHash,
    input.capsCanonicalHash,
    input.anchorDate
  );

  if (!consistency.allConsistent) {
    // Build detailed error listing which linkages failed
    const failures: string[] = [];
    if (!consistency.exportHashMatch) failures.push('exportHash !== capsProof.sha256');
    if (!consistency.merkleRootMatch) failures.push('capsProof.merkleRoot !== anchor.merkleRoot');
    if (!consistency.immutableCoreMatch) failures.push('capsProof.immutableCoreHash !== anchor.immutableCoreHash');
    if (!consistency.scopeHashMatch) failures.push('capsProof.scopeHash !== anchor.scopeHash');
    if (!consistency.epochMatch) failures.push('capsProof.anchorEpoch !== anchor.epoch');
    if (!consistency.signaturePayloadMatch) failures.push('signatureBundle.payloadHash !== capsCanonicalHash');
    if (!consistency.anchorDateMatch) failures.push('anchorDate !== anchor.date');

    throw new Error(
      `Cross-layer consistency check failed. ` +
      `Failures: ${failures.join('; ')}.`
    );
  }

  return {
    capsProof: input.capsProof,
    anchor: input.anchor,
    signatureBundle: input.signatureBundle,
    exportHash: input.exportHash,
    merkleLeafHash: input.merkleLeafHash,
    anchorDate: input.anchorDate,
    recordEpoch: input.anchor.epoch,
  };
}

// ---------------------------------------------------------------------------
// Canonical JSON Serialization — Anchor-Integrated Proof Record
// ---------------------------------------------------------------------------

/**
 * Canonical JSON serialization for an AnchorIntegratedProofRecord.
 *
 * Key order is FIXED and DOCUMENTED:
 *   1. "exportHash"
 *   2. "merkleLeafHash"
 *   3. "anchorDate"
 *   4. "recordEpoch"
 *   5. "capsVersion"
 *   6. "capsSha256"
 *   7. "capsSha3_256"
 *   8. "capsScopeHash"
 *   9. "capsImmutableCoreHash"
 *  10. "capsMerkleRoot"
 *  11. "capsAnchorEpoch"
 *  12. "anchorId"
 *  13. "anchorMerkleRoot"
 *  14. "anchorScopeHash"
 *  15. "anchorImmutableCoreHash"
 *  16. "anchorEpoch"
 *  17. "signaturePayloadHash"
 *  18. "signatureRegistryVersion"
 *  19. "signatureAlgorithmCount"
 *
 * Flattened structure for canonical minimalism.
 * No nested objects — all fields at top level.
 * Key order enforced via explicit string construction.
 * NOT relying on JSON.stringify object key insertion order.
 *
 * This is a pure function — same input always produces same output.
 */
export function canonicalizeAnchorIntegratedRecord(
  record: AnchorIntegratedProofRecord
): string {
  return (
    '{' +
    `"exportHash":${JSON.stringify(record.exportHash)},` +
    `"merkleLeafHash":${JSON.stringify(record.merkleLeafHash)},` +
    `"anchorDate":${JSON.stringify(record.anchorDate)},` +
    `"recordEpoch":${JSON.stringify(record.recordEpoch)},` +
    `"capsVersion":${JSON.stringify(record.capsProof.version)},` +
    `"capsSha256":${JSON.stringify(record.capsProof.sha256)},` +
    `"capsSha3_256":${JSON.stringify(record.capsProof.sha3_256)},` +
    `"capsScopeHash":${JSON.stringify(record.capsProof.scopeHash)},` +
    `"capsImmutableCoreHash":${JSON.stringify(record.capsProof.immutableCoreHash)},` +
    `"capsMerkleRoot":${JSON.stringify(record.capsProof.merkleRoot)},` +
    `"capsAnchorEpoch":${JSON.stringify(record.capsProof.anchorEpoch)},` +
    `"anchorId":${JSON.stringify(record.anchor.id)},` +
    `"anchorMerkleRoot":${JSON.stringify(record.anchor.merkleRoot)},` +
    `"anchorScopeHash":${JSON.stringify(record.anchor.scopeHash)},` +
    `"anchorImmutableCoreHash":${JSON.stringify(record.anchor.immutableCoreHash)},` +
    `"anchorEpoch":${JSON.stringify(record.anchor.epoch)},` +
    `"signaturePayloadHash":${JSON.stringify(record.signatureBundle.payloadHash)},` +
    `"signatureRegistryVersion":${JSON.stringify(record.signatureBundle.registryVersion)},` +
    `"signatureAlgorithmCount":${JSON.stringify(record.signatureBundle.signatures.length)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Replay Validation Logic
// ---------------------------------------------------------------------------

/**
 * Perform replay validation on an anchor-integrated proof record.
 *
 * Replay validation reconstructs the trust chain from the record
 * and verifies that every hash, binding, and linkage is reproducible.
 *
 * Validation pipeline:
 *   1. Verify cross-layer consistency (all 7 linkages)
 *   2. Verify CAPS proof integrity (dual-hash of canonical CAPS JSON)
 *   3. Verify anchor integrity (dual-hash of canonical anchor JSON)
 *   4. Verify hybrid signature bundle (all algorithms, registry match)
 *
 * replayValid = true ONLY if ALL checks pass.
 * No partial pass. No scoring. Binary only.
 *
 * This is a pure function — same input always produces same output.
 */
export async function performReplayValidation(
  record: AnchorIntegratedProofRecord,
  capsCanonicalHash: string
): Promise<ReplayValidationResult> {
  // Step 1: Cross-layer consistency
  const crossLayerConsistency = verifyCrossLayerConsistency(
    record.capsProof,
    record.anchor,
    record.signatureBundle,
    record.exportHash,
    capsCanonicalHash,
    record.anchorDate
  );

  // Step 2: CAPS integrity (dual-hash verification)
  // Recompute dual-hash of canonical CAPS proof JSON and compare to stored hashes.
  // The reference hashes are the proof's own sha256 and sha3_256 fields.
  const capsIntegrity = await verifyCAPSIntegrity(
    record.capsProof,
    record.capsProof.sha256,
    record.capsProof.sha3_256
  );
  const capsIntegrityVerified = capsIntegrity.verified;

  // Step 3: Anchor integrity (dual-hash verification)
  const anchorIntegrity = await verifyAnchorIntegrity(record.anchor);
  const anchorIntegrityVerified = anchorIntegrity.verified;

  // Step 4: Hybrid signature verification
  const signatureResult = verifyHybridSignatureBundle(record.signatureBundle);
  const signatureVerified = signatureResult.allVerified;

  // replayValid requires ALL checks to pass
  const replayValid =
    crossLayerConsistency.allConsistent &&
    capsIntegrityVerified &&
    anchorIntegrityVerified &&
    signatureVerified;

  return {
    crossLayerConsistency,
    capsIntegrityVerified,
    anchorIntegrityVerified,
    signatureVerified,
    replayValid,
  };
}

// ---------------------------------------------------------------------------
// Deterministic Reconstruction Rules
// ---------------------------------------------------------------------------

/**
 * Verify that a record can be deterministically reconstructed.
 *
 * Reconstruction rules:
 *   1. exportHash must match capsProof.sha256 (the export produces the CAPS input)
 *   2. capsProof fields must be self-consistent
 *   3. anchor fields must be self-consistent
 *   4. signature must bind to CAPS canonical hash
 *   5. All shared fields must be identical across layers
 *
 * Returns true ONLY if the record is fully reconstructible.
 * No partial result. Binary only.
 *
 * This is a pure function — same input always produces same output.
 */
export function verifyDeterministicReconstruction(
  record: AnchorIntegratedProofRecord,
  capsCanonicalHash: string
): boolean {
  // Rule 1: exportHash → CAPS binding
  if (record.capsProof.sha256 !== record.exportHash) return false;

  // Rule 2: CAPS self-consistency
  if (record.capsProof.version !== '1.0') return false;
  if (record.capsProof.nonInterpretiveDeclaration !== true) return false;

  // Rule 3: Anchor self-consistency
  if (record.anchor.date !== record.anchorDate) return false;
  if (record.anchor.epoch !== record.recordEpoch) return false;

  // Rule 4: Signature → CAPS binding
  if (record.signatureBundle.payloadHash !== capsCanonicalHash) return false;

  // Rule 5: Shared fields across layers
  if (record.capsProof.merkleRoot !== record.anchor.merkleRoot) return false;
  if (record.capsProof.immutableCoreHash !== record.anchor.immutableCoreHash) return false;
  if (record.capsProof.scopeHash !== record.anchor.scopeHash) return false;
  if (record.capsProof.anchorEpoch !== record.anchor.epoch) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Validation Matrix — PASS/FAIL only
// ---------------------------------------------------------------------------

/**
 * Validate an anchor-integrated proof record structure.
 *
 * Each required field is validated independently:
 *   - exportHash: must be 64 lowercase hex characters
 *   - merkleLeafHash: must be 64 lowercase hex characters
 *   - anchorDate: must be YYYY-MM-DD format
 *   - recordEpoch: must be positive integer
 *   - capsVersion: must be "1.0"
 *   - capsHashes: sha256 and sha3_256 must be 64 hex each
 *   - capsScopeHash: must be 64 lowercase hex characters
 *   - capsImmutableCoreHash: must be 64 lowercase hex characters
 *   - capsMerkleRoot: must be 64 lowercase hex characters
 *   - capsNonInterpretive: must be true
 *   - anchorId: must be non-empty string
 *   - anchorMerkleRoot: must be 64 lowercase hex characters
 *   - signaturePayloadHash: must be 64 lowercase hex characters
 *   - signatureRegistryVersion: must be positive integer
 *   - crossLayerExportHash: capsProof.sha256 must equal exportHash
 *   - crossLayerMerkleRoot: capsProof.merkleRoot must equal anchor.merkleRoot
 *   - crossLayerEpoch: capsProof.anchorEpoch must equal anchor.epoch
 *
 * Overall result: PASS only if ALL fields pass.
 * No partial pass. No percentage. No scoring.
 * Binary output only: PASS or FAIL per field.
 *
 * This is a pure function — same input always produces same output.
 */
export function validateAnchorIntegratedRecord(
  record: AnchorIntegratedProofRecord
): IntegrationValidationMatrix {
  const fields: IntegrationFieldValidation[] = [];

  // Hex validation: 64 lowercase hex characters
  const isValidHex64 = (value: string): boolean =>
    typeof value === 'string' &&
    value.length === 64 &&
    /^[0-9a-f]{64}$/.test(value);

  // Date format validation: YYYY-MM-DD
  const isValidDate = (value: string): boolean =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value);

  // --- Record-level fields ---

  fields.push({
    field: 'exportHash',
    result: isValidHex64(record.exportHash) ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'merkleLeafHash',
    result: isValidHex64(record.merkleLeafHash) ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'anchorDate',
    result: isValidDate(record.anchorDate) ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'recordEpoch',
    result:
      typeof record.recordEpoch === 'number' &&
      Number.isInteger(record.recordEpoch) &&
      record.recordEpoch > 0
        ? 'PASS'
        : 'FAIL',
  });

  // --- CAPS proof fields ---

  fields.push({
    field: 'capsVersion',
    result: record.capsProof.version === '1.0' ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'capsSha256',
    result: isValidHex64(record.capsProof.sha256) ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'capsSha3_256',
    result: isValidHex64(record.capsProof.sha3_256) ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'capsScopeHash',
    result: isValidHex64(record.capsProof.scopeHash) ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'capsImmutableCoreHash',
    result: isValidHex64(record.capsProof.immutableCoreHash) ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'capsMerkleRoot',
    result: isValidHex64(record.capsProof.merkleRoot) ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'capsNonInterpretive',
    result: record.capsProof.nonInterpretiveDeclaration === true ? 'PASS' : 'FAIL',
  });

  // --- Anchor fields ---

  fields.push({
    field: 'anchorId',
    result:
      typeof record.anchor.id === 'string' &&
      record.anchor.id.length > 0
        ? 'PASS'
        : 'FAIL',
  });

  fields.push({
    field: 'anchorMerkleRoot',
    result: isValidHex64(record.anchor.merkleRoot) ? 'PASS' : 'FAIL',
  });

  // --- Signature fields ---

  fields.push({
    field: 'signaturePayloadHash',
    result: isValidHex64(record.signatureBundle.payloadHash) ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'signatureRegistryVersion',
    result:
      typeof record.signatureBundle.registryVersion === 'number' &&
      Number.isInteger(record.signatureBundle.registryVersion) &&
      record.signatureBundle.registryVersion > 0
        ? 'PASS'
        : 'FAIL',
  });

  // --- Cross-layer consistency checks ---

  fields.push({
    field: 'crossLayerExportHash',
    result: record.capsProof.sha256 === record.exportHash ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'crossLayerMerkleRoot',
    result: record.capsProof.merkleRoot === record.anchor.merkleRoot ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'crossLayerEpoch',
    result: record.capsProof.anchorEpoch === record.anchor.epoch ? 'PASS' : 'FAIL',
  });

  // Overall: PASS only if ALL fields pass
  const allPass = fields.every((f) => f.result === 'PASS');

  return {
    fields,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}
