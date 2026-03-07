// ============================================
// Court Access — Evidence Integrity Service (AI Evidence Intelligence Phase 9)
// Cryptographic integrity verification for all evidence types.
//
// Hash algorithms:
//   - SHA-256 (primary)
//   - SHA3-256 (secondary — crypto survivability)
//
// Dual-hash doctrine:
//   - Both hashes computed at upload time
//   - Both immutable once set
//   - Both must match on verification
//
// Optional future: Merkle root anchoring for evidence bundles.
// ============================================

import type { EvidenceRecord } from '../models/EvidenceModel';
import { computeSHA256, computeSHA3_256 } from './ingestionService';

// ---------------------------------------------------------------------------
// Evidence Integrity Verification Result
// ---------------------------------------------------------------------------

export interface EvidenceIntegrityResult {
  evidenceId: string;
  sha256Match: 'PASS' | 'FAIL';
  sha3Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
  computedSha256: string;
  computedSha3: string;
  storedSha256: string;
  storedSha3: string;
  verifiedTimestamp: string;
}

// ---------------------------------------------------------------------------
// Evidence Integrity Verification
// ---------------------------------------------------------------------------

/**
 * Verify evidence integrity by re-hashing the file and comparing to stored hashes.
 *
 * Dual-hash verification:
 *   1. Re-compute SHA-256 from file bytes
 *   2. Re-compute SHA3-256 from file bytes
 *   3. Compare both to stored values
 *   4. Overall PASS only if BOTH match
 *
 * Deterministic — same input always produces same output.
 */
export async function verifyEvidenceIntegrity(
  file: File,
  record: EvidenceRecord
): Promise<EvidenceIntegrityResult> {
  const computedSha256 = await computeSHA256(file);
  const computedSha3 = await computeSHA3_256(file);

  const sha256Match = computedSha256 === record.sha256Hash ? 'PASS' : 'FAIL';
  const sha3Match = computedSha3 === record.sha3Hash ? 'PASS' : 'FAIL';
  const overallResult = sha256Match === 'PASS' && sha3Match === 'PASS' ? 'PASS' : 'FAIL';

  return {
    evidenceId: record.evidenceId,
    sha256Match,
    sha3Match,
    overallResult,
    computedSha256,
    computedSha3,
    storedSha256: record.sha256Hash,
    storedSha3: record.sha3Hash,
    verifiedTimestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Merkle Root for Evidence Bundles
// ---------------------------------------------------------------------------

/**
 * Compute Merkle root from a list of evidence hash pairs.
 * Used for anchoring evidence bundles.
 *
 * Input: Array of SHA-256 hashes (one per evidence record).
 * Output: Single Merkle root hash.
 *
 * Deterministic — same input always produces same output.
 * Leaf ordering: sorted lexicographically (ascending) for determinism.
 */
export async function computeEvidenceMerkleRoot(
  sha256Hashes: string[]
): Promise<string> {
  if (sha256Hashes.length === 0) {
    return '0'.repeat(64); // Empty tree root
  }

  if (sha256Hashes.length === 1) {
    return sha256Hashes[0];
  }

  // Sort leaves lexicographically for deterministic ordering
  const sorted = [...sha256Hashes].sort();

  // Build Merkle tree bottom-up
  let currentLevel = sorted;

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;

      // Concatenate left + right, hash the pair
      const combined = left + right;
      const encoder = new TextEncoder();
      const data = encoder.encode(combined);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      nextLevel.push(hash);
    }

    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

// ---------------------------------------------------------------------------
// Evidence Bundle Integrity
// ---------------------------------------------------------------------------

export interface EvidenceBundleIntegrity {
  caseId: string;
  evidenceCount: number;
  merkleRoot: string;
  individualResults: EvidenceIntegrityResult[];
  overallResult: 'PASS' | 'FAIL';
  verifiedTimestamp: string;
}

/**
 * Verify integrity of an entire evidence bundle (all evidence for a case).
 */
export async function verifyEvidenceBundleIntegrity(
  files: File[],
  records: EvidenceRecord[],
  caseId: string
): Promise<EvidenceBundleIntegrity> {
  const results: EvidenceIntegrityResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const result = await verifyEvidenceIntegrity(files[i], records[i]);
    results.push(result);
  }

  const allPass = results.every((r) => r.overallResult === 'PASS');
  const merkleRoot = await computeEvidenceMerkleRoot(
    records.map((r) => r.sha256Hash)
  );

  return {
    caseId,
    evidenceCount: records.length,
    merkleRoot,
    individualResults: results,
    overallResult: allPass ? 'PASS' : 'FAIL',
    verifiedTimestamp: new Date().toISOString(),
  };
}
