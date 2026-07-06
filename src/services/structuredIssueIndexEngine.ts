// ============================================
// Court Access — Structured Issue Index Engine (Phase 8)
// Canonical Issue Extraction + Normalized Variation Registry
//
// Deterministic cross-document issue extraction engine.
// Extracts variations mechanically from token-aligned segments.
//
// This engine:
//   - Tokenizes document segments (whitespace-split)
//   - Compares token-aligned segments deterministically
//   - Detects missing terms, differing tokens, timeline variations
//   - Builds dual-hashed issue entities
//   - Merges duplicate issues deterministically
//   - Does NOT interpret intent
//   - Does NOT suggest strategy
//   - Does NOT make accusations
//   - Does NOT add adjectives or conclusions
//
// Allowed phrasing only:
//   "Language differs."
//   "No citation located."
//   "Description varies."
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
//   - No escalation building
//   - No dispatch calls
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
  StructuredIssueEntity,
  StructuredIssueInput,
  TokenAlignedSegment,
  VariationDetectionResult,
  IssueMergeRecord,
} from '../models/StructuredIssueIndexModel';

// ---------------------------------------------------------------------------
// ASCII Comparator
// ---------------------------------------------------------------------------

function asciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Tokenize Segment — whitespace-split
// ---------------------------------------------------------------------------

/**
 * Split text into tokens at whitespace boundaries.
 * Deterministic — same input always produces same output.
 * No fuzzy matching. No stemming. No normalization beyond whitespace split.
 */
export function tokenizeSegment(
  documentId: string,
  segmentIndex: number,
  rawText: string
): TokenAlignedSegment {
  const tokens: string[] = [];
  let current = '';

  for (let i = 0; i < rawText.length; i++) {
    const ch = rawText.charAt(i);
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current = current + ch;
    }
  }
  if (current.length > 0) {
    tokens.push(current);
  }

  return {
    documentId,
    segmentIndex,
    tokens,
    rawText,
  };
}

// ---------------------------------------------------------------------------
// Compare Token-Aligned Segments — detect variations
// ---------------------------------------------------------------------------

/**
 * Compare two token-aligned segments to detect variations.
 *
 * Detects:
 *   - Missing terms (present in A, absent in B or vice versa)
 *   - Differing tokens at aligned indices
 *
 * No fuzzy matching. ASCII exact comparison only.
 * No intent inference. No credibility analysis.
 *
 * Deterministic — same inputs always produce same result.
 */
export function compareSegments(
  segmentA: TokenAlignedSegment,
  segmentB: TokenAlignedSegment
): VariationDetectionResult {
  const missingTerms: string[] = [];
  const differingTokenIndices: number[] = [];

  const maxLen = segmentA.tokens.length > segmentB.tokens.length
    ? segmentA.tokens.length
    : segmentB.tokens.length;

  for (let i = 0; i < maxLen; i++) {
    const tokenA = i < segmentA.tokens.length ? segmentA.tokens[i] : null;
    const tokenB = i < segmentB.tokens.length ? segmentB.tokens[i] : null;

    if (tokenA === null && tokenB !== null) {
      missingTerms.push(tokenB);
      differingTokenIndices.push(i);
    } else if (tokenA !== null && tokenB === null) {
      missingTerms.push(tokenA);
      differingTokenIndices.push(i);
    } else if (tokenA !== null && tokenB !== null && tokenA !== tokenB) {
      differingTokenIndices.push(i);
    }
  }

  return {
    segmentIndexA: segmentA.segmentIndex,
    segmentIndexB: segmentB.segmentIndex,
    documentIdA: segmentA.documentId,
    documentIdB: segmentB.documentId,
    missingTerms,
    differingTokenIndices,
    variationDetected: differingTokenIndices.length > 0 || missingTerms.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Canonicalize Issue Pre-ID Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for issue ID derivation.
 *
 * Includes (in fixed order):
 *   caseId, category, sourceDocumentIds (sorted), citationReferences (sorted),
 *   descriptionText, comparisonText
 *
 * Excludes:
 *   issueId, sha256, sha3_256
 */
function canonicalizeIssuePreId(input: StructuredIssueInput): string {
  const sortedDocIds = input.sourceDocumentIds.slice().sort(asciiCompare);
  const sortedCitations = input.citationReferences.slice().sort(asciiCompare);

  return (
    '{' +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"category":${JSON.stringify(input.category)},` +
    `"sourceDocumentIds":${JSON.stringify(sortedDocIds)},` +
    `"citationReferences":${JSON.stringify(sortedCitations)},` +
    `"descriptionText":${JSON.stringify(input.descriptionText)},` +
    `"comparisonText":${JSON.stringify(input.comparisonText)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Issue Full Form
// ---------------------------------------------------------------------------

/**
 * Canonical JSON for dual-hash computation.
 *
 * Includes: issueId + all pre-ID fields
 * Excludes: sha256, sha3_256
 */
function canonicalizeIssueFull(
  issueId: string,
  input: StructuredIssueInput
): string {
  const sortedDocIds = input.sourceDocumentIds.slice().sort(asciiCompare);
  const sortedCitations = input.citationReferences.slice().sort(asciiCompare);

  return (
    '{' +
    `"issueId":${JSON.stringify(issueId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"category":${JSON.stringify(input.category)},` +
    `"sourceDocumentIds":${JSON.stringify(sortedDocIds)},` +
    `"citationReferences":${JSON.stringify(sortedCitations)},` +
    `"descriptionText":${JSON.stringify(input.descriptionText)},` +
    `"comparisonText":${JSON.stringify(input.comparisonText)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Structured Issue Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete structured issue entity from input.
 *
 * Pipeline:
 *   1. Canonicalize pre-ID form
 *   2. Derive issueId = SHA-256(preIdCanonical)
 *   3. Canonicalize full form
 *   4. Compute dual-hash
 *   5. Return complete entity
 *
 * descriptionText must be direct quotation only.
 * comparisonText must be structured difference only.
 * No adjectives. No conclusions. No narrative.
 *
 * Deterministic — same input always produces same output.
 */
export async function buildStructuredIssueEntity(
  input: StructuredIssueInput
): Promise<StructuredIssueEntity> {
  const preIdCanonical = canonicalizeIssuePreId(input);
  const issueId = await computeTextSHA256(preIdCanonical);
  const fullCanonical = canonicalizeIssueFull(issueId, input);
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    issueId,
    caseId: input.caseId,
    category: input.category,
    sourceDocumentIds: input.sourceDocumentIds.slice().sort(asciiCompare),
    citationReferences: input.citationReferences.slice().sort(asciiCompare),
    descriptionText: input.descriptionText,
    comparisonText: input.comparisonText,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Check Issue Duplicate — deterministic deduplication
// ---------------------------------------------------------------------------

/**
 * Check if an issue with the same canonical pre-ID form already exists.
 *
 * Deterministic — same inputs always produce same result.
 * No fuzzy merging. Exact canonical match only.
 */
export async function checkIssueDuplicate(
  input: StructuredIssueInput,
  existingIssueIds: readonly string[]
): Promise<{ isDuplicate: boolean; matchedIssueId: string | null }> {
  const preIdCanonical = canonicalizeIssuePreId(input);
  const candidateId = await computeTextSHA256(preIdCanonical);

  for (let i = 0; i < existingIssueIds.length; i++) {
    if (existingIssueIds[i] === candidateId) {
      return { isDuplicate: true, matchedIssueId: candidateId };
    }
  }

  return { isDuplicate: false, matchedIssueId: null };
}

// ---------------------------------------------------------------------------
// Build Issue Merge Record — deterministic merge
// ---------------------------------------------------------------------------

/**
 * Build a merge record when multiple documents produce the same variation.
 *
 * Rules:
 *   - Primary issue ID is the first in ASCII sort order
 *   - Merged issue IDs sorted ASCII ascending
 *   - Deterministic merge reason
 *   - No fuzzy merging
 *
 * Deterministic — same inputs always produce same output.
 */
export function buildIssueMergeRecord(
  issueIds: readonly string[],
  mergeReason: string
): IssueMergeRecord {
  const sorted = issueIds.slice().sort(asciiCompare);
  const primaryIssueId = sorted[0];
  const mergedIssueIds = sorted.slice(1);

  return {
    primaryIssueId,
    mergedIssueIds,
    mergeReason,
  };
}

// ---------------------------------------------------------------------------
// Verify Structured Issue Entity — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify a structured issue entity by recomputing all hashes.
 *
 * Binary PASS/FAIL only.
 * Deterministic — same input always produces same result.
 */
export async function verifyStructuredIssueEntity(
  entity: StructuredIssueEntity
): Promise<{
  issueIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: StructuredIssueInput = {
    caseId: entity.caseId,
    category: entity.category,
    sourceDocumentIds: entity.sourceDocumentIds,
    citationReferences: entity.citationReferences,
    descriptionText: entity.descriptionText,
    comparisonText: entity.comparisonText,
  };

  const preIdCanonical = canonicalizeIssuePreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const issueIdMatch = recomputedId === entity.issueId ? 'PASS' : 'FAIL';

  const fullCanonical = canonicalizeIssueFull(entity.issueId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    issueIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return { issueIdMatch, sha256Match, sha3_256Match, overallResult };
}
