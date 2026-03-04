// ============================================
// Court Access — CALCRIM Mapping Engine (Phase 9)
// Charge Element Cross-Reference Matrix
//
// Mechanically maps charge elements to case documentation.
// No strategy. No inference. No outcome commentary.
//
// This engine:
//   - Maps CALCRIM elements to document citations
//   - Detects unmatched elements (gaps)
//   - Builds dual-hashed mapping entities
//   - Does NOT interpret legal meaning
//   - Does NOT suggest strategy
//   - Does NOT claim "weakness"
//   - Only outputs: "No citation located in uploaded documents."
//
// Allowed phrasing only:
//   "No citation located in uploaded documents."
//   "Element not matched in uploaded documents."
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
  CalcrimElement,
  ElementMappingResult,
  ChargeElementMappingEntity,
  ChargeElementMappingInput,
} from '../models/CalcrimMappingModel';

// ---------------------------------------------------------------------------
// ASCII Comparator
// ---------------------------------------------------------------------------

function asciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Document Citation Segment
// ---------------------------------------------------------------------------

/**
 * A segment of document text with citation reference.
 * Used for element matching.
 */
export interface DocumentCitationSegment {
  documentId: string;
  citationReference: string;
  tokens: string[];
}

// ---------------------------------------------------------------------------
// Tokenize for Matching
// ---------------------------------------------------------------------------

/**
 * Split text into tokens for element matching.
 * Whitespace-split only. No stemming. No normalization.
 */
function tokenizeText(text: string): string[] {
  const tokens: string[] = [];
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
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
  return tokens;
}

// ---------------------------------------------------------------------------
// Match Element to Documents
// ---------------------------------------------------------------------------

/**
 * Match a single CALCRIM element against document citation segments.
 *
 * Matching rule: element tokens must appear as a subsequence
 * within a document segment's tokens (order-preserving).
 *
 * No fuzzy matching. ASCII exact token comparison.
 * No intent inference. No credibility analysis.
 *
 * Deterministic — same inputs always produce same result.
 */
export function matchElementToDocuments(
  element: CalcrimElement,
  segments: readonly DocumentCitationSegment[]
): ElementMappingResult {
  const elementTokens = tokenizeText(element.verbatimText);
  const matchedCitations: string[] = [];

  for (let s = 0; s < segments.length; s++) {
    const segTokens = segments[s].tokens;
    // Check if element tokens appear as subsequence
    let eIdx = 0;
    for (let t = 0; t < segTokens.length && eIdx < elementTokens.length; t++) {
      if (segTokens[t] === elementTokens[eIdx]) {
        eIdx++;
      }
    }
    if (eIdx === elementTokens.length) {
      matchedCitations.push(segments[s].citationReference);
    }
  }

  // Sort citations ASCII for deterministic output
  matchedCitations.sort(asciiCompare);

  return {
    instructionNumber: element.instructionNumber,
    elementNumber: element.elementNumber,
    elementText: element.verbatimText,
    matchedCitations,
    unmatched: matchedCitations.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Map All Elements for a Charge
// ---------------------------------------------------------------------------

/**
 * Map all CALCRIM elements for a charge against document segments.
 *
 * Returns element-by-element results.
 * Unmatched elements are flagged — no commentary added.
 *
 * Deterministic — same inputs always produce same results.
 */
export function mapChargeElements(
  elements: readonly CalcrimElement[],
  segments: readonly DocumentCitationSegment[]
): ElementMappingResult[] {
  const results: ElementMappingResult[] = [];

  for (let i = 0; i < elements.length; i++) {
    results.push(matchElementToDocuments(elements[i], segments));
  }

  return results;
}

// ---------------------------------------------------------------------------
// Canonicalize Mapping Pre-ID Form
// ---------------------------------------------------------------------------

function canonicalizeMappingPreId(input: ChargeElementMappingInput): string {
  return (
    '{' +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"chargeId":${JSON.stringify(input.chargeId)},` +
    `"instructionNumber":${JSON.stringify(input.instructionNumber)},` +
    `"elementResults":${JSON.stringify(input.elementResults)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Mapping Full Form
// ---------------------------------------------------------------------------

function canonicalizeMappingFull(
  mappingId: string,
  input: ChargeElementMappingInput,
  totalElements: number,
  matchedElements: number,
  unmatchedElements: number
): string {
  return (
    '{' +
    `"mappingId":${JSON.stringify(mappingId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"chargeId":${JSON.stringify(input.chargeId)},` +
    `"instructionNumber":${JSON.stringify(input.instructionNumber)},` +
    `"elementResults":${JSON.stringify(input.elementResults)},` +
    `"totalElements":${totalElements},` +
    `"matchedElements":${matchedElements},` +
    `"unmatchedElements":${unmatchedElements}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Charge Element Mapping Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete charge element mapping entity.
 *
 * Counts matched/unmatched elements deterministically.
 * Two-pass hash derivation.
 *
 * Deterministic — same input always produces same output.
 */
export async function buildChargeElementMappingEntity(
  input: ChargeElementMappingInput
): Promise<ChargeElementMappingEntity> {
  const totalElements = input.elementResults.length;
  let matchedElements = 0;
  let unmatchedElements = 0;

  for (let i = 0; i < input.elementResults.length; i++) {
    if (input.elementResults[i].unmatched) {
      unmatchedElements++;
    } else {
      matchedElements++;
    }
  }

  const preIdCanonical = canonicalizeMappingPreId(input);
  const mappingId = await computeTextSHA256(preIdCanonical);
  const fullCanonical = canonicalizeMappingFull(
    mappingId, input, totalElements, matchedElements, unmatchedElements
  );
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    mappingId,
    caseId: input.caseId,
    chargeId: input.chargeId,
    instructionNumber: input.instructionNumber,
    elementResults: input.elementResults,
    totalElements,
    matchedElements,
    unmatchedElements,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Charge Element Mapping Entity — replay verification
// ---------------------------------------------------------------------------

export async function verifyChargeElementMappingEntity(
  entity: ChargeElementMappingEntity
): Promise<{
  mappingIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: ChargeElementMappingInput = {
    caseId: entity.caseId,
    chargeId: entity.chargeId,
    instructionNumber: entity.instructionNumber,
    elementResults: entity.elementResults,
  };

  const preIdCanonical = canonicalizeMappingPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const mappingIdMatch = recomputedId === entity.mappingId ? 'PASS' : 'FAIL';

  const fullCanonical = canonicalizeMappingFull(
    entity.mappingId, input, entity.totalElements, entity.matchedElements, entity.unmatchedElements
  );
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    mappingIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return { mappingIdMatch, sha256Match, sha3_256Match, overallResult };
}
