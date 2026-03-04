// ============================================
// Court Access — Export Provenance Engine (Phase 22)
// Immutable Export Provenance Layer
//
// Embeds provenance metadata inside every export.
// Ensures every export is traceable to its source snapshot,
// model version, and constitutional validation.
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - No side effects
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
//   - Deterministic processing only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  ProvenanceBlock,
  ProvenanceBlockInput,
  ExportVerificationPage,
} from '../models/ExportProvenanceModel';

// ---------------------------------------------------------------------------
// Canonicalize Provenance Pre-ID Form
// ---------------------------------------------------------------------------

function canonicalizeProvenancePreId(input: ProvenanceBlockInput): string {
  return (
    '{' +
    `"snapshotId":${JSON.stringify(input.snapshotId)},` +
    `"modelVersion":${JSON.stringify(input.modelVersion)},` +
    `"exportTimestamp":${JSON.stringify(input.exportTimestamp)},` +
    `"outputConstitutionHash":${JSON.stringify(input.outputConstitutionHash)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Provenance Full Form
// ---------------------------------------------------------------------------

function canonicalizeProvenanceFull(
  provenanceId: string,
  input: ProvenanceBlockInput
): string {
  return (
    '{' +
    `"provenanceId":${JSON.stringify(provenanceId)},` +
    `"snapshotId":${JSON.stringify(input.snapshotId)},` +
    `"modelVersion":${JSON.stringify(input.modelVersion)},` +
    `"exportTimestamp":${JSON.stringify(input.exportTimestamp)},` +
    `"outputConstitutionHash":${JSON.stringify(input.outputConstitutionHash)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Provenance Block — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete provenance block for export embedding.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> provenanceId
 *   Pass 2: full canonical -> dual-hash
 *
 * Deterministic — same input always produces same output.
 */
export async function buildProvenanceBlock(
  input: ProvenanceBlockInput
): Promise<ProvenanceBlock> {
  const preIdCanonical = canonicalizeProvenancePreId(input);
  const provenanceId = await computeTextSHA256(preIdCanonical);
  const fullCanonical = canonicalizeProvenanceFull(provenanceId, input);
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    provenanceId,
    snapshotId: input.snapshotId,
    modelVersion: input.modelVersion,
    exportTimestamp: input.exportTimestamp,
    outputConstitutionHash: input.outputConstitutionHash,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Provenance Block — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify a provenance block by recomputing all hashes.
 *
 * Binary PASS/FAIL per field.
 * Deterministic — same input always produces same result.
 */
export async function verifyProvenanceBlock(
  entity: ProvenanceBlock
): Promise<{
  provenanceIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: ProvenanceBlockInput = {
    snapshotId: entity.snapshotId,
    modelVersion: entity.modelVersion,
    exportTimestamp: entity.exportTimestamp,
    outputConstitutionHash: entity.outputConstitutionHash,
  };

  const preIdCanonical = canonicalizeProvenancePreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const provenanceIdMatch = recomputedId === entity.provenanceId ? 'PASS' : 'FAIL';

  const fullCanonical = canonicalizeProvenanceFull(entity.provenanceId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    provenanceIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return { provenanceIdMatch, sha256Match, sha3_256Match, overallResult };
}

// ---------------------------------------------------------------------------
// Build Export Verification Page
// ---------------------------------------------------------------------------

/**
 * Build verification metadata for embedding in PDF exports.
 *
 * Contains all hashes needed for independent verification.
 * Deterministic formatting only.
 */
export function buildExportVerificationPage(
  snapshotHash: string,
  sha256: string,
  sha3_256: string,
  versionNumber: number,
  modelVersion: string,
  exportTimestamp: string,
  provenanceId: string
): ExportVerificationPage {
  return {
    snapshotHash,
    sha256,
    sha3_256,
    versionNumber,
    modelVersion,
    exportTimestamp,
    provenanceId,
  };
}
