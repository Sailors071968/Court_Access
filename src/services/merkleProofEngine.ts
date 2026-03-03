// ============================================
// Court Access — Merkle Inclusion Proof Engine (Phase 9)
// Deterministic Merkle Inclusion Proofs
//
// Implements:
//   - Leaf hashing rules
//   - Deterministic proof path construction
//   - Left/right positional encoding
//   - Canonical JSON serialization
//   - Inclusion verification logic
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
//   - Raw lowercase hex only (no prefix encoding)
//   - ASCII comparator only (no localeCompare)
//   - No Date object usage
// ============================================

import type {
  MerkleProofStep,
  MerkleInclusionProof,
  MerkleInclusionVerificationResult,
  MerkleProofFieldValidation,
  MerkleProofValidationMatrix,
  MerkleTreeResult,
} from '../models/MerkleProofModel';
import { computeTextSHA256 } from './policyIngestionService';

// ---------------------------------------------------------------------------
// Leaf Hashing Rules
// ---------------------------------------------------------------------------

/**
 * Hash a leaf value for Merkle tree construction.
 *
 * Leaf hashing rule:
 *   - Input leaf is already a raw 64-char lowercase hex string
 *   - Leaf hash = SHA-256 of the raw hex string (treated as UTF-8 text)
 *   - This creates a domain separation between leaf hashes and internal node hashes
 *
 * Domain separation rationale:
 *   - Leaf: SHA-256(leafValue)
 *   - Internal node: SHA-256(leftChild + rightChild)
 *   - A leaf hash is always derived from a single 64-char input
 *   - An internal node hash is always derived from a 128-char input (two 64-char hashes)
 *   - This prevents second-preimage attacks where a leaf could be confused with an internal node
 *
 * This is a pure function — same input always produces same output.
 */
export async function hashLeaf(leafValue: string): Promise<string> {
  return computeTextSHA256(leafValue);
}

/**
 * Hash two child nodes to produce a parent node.
 *
 * Internal node hashing rule:
 *   - Concatenate left + right as literal string (no separator)
 *   - Hash the concatenation with SHA-256
 *   - Result is raw 64-char lowercase hex
 *
 * This matches the pair hashing in anchorEngine.buildMerkleRoot().
 *
 * This is a pure function — same input always produces same output.
 */
export async function hashPair(left: string, right: string): Promise<string> {
  return computeTextSHA256(left + right);
}

// ---------------------------------------------------------------------------
// Merkle Tree Construction with Proof Path Extraction
// ---------------------------------------------------------------------------

/**
 * Build a Merkle tree from leaf values and extract the root.
 *
 * Pipeline:
 *   1. Sort leaves via deterministic ASCII comparator
 *   2. Hash each leaf via hashLeaf()
 *   3. If odd number of hashed leaves, duplicate last leaf
 *   4. Pair leaves left/right deterministically (index 0+1, 2+3, ...)
 *   5. Hash each pair via hashPair()
 *   6. Repeat until single root remains
 *
 * Returns MerkleTreeResult with root and sorted leaves.
 *
 * NOTE: This function builds the tree using leaf hashing (domain separation).
 * The existing buildMerkleRoot in anchorEngine.ts hashes raw values directly.
 * Phase 9 introduces proper leaf hashing for inclusion proof correctness.
 *
 * This is a pure function — same input always produces same output.
 */
export async function buildMerkleTreeWithProofs(
  leafValues: string[]
): Promise<MerkleTreeResult> {
  // Step 1: Sort via deterministic ASCII comparator
  const sortedLeaves = [...leafValues].sort(
    (a, b) => a < b ? -1 : a > b ? 1 : 0
  );

  // Step 2: Hash each leaf
  const hashedLeaves: string[] = [];
  for (const leaf of sortedLeaves) {
    hashedLeaves.push(await hashLeaf(leaf));
  }

  // Handle empty input
  if (hashedLeaves.length === 0) {
    const emptyRoot = await computeTextSHA256('');
    return {
      merkleRoot: emptyRoot,
      sortedLeaves: [],
      leafCount: 0,
    };
  }

  // Build tree level by level
  let currentLevel = hashedLeaves;

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];

    // Step 3: If odd number, duplicate last
    if (currentLevel.length % 2 !== 0) {
      currentLevel = [...currentLevel, currentLevel[currentLevel.length - 1]];
    }

    // Step 4-5: Pair and hash
    for (let i = 0; i < currentLevel.length; i += 2) {
      const parent = await hashPair(currentLevel[i], currentLevel[i + 1]);
      nextLevel.push(parent);
    }

    currentLevel = nextLevel;
  }

  return {
    merkleRoot: currentLevel[0],
    sortedLeaves,
    leafCount: sortedLeaves.length,
  };
}

// ---------------------------------------------------------------------------
// Deterministic Proof Path Construction
// ---------------------------------------------------------------------------

/**
 * Build a Merkle inclusion proof for a specific leaf.
 *
 * Pipeline:
 *   1. Sort all leaves via deterministic ASCII comparator
 *   2. Find the target leaf's index in the sorted array
 *   3. Hash all leaves via hashLeaf()
 *   4. Walk the tree from leaf level to root, collecting sibling hashes
 *   5. At each level:
 *      a. If current index is even → sibling is at index+1 → position = 'right'
 *      b. If current index is odd → sibling is at index-1 → position = 'left'
 *   6. Handle odd-length levels by duplicating last node
 *   7. Return complete MerkleInclusionProof
 *
 * Left/right positional encoding rules:
 *   - position = 'left' means: sibling is concatenated BEFORE current hash
 *     → parentHash = SHA-256(sibling + current)
 *   - position = 'right' means: sibling is concatenated AFTER current hash
 *     → parentHash = SHA-256(current + sibling)
 *
 * Throws if targetLeaf is not found in the sorted leaf array.
 *
 * This is a pure function — same input always produces same output.
 */
export async function buildMerkleInclusionProof(
  allLeaves: string[],
  targetLeaf: string
): Promise<MerkleInclusionProof> {
  // Step 1: Sort via deterministic ASCII comparator
  const sortedLeaves = [...allLeaves].sort(
    (a, b) => a < b ? -1 : a > b ? 1 : 0
  );

  // Step 2: Find target leaf index
  const leafIndex = sortedLeaves.indexOf(targetLeaf);
  if (leafIndex === -1) {
    throw new Error(
      `Target leaf not found in leaf set. ` +
      `Leaf: "${targetLeaf.slice(0, 16)}..." is not present in the sorted leaf array. ` +
      `Total leaves: ${sortedLeaves.length}.`
    );
  }

  // Step 3: Hash all leaves
  const hashedLeaves: string[] = [];
  for (const leaf of sortedLeaves) {
    hashedLeaves.push(await hashLeaf(leaf));
  }

  // Step 4: Walk tree, collecting proof path
  const path: MerkleProofStep[] = [];
  let currentLevel = hashedLeaves;
  let currentIndex = leafIndex;

  while (currentLevel.length > 1) {
    // Step 6: Handle odd-length levels by duplicating last node
    if (currentLevel.length % 2 !== 0) {
      currentLevel = [...currentLevel, currentLevel[currentLevel.length - 1]];
    }

    // Step 5: Determine sibling position
    if (currentIndex % 2 === 0) {
      // Current is at even index → sibling is at currentIndex + 1 → right
      const siblingIndex = currentIndex + 1;
      path.push({
        hash: currentLevel[siblingIndex],
        position: 'right',
      });
    } else {
      // Current is at odd index → sibling is at currentIndex - 1 → left
      const siblingIndex = currentIndex - 1;
      path.push({
        hash: currentLevel[siblingIndex],
        position: 'left',
      });
    }

    // Build next level
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const parent = await hashPair(currentLevel[i], currentLevel[i + 1]);
      nextLevel.push(parent);
    }

    // Move up: parent index = floor(currentIndex / 2)
    currentIndex = Math.floor(currentIndex / 2);
    currentLevel = nextLevel;
  }

  // Step 7: Assemble proof
  return {
    leafHash: hashedLeaves[leafIndex],
    merkleRoot: currentLevel[0],
    path,
    leafIndex,
    totalLeaves: sortedLeaves.length,
  };
}

// ---------------------------------------------------------------------------
// Canonical JSON Serialization — Merkle Proof Step
// ---------------------------------------------------------------------------

/**
 * Canonical JSON serialization for a MerkleProofStep.
 *
 * Key order is FIXED and DOCUMENTED:
 *   1. "hash"
 *   2. "position"
 *
 * Key order enforced via explicit string construction.
 * NOT relying on JSON.stringify object key insertion order.
 *
 * This is a pure function — same input always produces same output.
 */
export function canonicalizeMerkleProofStep(step: MerkleProofStep): string {
  return (
    '{' +
    `"hash":${JSON.stringify(step.hash)},` +
    `"position":${JSON.stringify(step.position)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonical JSON Serialization — Merkle Inclusion Proof
// ---------------------------------------------------------------------------

/**
 * Canonical JSON serialization for a MerkleInclusionProof.
 *
 * Key order is FIXED and DOCUMENTED:
 *   1. "leafHash"
 *   2. "merkleRoot"
 *   3. "path" (array of canonical MerkleProofStep)
 *   4. "leafIndex"
 *   5. "totalLeaves"
 *
 * Key order enforced via explicit string construction.
 * NOT relying on JSON.stringify object key insertion order.
 * Path array elements use their own canonical serialization.
 *
 * This is a pure function — same input always produces same output.
 */
export function canonicalizeMerkleInclusionProof(
  proof: MerkleInclusionProof
): string {
  const canonicalPath = proof.path.map(canonicalizeMerkleProofStep);

  return (
    '{' +
    `"leafHash":${JSON.stringify(proof.leafHash)},` +
    `"merkleRoot":${JSON.stringify(proof.merkleRoot)},` +
    `"path":[${canonicalPath.join(',')}],` +
    `"leafIndex":${JSON.stringify(proof.leafIndex)},` +
    `"totalLeaves":${JSON.stringify(proof.totalLeaves)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Inclusion Verification Logic
// ---------------------------------------------------------------------------

/**
 * Verify a Merkle inclusion proof.
 *
 * Verification pipeline:
 *   1. Start with leafHash
 *   2. For each step in the proof path:
 *      a. If step.position === 'left': currentHash = SHA-256(step.hash + currentHash)
 *         (sibling is on the left, so it goes first)
 *      b. If step.position === 'right': currentHash = SHA-256(currentHash + step.hash)
 *         (sibling is on the right, so it goes second)
 *   3. Final currentHash is the computed root
 *   4. verified = true ONLY if computedRoot === proof.merkleRoot
 *
 * No auto-correction. No mutation of the proof. No partial result.
 * Binary output only: verified true or false.
 *
 * This is a pure function — same input always produces same output.
 */
export async function verifyMerkleInclusionProof(
  proof: MerkleInclusionProof
): Promise<MerkleInclusionVerificationResult> {
  let currentHash = proof.leafHash;

  for (const step of proof.path) {
    if (step.position === 'left') {
      // Sibling is on the left → sibling goes first
      currentHash = await hashPair(step.hash, currentHash);
    } else {
      // Sibling is on the right → current goes first
      currentHash = await hashPair(currentHash, step.hash);
    }
  }

  return {
    verified: currentHash === proof.merkleRoot,
    computedRoot: currentHash,
  };
}

// ---------------------------------------------------------------------------
// Validation Matrix — PASS/FAIL only
// ---------------------------------------------------------------------------

/**
 * Validate a Merkle inclusion proof structure.
 *
 * Each required field is validated independently:
 *   - leafHash: must be 64 lowercase hex characters
 *   - merkleRoot: must be 64 lowercase hex characters
 *   - path: must be an array, each step must have valid hash (64 hex) and position ('left'|'right')
 *   - leafIndex: must be non-negative integer
 *   - totalLeaves: must be positive integer
 *   - leafIndex < totalLeaves (index must be within bounds)
 *
 * Overall result: PASS only if ALL fields pass.
 * No partial pass. No percentage. No scoring.
 * Binary output only: PASS or FAIL per field.
 *
 * This is a pure function — same input always produces same output.
 */
export function validateMerkleInclusionProof(
  proof: MerkleInclusionProof
): MerkleProofValidationMatrix {
  const fields: MerkleProofFieldValidation[] = [];

  // Hex validation: 64 lowercase hex characters, no prefix, no whitespace
  const isValidHex64 = (value: string): boolean =>
    typeof value === 'string' &&
    value.length === 64 &&
    /^[0-9a-f]{64}$/.test(value);

  // leafHash: must be 64 lowercase hex characters
  fields.push({
    field: 'leafHash',
    result: isValidHex64(proof.leafHash) ? 'PASS' : 'FAIL',
  });

  // merkleRoot: must be 64 lowercase hex characters
  fields.push({
    field: 'merkleRoot',
    result: isValidHex64(proof.merkleRoot) ? 'PASS' : 'FAIL',
  });

  // path: must be array, every step valid
  const pathValid =
    Array.isArray(proof.path) &&
    proof.path.every(
      (step) =>
        isValidHex64(step.hash) &&
        (step.position === 'left' || step.position === 'right')
    );
  fields.push({
    field: 'path',
    result: pathValid ? 'PASS' : 'FAIL',
  });

  // leafIndex: must be non-negative integer
  fields.push({
    field: 'leafIndex',
    result:
      typeof proof.leafIndex === 'number' &&
      Number.isInteger(proof.leafIndex) &&
      proof.leafIndex >= 0
        ? 'PASS'
        : 'FAIL',
  });

  // totalLeaves: must be positive integer
  fields.push({
    field: 'totalLeaves',
    result:
      typeof proof.totalLeaves === 'number' &&
      Number.isInteger(proof.totalLeaves) &&
      proof.totalLeaves > 0
        ? 'PASS'
        : 'FAIL',
  });

  // leafIndex < totalLeaves (bounds check)
  fields.push({
    field: 'leafIndexBounds',
    result:
      typeof proof.leafIndex === 'number' &&
      typeof proof.totalLeaves === 'number' &&
      proof.leafIndex < proof.totalLeaves
        ? 'PASS'
        : 'FAIL',
  });

  // Overall: PASS only if ALL fields pass
  const allPass = fields.every((f) => f.result === 'PASS');

  return {
    fields,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}
