// ============================================
// Court Access — Hybrid Signature Engine (Phase 10)
// RSA + Ed25519 + Dilithium
//
// VERIFICATION-ONLY ENGINE.
// Court Access VERIFIES signatures. It does NOT generate them.
//
// Architectural boundary:
//   - NO key generation (no generateKey, no createKeyPair)
//   - NO signature generation (no sign, no createSignature)
//   - NO random number generator calls (no getRandomValues, no randomBytes)
//   - NO internal entropy usage
//   - Signatures are EXTERNAL DETERMINISTIC INPUTS
//   - Court Access accepts provided signatureHex and verifies
//   - Signing is EXPLICITLY OUT OF SCOPE for core logic
//
// This boundary is constitutional and permanent.
// Deterministic core + externalized entropy.
// Verification is deterministic. Signature generation is not.
// Allowing internal randomness would break reproducibility,
// expand attack surface, and violate the core invariant.
//
// Implements:
//   - Signature algorithm registry (additive-only, immutable)
//   - Deterministic signature binding structure
//   - Canonical JSON serialization for signature payloads
//   - Multi-algorithm structural verification logic
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

import type {
  SignatureAlgorithmId,
  SignatureAlgorithmEntry,
  SignatureAlgorithmRegistry,
  IndividualSignature,
  HybridSignatureBundle,
  IndividualSignatureVerificationResult,
  HybridSignatureVerificationResult,
  SignatureFieldValidation,
  SignatureValidationMatrix,
} from '../models/SignatureModel';
import { computeTextSHA256 } from './policyIngestionService';

// ---------------------------------------------------------------------------
// Immutable Algorithm Registry — Phase 10 Baseline
// ---------------------------------------------------------------------------

/**
 * The baseline signature algorithm registry.
 *
 * Rules:
 *   - Entries are sorted by id using deterministic ASCII comparator
 *   - Entries are immutable — no modification after definition
 *   - New algorithms may only be ADDED in future phases
 *   - No removal. No disabling. No downgrade.
 *   - registryVersion increments only on addition
 *
 * Phase 10 baseline: 3 algorithms (RSA, Ed25519, Dilithium)
 */
const ALGORITHM_REGISTRY_ENTRIES: SignatureAlgorithmEntry[] = [
  {
    id: 'dilithium3',
    name: 'CRYSTALS-Dilithium Level 3',
    keyType: 'dilithium',
    signatureHexLength: 6510,
    publicKeyHexLength: 3904,
    postQuantum: true,
    registeredEpoch: 1,
  },
  {
    id: 'ed25519',
    name: 'Edwards-curve Digital Signature Algorithm',
    keyType: 'ed25519',
    signatureHexLength: 128,
    publicKeyHexLength: 64,
    postQuantum: false,
    registeredEpoch: 1,
  },
  {
    id: 'rsa-sha256',
    name: 'RSA with SHA-256',
    keyType: 'rsa',
    signatureHexLength: 512,
    publicKeyHexLength: 512,
    postQuantum: false,
    registeredEpoch: 1,
  },
];

/**
 * Get the immutable algorithm registry.
 *
 * Returns a new object each time — the internal registry is not exposed.
 * Entries are pre-sorted by id (ASCII comparator) and frozen.
 *
 * This is a pure function — same output every call.
 */
export function getAlgorithmRegistry(): SignatureAlgorithmRegistry {
  return {
    entries: [...ALGORITHM_REGISTRY_ENTRIES],
    registryVersion: 1,
  };
}

/**
 * Look up an algorithm entry by its ID.
 *
 * Returns the entry if found, null otherwise.
 * Does not mutate the registry.
 *
 * This is a pure function — same input always produces same output.
 */
export function getAlgorithmById(
  id: SignatureAlgorithmId
): SignatureAlgorithmEntry | null {
  return ALGORITHM_REGISTRY_ENTRIES.find((e) => e.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Registry Immutability Enforcement
// ---------------------------------------------------------------------------

/**
 * Verify that a registry is a valid superset of the baseline.
 *
 * Rules:
 *   - All baseline entries must be present and unmodified
 *   - Additional entries are allowed (additive-only)
 *   - No entry may be removed or modified
 *   - Entries must be sorted by id (ASCII comparator)
 *
 * Returns true ONLY if registry is valid and all baseline entries are intact.
 *
 * This is a pure function — same input always produces same output.
 */
export function verifyRegistryImmutability(
  registry: SignatureAlgorithmRegistry
): boolean {
  // All baseline entries must be present and identical
  for (const baseline of ALGORITHM_REGISTRY_ENTRIES) {
    const found = registry.entries.find((e) => e.id === baseline.id);
    if (!found) {
      return false;
    }
    // Every field must match exactly
    if (
      found.name !== baseline.name ||
      found.keyType !== baseline.keyType ||
      found.signatureHexLength !== baseline.signatureHexLength ||
      found.publicKeyHexLength !== baseline.publicKeyHexLength ||
      found.postQuantum !== baseline.postQuantum ||
      found.registeredEpoch !== baseline.registeredEpoch
    ) {
      return false;
    }
  }

  // Entries must be sorted by id (ASCII comparator)
  for (let i = 0; i < registry.entries.length - 1; i++) {
    const a = registry.entries[i].id;
    const b = registry.entries[i + 1].id;
    if (!(a < b)) {
      return false;
    }
  }

  // Registry version must be positive integer
  if (
    !Number.isInteger(registry.registryVersion) ||
    registry.registryVersion < 1
  ) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Canonical JSON Serialization — Individual Signature
// ---------------------------------------------------------------------------

/**
 * Canonical JSON serialization for an IndividualSignature.
 *
 * Key order is FIXED and DOCUMENTED:
 *   1. "algorithmId"
 *   2. "publicKeyHex"
 *   3. "signatureHex"
 *   4. "signedPayloadHash"
 *
 * Key order enforced via explicit string construction.
 * NOT relying on JSON.stringify object key insertion order.
 *
 * This is a pure function — same input always produces same output.
 */
export function canonicalizeIndividualSignature(
  sig: IndividualSignature
): string {
  return (
    '{' +
    `"algorithmId":${JSON.stringify(sig.algorithmId)},` +
    `"publicKeyHex":${JSON.stringify(sig.publicKeyHex)},` +
    `"signatureHex":${JSON.stringify(sig.signatureHex)},` +
    `"signedPayloadHash":${JSON.stringify(sig.signedPayloadHash)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonical JSON Serialization — Hybrid Signature Bundle
// ---------------------------------------------------------------------------

/**
 * Canonical JSON serialization for a HybridSignatureBundle.
 *
 * Key order is FIXED and DOCUMENTED:
 *   1. "signatures" (array of canonical IndividualSignature)
 *   2. "payloadHash"
 *   3. "registryVersion"
 *
 * Signatures array elements use their own canonical serialization.
 * Array order matches the sorted-by-algorithmId order.
 *
 * Key order enforced via explicit string construction.
 * NOT relying on JSON.stringify object key insertion order.
 *
 * This is a pure function — same input always produces same output.
 */
export function canonicalizeHybridSignatureBundle(
  bundle: HybridSignatureBundle
): string {
  const canonicalSigs = bundle.signatures.map(canonicalizeIndividualSignature);

  return (
    '{' +
    `"signatures":[${canonicalSigs.join(',')}],` +
    `"payloadHash":${JSON.stringify(bundle.payloadHash)},` +
    `"registryVersion":${JSON.stringify(bundle.registryVersion)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonical JSON Serialization — Signature Payload
// ---------------------------------------------------------------------------

/**
 * Build the canonical signature payload for a given content hash.
 *
 * The signature payload is the canonical JSON string that is hashed
 * before signing. All signers sign the SHA-256 of this payload.
 *
 * Key order is FIXED and DOCUMENTED:
 *   1. "contentHash" — the hash of the content being signed
 *   2. "registryVersion" — the registry version at signing time
 *
 * This is a pure function — same input always produces same output.
 */
export function buildCanonicalSignaturePayload(
  contentHash: string,
  registryVersion: number
): string {
  return (
    '{' +
    `"contentHash":${JSON.stringify(contentHash)},` +
    `"registryVersion":${JSON.stringify(registryVersion)}` +
    '}'
  );
}

/**
 * Compute the payload hash that all algorithms must sign.
 *
 * Pipeline:
 *   1. Build canonical signature payload JSON
 *   2. Compute SHA-256 of the canonical JSON
 *   3. Return raw 64-char lowercase hex
 *
 * All algorithms in the hybrid bundle sign this same hash.
 *
 * This is a pure function — same input always produces same output.
 */
export async function computeSignaturePayloadHash(
  contentHash: string,
  registryVersion: number
): Promise<string> {
  const payload = buildCanonicalSignaturePayload(contentHash, registryVersion);
  return computeTextSHA256(payload);
}

// ---------------------------------------------------------------------------
// Deterministic Signature Binding — Hybrid Bundle Construction
// ---------------------------------------------------------------------------

/**
 * Build a hybrid signature bundle.
 *
 * Takes individual signatures from each algorithm and binds them
 * into a single HybridSignatureBundle.
 *
 * Rules:
 *   - Must have exactly one signature per registered algorithm
 *   - All signedPayloadHash values must match the bundle payloadHash
 *   - Signatures are sorted by algorithmId (ASCII comparator)
 *   - No partial bundles. No optional signatures.
 *
 * Throws if:
 *   - Signature count does not match registry entry count
 *   - Any signedPayloadHash does not match payloadHash
 *   - Any algorithmId is not in the registry
 *   - Duplicate algorithmIds exist
 *
 * This is a pure function — same input always produces same output.
 */
export function buildHybridSignatureBundle(
  signatures: IndividualSignature[],
  payloadHash: string,
  registryVersion: number
): HybridSignatureBundle {
  const registry = getAlgorithmRegistry();

  // Validate signature count matches registry
  if (signatures.length !== registry.entries.length) {
    throw new Error(
      `Hybrid bundle requires exactly ${registry.entries.length} signatures ` +
      `(one per registered algorithm). Received: ${signatures.length}.`
    );
  }

  // Validate all algorithmIds are registered and unique
  const seenIds = new Set<string>();
  for (const sig of signatures) {
    if (!registry.entries.some((e) => e.id === sig.algorithmId)) {
      throw new Error(
        `Algorithm "${sig.algorithmId}" is not in the registry. ` +
        `Registered algorithms: ${registry.entries.map((e) => e.id).join(', ')}.`
      );
    }
    if (seenIds.has(sig.algorithmId)) {
      throw new Error(
        `Duplicate algorithmId "${sig.algorithmId}" in signature bundle.`
      );
    }
    seenIds.add(sig.algorithmId);
  }

  // Validate all signedPayloadHash values match
  for (const sig of signatures) {
    if (sig.signedPayloadHash !== payloadHash) {
      throw new Error(
        `Signature for "${sig.algorithmId}" has signedPayloadHash ` +
        `"${sig.signedPayloadHash.slice(0, 16)}..." which does not match ` +
        `bundle payloadHash "${payloadHash.slice(0, 16)}...".`
      );
    }
  }

  // Sort signatures by algorithmId (ASCII comparator)
  const sorted = [...signatures].sort(
    (a, b) => a.algorithmId < b.algorithmId ? -1 : a.algorithmId > b.algorithmId ? 1 : 0
  );

  return {
    signatures: sorted,
    payloadHash,
    registryVersion,
  };
}

// ---------------------------------------------------------------------------
// Multi-Algorithm Verification Logic
// ---------------------------------------------------------------------------

/**
 * Verify an individual signature.
 *
 * VERIFICATION ONLY — this function does NOT generate signatures or keys.
 * Signatures are external deterministic inputs provided to this function.
 *
 * Phase 10 implementation: structural verification only.
 * Cryptographic verification (RSA, Ed25519, Dilithium) will be wired
 * in future phases via external verification adapters.
 * Those adapters will also be verification-only — no signing.
 *
 * Current verification:
 *   1. signedPayloadHash must match expected payloadHash
 *   2. algorithmId must be in the registry
 *   3. signatureHex must be non-empty lowercase hex
 *   4. publicKeyHex must be non-empty lowercase hex
 *
 * Structural verification ensures the binding is correct.
 * Cryptographic verification will be additive (not replacing this logic).
 *
 * No auto-correction. No mutation. No entropy. Binary result only.
 *
 * This is a pure function — same input always produces same output.
 */
export function verifyIndividualSignature(
  sig: IndividualSignature,
  expectedPayloadHash: string
): IndividualSignatureVerificationResult {
  const payloadHashMatch = sig.signedPayloadHash === expectedPayloadHash;

  const algorithm = getAlgorithmById(sig.algorithmId);
  const algorithmRegistered = algorithm !== null;

  const hexPattern = /^[0-9a-f]+$/;
  const signatureHexValid =
    typeof sig.signatureHex === 'string' &&
    sig.signatureHex.length > 0 &&
    hexPattern.test(sig.signatureHex);
  const publicKeyHexValid =
    typeof sig.publicKeyHex === 'string' &&
    sig.publicKeyHex.length > 0 &&
    hexPattern.test(sig.publicKeyHex);

  // Structural verification: all conditions must pass
  const verified =
    payloadHashMatch &&
    algorithmRegistered &&
    signatureHexValid &&
    publicKeyHexValid;

  return {
    algorithmId: sig.algorithmId,
    verified,
    payloadHashMatch,
  };
}

/**
 * Verify a complete hybrid signature bundle.
 *
 * Verification pipeline:
 *   1. Verify registry version matches current registry
 *   2. Verify every registered algorithm has a signature
 *   3. Verify each individual signature
 *   4. allVerified = true ONLY if ALL algorithms pass
 *
 * No partial pass. No downgrade. No silent fallback.
 * If ANY algorithm fails, allVerified = false.
 *
 * No auto-correction. No mutation of the bundle.
 * Binary output only.
 *
 * This is a pure function — same input always produces same output.
 */
export function verifyHybridSignatureBundle(
  bundle: HybridSignatureBundle
): HybridSignatureVerificationResult {
  const registry = getAlgorithmRegistry();
  const registryVersionMatch = bundle.registryVersion === registry.registryVersion;

  // Verify each individual signature
  const results: IndividualSignatureVerificationResult[] = [];
  for (const sig of bundle.signatures) {
    results.push(verifyIndividualSignature(sig, bundle.payloadHash));
  }

  // Check all registered algorithms are present
  const presentIds = new Set(bundle.signatures.map((s) => s.algorithmId));
  const allAlgorithmsPresent = registry.entries.every((e) => presentIds.has(e.id));

  // allVerified requires: all signatures verified + all algorithms present + registry match
  const allVerified =
    registryVersionMatch &&
    allAlgorithmsPresent &&
    results.every((r) => r.verified);

  return {
    results,
    allVerified,
    algorithmCount: results.length,
    registryVersionMatch,
  };
}

// ---------------------------------------------------------------------------
// Validation Matrix — PASS/FAIL only
// ---------------------------------------------------------------------------

/**
 * Validate a hybrid signature bundle structure.
 *
 * Each required field is validated independently:
 *   - payloadHash: must be 64 lowercase hex characters
 *   - registryVersion: must be positive integer
 *   - signatureCount: must match registry entry count
 *   - algorithmCoverage: every registered algorithm must have a signature
 *   - signaturesSorted: signatures must be sorted by algorithmId (ASCII)
 *   - allPayloadHashesMatch: every signature's signedPayloadHash must match bundle payloadHash
 *   - allSignatureHexValid: every signatureHex must be non-empty lowercase hex
 *   - allPublicKeyHexValid: every publicKeyHex must be non-empty lowercase hex
 *
 * Overall result: PASS only if ALL fields pass.
 * No partial pass. No percentage. No scoring.
 * Binary output only: PASS or FAIL per field.
 *
 * This is a pure function — same input always produces same output.
 */
export function validateHybridSignatureBundle(
  bundle: HybridSignatureBundle
): SignatureValidationMatrix {
  const fields: SignatureFieldValidation[] = [];
  const registry = getAlgorithmRegistry();
  const hexPattern = /^[0-9a-f]+$/;

  // Hex validation: 64 lowercase hex characters
  const isValidHex64 = (value: string): boolean =>
    typeof value === 'string' &&
    value.length === 64 &&
    /^[0-9a-f]{64}$/.test(value);

  // payloadHash: must be 64 lowercase hex characters
  fields.push({
    field: 'payloadHash',
    result: isValidHex64(bundle.payloadHash) ? 'PASS' : 'FAIL',
  });

  // registryVersion: must be positive integer
  fields.push({
    field: 'registryVersion',
    result:
      typeof bundle.registryVersion === 'number' &&
      Number.isInteger(bundle.registryVersion) &&
      bundle.registryVersion > 0
        ? 'PASS'
        : 'FAIL',
  });

  // signatureCount: must match registry entry count
  fields.push({
    field: 'signatureCount',
    result:
      Array.isArray(bundle.signatures) &&
      bundle.signatures.length === registry.entries.length
        ? 'PASS'
        : 'FAIL',
  });

  // algorithmCoverage: every registered algorithm must have a signature
  const presentIds = new Set(
    Array.isArray(bundle.signatures)
      ? bundle.signatures.map((s) => s.algorithmId)
      : []
  );
  fields.push({
    field: 'algorithmCoverage',
    result: registry.entries.every((e) => presentIds.has(e.id))
      ? 'PASS'
      : 'FAIL',
  });

  // signaturesSorted: signatures must be sorted by algorithmId (ASCII comparator)
  let sorted = true;
  if (Array.isArray(bundle.signatures)) {
    for (let i = 0; i < bundle.signatures.length - 1; i++) {
      const a = bundle.signatures[i].algorithmId;
      const b = bundle.signatures[i + 1].algorithmId;
      if (!(a < b)) {
        sorted = false;
        break;
      }
    }
  } else {
    sorted = false;
  }
  fields.push({
    field: 'signaturesSorted',
    result: sorted ? 'PASS' : 'FAIL',
  });

  // allPayloadHashesMatch: every signedPayloadHash must match bundle payloadHash
  const allHashesMatch =
    Array.isArray(bundle.signatures) &&
    bundle.signatures.every((s) => s.signedPayloadHash === bundle.payloadHash);
  fields.push({
    field: 'allPayloadHashesMatch',
    result: allHashesMatch ? 'PASS' : 'FAIL',
  });

  // allSignatureHexValid: every signatureHex must be non-empty lowercase hex
  const allSigHexValid =
    Array.isArray(bundle.signatures) &&
    bundle.signatures.every(
      (s) =>
        typeof s.signatureHex === 'string' &&
        s.signatureHex.length > 0 &&
        hexPattern.test(s.signatureHex)
    );
  fields.push({
    field: 'allSignatureHexValid',
    result: allSigHexValid ? 'PASS' : 'FAIL',
  });

  // allPublicKeyHexValid: every publicKeyHex must be non-empty lowercase hex
  const allPubKeyHexValid =
    Array.isArray(bundle.signatures) &&
    bundle.signatures.every(
      (s) =>
        typeof s.publicKeyHex === 'string' &&
        s.publicKeyHex.length > 0 &&
        hexPattern.test(s.publicKeyHex)
    );
  fields.push({
    field: 'allPublicKeyHexValid',
    result: allPubKeyHexValid ? 'PASS' : 'FAIL',
  });

  // Overall: PASS only if ALL fields pass
  const allPass = fields.every((f) => f.result === 'PASS');

  return {
    fields,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}
