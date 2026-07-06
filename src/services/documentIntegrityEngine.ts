// ============================================
// Court Access — Document Integrity Engine (Phase 20)
// Document Integrity & Anti-Tamper Verification Layer
//
// Ensures uploaded documents remain immutable.
// Recomputes hashes on retrieval. Binary PASS/FAIL.
// Includes deterministic page density analysis.
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
  DocumentIntegrityRecord,
  DocumentIntegrityInput,
  PageDensityResult,
} from '../models/DocumentIntegrityModel';

// ---------------------------------------------------------------------------
// Canonicalize Integrity Pre-ID Form
// ---------------------------------------------------------------------------

function canonicalizeIntegrityPreId(input: DocumentIntegrityInput): string {
  return (
    '{' +
    `"documentId":${JSON.stringify(input.documentId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"originalHash":${JSON.stringify(input.originalHash)},` +
    `"currentHash":${JSON.stringify(input.currentHash)},` +
    `"verifiedTimestamp":${JSON.stringify(input.verifiedTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Integrity Full Form
// ---------------------------------------------------------------------------

function canonicalizeIntegrityFull(
  recordId: string,
  input: DocumentIntegrityInput,
  integrityStatus: 'PASS' | 'FAIL'
): string {
  return (
    '{' +
    `"recordId":${JSON.stringify(recordId)},` +
    `"documentId":${JSON.stringify(input.documentId)},` +
    `"tenantId":${JSON.stringify(input.tenantId)},` +
    `"originalHash":${JSON.stringify(input.originalHash)},` +
    `"currentHash":${JSON.stringify(input.currentHash)},` +
    `"integrityStatus":${JSON.stringify(integrityStatus)},` +
    `"verifiedTimestamp":${JSON.stringify(input.verifiedTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Document Integrity Record — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete document integrity record.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> recordId
 *   Pass 2: full canonical -> dual-hash
 *
 * integrityStatus is computed deterministically:
 *   PASS if originalHash === currentHash
 *   FAIL if originalHash !== currentHash
 *
 * Deterministic — same input always produces same output.
 */
export async function buildDocumentIntegrityRecord(
  input: DocumentIntegrityInput
): Promise<DocumentIntegrityRecord> {
  const integrityStatus = input.originalHash === input.currentHash ? 'PASS' : 'FAIL';

  const preIdCanonical = canonicalizeIntegrityPreId(input);
  const recordId = await computeTextSHA256(preIdCanonical);
  const fullCanonical = canonicalizeIntegrityFull(recordId, input, integrityStatus);
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    recordId,
    documentId: input.documentId,
    tenantId: input.tenantId,
    originalHash: input.originalHash,
    currentHash: input.currentHash,
    integrityStatus,
    verifiedTimestamp: input.verifiedTimestamp,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Document Integrity Record — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify a document integrity record by recomputing all hashes.
 *
 * Binary PASS/FAIL per field.
 * Deterministic — same input always produces same result.
 */
export async function verifyDocumentIntegrityRecord(
  entity: DocumentIntegrityRecord
): Promise<{
  recordIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: DocumentIntegrityInput = {
    documentId: entity.documentId,
    tenantId: entity.tenantId,
    originalHash: entity.originalHash,
    currentHash: entity.currentHash,
    verifiedTimestamp: entity.verifiedTimestamp,
  };

  const preIdCanonical = canonicalizeIntegrityPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const recordIdMatch = recomputedId === entity.recordId ? 'PASS' : 'FAIL';

  const fullCanonical = canonicalizeIntegrityFull(entity.recordId, input, entity.integrityStatus);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    recordIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return { recordIdMatch, sha256Match, sha3_256Match, overallResult };
}

// ---------------------------------------------------------------------------
// Page Density Analysis — deterministic
// ---------------------------------------------------------------------------

/**
 * Analyze page density for multiplex abuse detection.
 *
 * Deterministic: character count / page count.
 * Binary PASS/FAIL based on threshold.
 * No probabilistic scoring.
 *
 * PASS = charactersPerPage <= densityThreshold
 * FAIL = charactersPerPage > densityThreshold (potential abuse)
 */
export function analyzePageDensity(
  documentId: string,
  totalCharacters: number,
  totalPages: number,
  densityThreshold: number
): PageDensityResult {
  const charactersPerPage = totalPages > 0
    ? Math.floor(totalCharacters / totalPages)
    : 0;

  const densityStatus = charactersPerPage <= densityThreshold ? 'PASS' : 'FAIL';

  return {
    documentId,
    totalCharacters,
    totalPages,
    charactersPerPage,
    densityThreshold,
    densityStatus,
  };
}
