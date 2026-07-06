// ============================================
// Court Access — Analysis Export Engine (Phase 12)
// Immutable Analysis Export Layer
//
// Generates structured export packages that include
// all intelligence layer outputs. Versioned, reproducible,
// deterministic.
//
// This engine:
//   - Builds dual-hashed analysis snapshot entities
//   - Builds dual-hashed export document entities
//   - Enforces fixed section order
//   - Embeds snapshot hash + model version
//   - No narrative summary — structured tables only
//   - Replay verification for all entities
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
//   - No legal advice / outcome prediction / strategy
//   - No credibility analysis / intent inference
//   - No "likely" / "appears to" / "suggests" / "indicates"
//   - No "weak" / "strong" / "contradiction" / "violation"
//   - Deterministic processing only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  AnalysisSnapshotEntity,
  AnalysisSnapshotInput,
  ExportSection,
  ExportDocumentEntity,
  ExportDocumentInput,
  ExportSectionType,
} from '../models/AnalysisSnapshotModel';

// ---------------------------------------------------------------------------
// Fixed Section Order — deterministic
// ---------------------------------------------------------------------------

/**
 * Fixed section order for export documents.
 * This order must never change for reproducibility.
 *
 * 1. ISSUE_INDEX
 * 2. CALCRIM_MAPPING
 * 3. POLICY_COMPARISON
 * 4. MEDIA_ALIGNMENT
 * 5. SNAPSHOT_METADATA
 */
const SECTION_ORDER: readonly ExportSectionType[] = [
  'ISSUE_INDEX',
  'CALCRIM_MAPPING',
  'POLICY_COMPARISON',
  'MEDIA_ALIGNMENT',
  'SNAPSHOT_METADATA',
] as const;

/**
 * Get the fixed order index for a section type.
 * Returns -1 if unknown section type.
 */
export function getSectionOrder(sectionType: ExportSectionType): number {
  for (let i = 0; i < SECTION_ORDER.length; i++) {
    if (SECTION_ORDER[i] === sectionType) {
      return i + 1;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Sort Sections — fixed order
// ---------------------------------------------------------------------------

/**
 * Sort export sections by their fixed order.
 * Returns a new array — does not mutate input.
 *
 * Deterministic — same inputs always produce same output.
 */
export function sortSectionsByOrder(
  sections: readonly ExportSection[]
): ExportSection[] {
  const sorted = sections.slice();
  sorted.sort(function sortBySectionOrder(a: ExportSection, b: ExportSection): number {
    return a.sectionOrder - b.sectionOrder;
  });
  return sorted;
}

// ---------------------------------------------------------------------------
// Build Export Section
// ---------------------------------------------------------------------------

/**
 * Build an export section with deterministic order assignment.
 *
 * Deterministic — same inputs always produce same output.
 */
export function buildExportSection(
  sectionType: ExportSectionType,
  contentHash: string,
  rowCount: number
): ExportSection {
  return {
    sectionType,
    sectionOrder: getSectionOrder(sectionType),
    contentHash,
    rowCount,
  };
}

// ---------------------------------------------------------------------------
// Canonicalize Snapshot Pre-ID Form
// ---------------------------------------------------------------------------

function canonicalizeSnapshotPreId(input: AnalysisSnapshotInput): string {
  return (
    '{' +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"modelVersion":${JSON.stringify(input.modelVersion)},` +
    `"issueIndexHash":${JSON.stringify(input.issueIndexHash)},` +
    `"calcrimMappingHash":${JSON.stringify(input.calcrimMappingHash)},` +
    `"policyComparisonHash":${JSON.stringify(input.policyComparisonHash)},` +
    `"mediaAlignmentHash":${JSON.stringify(input.mediaAlignmentHash)},` +
    `"generatedTimestamp":${JSON.stringify(input.generatedTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Snapshot Full Form
// ---------------------------------------------------------------------------

function canonicalizeSnapshotFull(
  snapshotId: string,
  input: AnalysisSnapshotInput
): string {
  return (
    '{' +
    `"snapshotId":${JSON.stringify(snapshotId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"modelVersion":${JSON.stringify(input.modelVersion)},` +
    `"issueIndexHash":${JSON.stringify(input.issueIndexHash)},` +
    `"calcrimMappingHash":${JSON.stringify(input.calcrimMappingHash)},` +
    `"policyComparisonHash":${JSON.stringify(input.policyComparisonHash)},` +
    `"mediaAlignmentHash":${JSON.stringify(input.mediaAlignmentHash)},` +
    `"generatedTimestamp":${JSON.stringify(input.generatedTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Analysis Snapshot Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete analysis snapshot entity.
 *
 * Pipeline:
 *   1. Canonicalize pre-ID form
 *   2. Derive snapshotId = SHA-256(preIdCanonical)
 *   3. Canonicalize full form
 *   4. Compute dual-hash
 *   5. Return complete entity
 *
 * Deterministic — same input always produces same output.
 */
export async function buildAnalysisSnapshotEntity(
  input: AnalysisSnapshotInput
): Promise<AnalysisSnapshotEntity> {
  const preIdCanonical = canonicalizeSnapshotPreId(input);
  const snapshotId = await computeTextSHA256(preIdCanonical);
  const fullCanonical = canonicalizeSnapshotFull(snapshotId, input);
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    snapshotId,
    caseId: input.caseId,
    modelVersion: input.modelVersion,
    issueIndexHash: input.issueIndexHash,
    calcrimMappingHash: input.calcrimMappingHash,
    policyComparisonHash: input.policyComparisonHash,
    mediaAlignmentHash: input.mediaAlignmentHash,
    generatedTimestamp: input.generatedTimestamp,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Analysis Snapshot Entity — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify an analysis snapshot entity by recomputing all hashes.
 *
 * Checks:
 *   1. snapshotId matches recomputed pre-ID hash
 *   2. sha256 matches recomputed full canonical hash
 *   3. sha3_256 matches recomputed full canonical hash
 *
 * Binary PASS/FAIL only.
 * Deterministic — same input always produces same result.
 */
export async function verifyAnalysisSnapshotEntity(
  entity: AnalysisSnapshotEntity
): Promise<{
  snapshotIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: AnalysisSnapshotInput = {
    caseId: entity.caseId,
    modelVersion: entity.modelVersion,
    issueIndexHash: entity.issueIndexHash,
    calcrimMappingHash: entity.calcrimMappingHash,
    policyComparisonHash: entity.policyComparisonHash,
    mediaAlignmentHash: entity.mediaAlignmentHash,
    generatedTimestamp: entity.generatedTimestamp,
  };

  const preIdCanonical = canonicalizeSnapshotPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const snapshotIdMatch = recomputedId === entity.snapshotId ? 'PASS' : 'FAIL';

  const fullCanonical = canonicalizeSnapshotFull(entity.snapshotId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    snapshotIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return { snapshotIdMatch, sha256Match, sha3_256Match, overallResult };
}

// ---------------------------------------------------------------------------
// Canonicalize Export Document Pre-ID Form
// ---------------------------------------------------------------------------

function canonicalizeExportPreId(input: ExportDocumentInput): string {
  return (
    '{' +
    `"snapshotId":${JSON.stringify(input.snapshotId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"modelVersion":${JSON.stringify(input.modelVersion)},` +
    `"sections":${JSON.stringify(input.sections)},` +
    `"generatedTimestamp":${JSON.stringify(input.generatedTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Export Document Full Form
// ---------------------------------------------------------------------------

function canonicalizeExportFull(
  exportId: string,
  input: ExportDocumentInput
): string {
  return (
    '{' +
    `"exportId":${JSON.stringify(exportId)},` +
    `"snapshotId":${JSON.stringify(input.snapshotId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"modelVersion":${JSON.stringify(input.modelVersion)},` +
    `"sections":${JSON.stringify(input.sections)},` +
    `"generatedTimestamp":${JSON.stringify(input.generatedTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Export Document Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete export document entity.
 *
 * Sections are sorted by fixed order before hashing.
 * Two-pass hash derivation.
 *
 * Deterministic — same input always produces same output.
 */
export async function buildExportDocumentEntity(
  input: ExportDocumentInput
): Promise<ExportDocumentEntity> {
  // Ensure sections are in fixed order for deterministic hashing
  const sortedSections = sortSectionsByOrder(input.sections);
  const normalizedInput: ExportDocumentInput = {
    snapshotId: input.snapshotId,
    caseId: input.caseId,
    modelVersion: input.modelVersion,
    sections: sortedSections,
    generatedTimestamp: input.generatedTimestamp,
  };

  const preIdCanonical = canonicalizeExportPreId(normalizedInput);
  const exportId = await computeTextSHA256(preIdCanonical);
  const fullCanonical = canonicalizeExportFull(exportId, normalizedInput);
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    exportId,
    snapshotId: input.snapshotId,
    caseId: input.caseId,
    modelVersion: input.modelVersion,
    sections: sortedSections,
    generatedTimestamp: input.generatedTimestamp,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Export Document Entity — replay verification
// ---------------------------------------------------------------------------

export async function verifyExportDocumentEntity(
  entity: ExportDocumentEntity
): Promise<{
  exportIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const sortedSections = sortSectionsByOrder(entity.sections);
  const input: ExportDocumentInput = {
    snapshotId: entity.snapshotId,
    caseId: entity.caseId,
    modelVersion: entity.modelVersion,
    sections: sortedSections,
    generatedTimestamp: entity.generatedTimestamp,
  };

  const preIdCanonical = canonicalizeExportPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const exportIdMatch = recomputedId === entity.exportId ? 'PASS' : 'FAIL';

  const fullCanonical = canonicalizeExportFull(entity.exportId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    exportIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return { exportIdMatch, sha256Match, sha3_256Match, overallResult };
}
