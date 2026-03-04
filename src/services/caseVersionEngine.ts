// ============================================
// Court Access — Case Version Engine (Phase 15)
// Immutable Versioned Case Evolution Engine
//
// Tracks case evolution with append-only version chain.
// No overwrites. No branching. No mutation. No deletion.
//
// This engine:
//   - Builds dual-hashed version entities
//   - Enforces previousVersionHash chain integrity
//   - Verifies entire version chains
//   - Archives versions (never deletes)
//   - Linear chain only — no branching
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - No side effects (caller persists)
//
// Architectural boundary:
//   - Only imports policyIngestionService for hashing
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access
//   - No SES calls
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction
//   - No credibility analysis / intent inference
//   - Deterministic processing only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  CaseVersionEntity,
  CaseVersionInput,
  VersionChainVerificationResult,
  VersionVerificationEntry,
} from '../models/CaseVersionModel';

// ---------------------------------------------------------------------------
// Canonicalize Version Pre-ID Form
// ---------------------------------------------------------------------------

function canonicalizeVersionPreId(input: CaseVersionInput): string {
  return (
    '{' +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"versionNumber":${input.versionNumber},` +
    `"previousVersionHash":${JSON.stringify(input.previousVersionHash)},` +
    `"snapshotHash":${JSON.stringify(input.snapshotHash)},` +
    `"createdTimestamp":${JSON.stringify(input.createdTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Version Full Form
// ---------------------------------------------------------------------------

function canonicalizeVersionFull(
  versionId: string,
  input: CaseVersionInput
): string {
  return (
    '{' +
    `"versionId":${JSON.stringify(versionId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"versionNumber":${input.versionNumber},` +
    `"previousVersionHash":${JSON.stringify(input.previousVersionHash)},` +
    `"snapshotHash":${JSON.stringify(input.snapshotHash)},` +
    `"createdTimestamp":${JSON.stringify(input.createdTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Case Version Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete case version entity.
 *
 * Pipeline:
 *   1. Canonicalize pre-ID form
 *   2. Derive versionId = SHA-256(preIdCanonical)
 *   3. Canonicalize full form
 *   4. Compute dual-hash
 *   5. Return complete entity
 *
 * Chain enforcement:
 *   - Caller must provide correct previousVersionHash
 *   - First version: previousVersionHash === null
 *   - Subsequent versions: previousVersionHash === prior version's sha256
 *
 * Deterministic — same input always produces same output.
 */
export async function buildCaseVersionEntity(
  input: CaseVersionInput
): Promise<CaseVersionEntity> {
  const preIdCanonical = canonicalizeVersionPreId(input);
  const versionId = await computeTextSHA256(preIdCanonical);
  const fullCanonical = canonicalizeVersionFull(versionId, input);
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    versionId,
    caseId: input.caseId,
    tenantId: input.tenantId,
    versionNumber: input.versionNumber,
    previousVersionHash: input.previousVersionHash,
    snapshotHash: input.snapshotHash,
    createdTimestamp: input.createdTimestamp,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Single Version Entity — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify a single case version entity by recomputing all hashes.
 *
 * Binary PASS/FAIL only.
 * Deterministic — same input always produces same result.
 */
async function verifySingleVersionEntity(
  entity: CaseVersionEntity
): Promise<{
  versionIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
}> {
  const input: CaseVersionInput = {
    caseId: entity.caseId,
    tenantId: entity.tenantId,
    versionNumber: entity.versionNumber,
    previousVersionHash: entity.previousVersionHash,
    snapshotHash: entity.snapshotHash,
    createdTimestamp: entity.createdTimestamp,
  };

  const preIdCanonical = canonicalizeVersionPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const versionIdMatch = recomputedId === entity.versionId ? 'PASS' : 'FAIL';

  const fullCanonical = canonicalizeVersionFull(entity.versionId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  return { versionIdMatch, sha256Match, sha3_256Match };
}

// ---------------------------------------------------------------------------
// Verify Version Chain — full chain verification
// ---------------------------------------------------------------------------

/**
 * Verify an entire version chain.
 *
 * Checks:
 *   1. Each version's hashes match recomputation
 *   2. Chronological sequence (versionNumber ascending)
 *   3. previousVersionHash linkage (each version links to prior's sha256)
 *   4. First version has previousVersionHash === null
 *
 * Versions must be provided in versionNumber order.
 *
 * Binary PASS/FAIL per version + overall.
 * Deterministic — same inputs always produce same result.
 */
export async function verifyVersionChain(
  versions: readonly CaseVersionEntity[]
): Promise<VersionChainVerificationResult> {
  const versionResults: VersionVerificationEntry[] = [];
  let failedVersions = 0;

  for (let i = 0; i < versions.length; i++) {
    const entity = versions[i];
    const hashResult = await verifySingleVersionEntity(entity);

    // Check previousVersionHash linkage
    let previousVersionLinkage: 'PASS' | 'FAIL' = 'PASS';

    if (i === 0) {
      // First version must have null previousVersionHash
      if (entity.previousVersionHash !== null) {
        previousVersionLinkage = 'FAIL';
      }
    } else {
      // Subsequent versions must link to prior version's sha256
      const priorVersion = versions[i - 1];
      if (entity.previousVersionHash !== priorVersion.sha256) {
        previousVersionLinkage = 'FAIL';
      }
    }

    const overallResult =
      hashResult.versionIdMatch === 'PASS' &&
      hashResult.sha256Match === 'PASS' &&
      hashResult.sha3_256Match === 'PASS' &&
      previousVersionLinkage === 'PASS'
        ? 'PASS'
        : 'FAIL';

    if (overallResult === 'FAIL') {
      failedVersions++;
    }

    versionResults.push({
      versionId: entity.versionId,
      versionNumber: entity.versionNumber,
      versionIdMatch: hashResult.versionIdMatch,
      sha256Match: hashResult.sha256Match,
      sha3_256Match: hashResult.sha3_256Match,
      previousVersionLinkage,
      overallResult,
    });
  }

  return {
    totalVersions: versions.length,
    verifiedVersions: versions.length - failedVersions,
    failedVersions,
    chainIntegrityStatus: failedVersions === 0 ? 'PASS' : 'FAIL',
    versionResults,
  };
}

// ---------------------------------------------------------------------------
// Validate Version Chain Ordering
// ---------------------------------------------------------------------------

/**
 * Validate that versions are in correct sequential order.
 *
 * Rules:
 *   - versionNumber must start at 1
 *   - versionNumber must increment by 1
 *   - createdTimestamp must be non-decreasing (ASCII comparison)
 *
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function validateVersionChainOrdering(
  versions: readonly CaseVersionEntity[]
): 'PASS' | 'FAIL' {
  if (versions.length === 0) {
    return 'PASS';
  }

  // First version must be number 1
  if (versions[0].versionNumber !== 1) {
    return 'FAIL';
  }

  for (let i = 1; i < versions.length; i++) {
    // Sequential increment
    if (versions[i].versionNumber !== versions[i - 1].versionNumber + 1) {
      return 'FAIL';
    }

    // Chronological ordering (ASCII comparison)
    if (versions[i].createdTimestamp < versions[i - 1].createdTimestamp) {
      return 'FAIL';
    }
  }

  return 'PASS';
}
