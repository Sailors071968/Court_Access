// ============================================
// Court Access — Media Alignment Engine (Phase 11)
// Audio/Video to Report Alignment
//
// Creates deterministic timestamp-to-report mapping.
// No interpretation of tone. No claims about demeanor.
// No claims of contradiction.
//
// This engine:
//   - Tokenizes report statements and transcript segments
//   - Compares token sequences deterministically
//   - Detects description differences (binary)
//   - Builds dual-hashed alignment entities
//   - Does NOT interpret tone
//   - Does NOT claim demeanor
//   - Only outputs: "Description differs."
//
// Allowed phrasing only:
//   "Description differs."
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
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction / strategy
//   - No credibility analysis / intent inference
//   - No tone interpretation / demeanor claims
//   - No "likely" / "appears to" / "suggests" / "indicates"
//   - No "weak" / "strong" / "contradiction" / "violation"
//   - Deterministic processing only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  TranscriptSegment,
  MediaAlignmentResult,
  MediaAlignmentEntity,
  MediaAlignmentInput,
  ReportStatementSegment,
} from '../models/MediaAlignmentModel';

// ---------------------------------------------------------------------------
// Tokenize Text — whitespace-split
// ---------------------------------------------------------------------------

/**
 * Split text into tokens at whitespace boundaries.
 * Deterministic. No stemming. No normalization.
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
// Build Report Statement Segment
// ---------------------------------------------------------------------------

/**
 * Build a report statement segment from raw text and citation.
 * Deterministic tokenization.
 */
export function buildReportStatementSegment(
  reportCitation: string,
  rawText: string
): ReportStatementSegment {
  return {
    reportCitation,
    tokens: tokenizeText(rawText),
    rawText,
  };
}

// ---------------------------------------------------------------------------
// Align Report Statement to Transcript — description difference detection
// ---------------------------------------------------------------------------

/**
 * Align a report statement to the best-matching transcript segment.
 *
 * Matching rule: find the transcript segment with the most token overlap.
 * If the best match does not contain all report tokens as a subsequence,
 * description differs.
 *
 * No tone interpretation. No demeanor claims.
 * Only: descriptionDifference = true/false.
 *
 * Deterministic — same inputs always produce same result.
 */
export function alignReportToTranscript(
  report: ReportStatementSegment,
  transcriptSegments: readonly TranscriptSegment[]
): MediaAlignmentResult {
  let bestMatchIndex = -1;
  let bestOverlap = -1;

  for (let t = 0; t < transcriptSegments.length; t++) {
    const transcriptTokens = tokenizeText(transcriptSegments[t].text);

    // Count token overlap (order-preserving subsequence match)
    let rIdx = 0;
    for (let tt = 0; tt < transcriptTokens.length && rIdx < report.tokens.length; tt++) {
      if (transcriptTokens[tt] === report.tokens[rIdx]) {
        rIdx++;
      }
    }

    if (rIdx > bestOverlap) {
      bestOverlap = rIdx;
      bestMatchIndex = t;
    }
  }

  // If no transcript segments exist
  if (bestMatchIndex < 0) {
    return {
      reportCitation: report.reportCitation,
      transcriptTimestamp: '',
      descriptionDifference: true,
    };
  }

  // Description differs if not all report tokens matched as subsequence
  const descriptionDifference = bestOverlap < report.tokens.length;

  return {
    reportCitation: report.reportCitation,
    transcriptTimestamp: transcriptSegments[bestMatchIndex].startTime,
    descriptionDifference,
  };
}

// ---------------------------------------------------------------------------
// Batch Align — all report statements against transcript
// ---------------------------------------------------------------------------

/**
 * Align multiple report statements against transcript segments.
 *
 * Each report statement is aligned to the best-matching transcript segment.
 * Results ordered by reportCitation (ASCII).
 *
 * Deterministic — same inputs always produce same results.
 */
export function batchAlignReportToTranscript(
  reportSegments: readonly ReportStatementSegment[],
  transcriptSegments: readonly TranscriptSegment[]
): MediaAlignmentResult[] {
  const results: MediaAlignmentResult[] = [];

  for (let r = 0; r < reportSegments.length; r++) {
    results.push(alignReportToTranscript(reportSegments[r], transcriptSegments));
  }

  // Sort by reportCitation for deterministic ordering
  results.sort(function sortByReport(a: MediaAlignmentResult, b: MediaAlignmentResult): number {
    if (a.reportCitation < b.reportCitation) { return -1; }
    if (a.reportCitation > b.reportCitation) { return 1; }
    return 0;
  });

  return results;
}

// ---------------------------------------------------------------------------
// Canonicalize Media Alignment Pre-ID Form
// ---------------------------------------------------------------------------

function canonicalizeAlignmentPreId(input: MediaAlignmentInput): string {
  return (
    '{' +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"mediaSourceId":${JSON.stringify(input.mediaSourceId)},` +
    `"results":${JSON.stringify(input.results)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Media Alignment Full Form
// ---------------------------------------------------------------------------

function canonicalizeAlignmentFull(
  alignmentId: string,
  input: MediaAlignmentInput,
  totalAlignments: number,
  differencesDetected: number
): string {
  return (
    '{' +
    `"alignmentId":${JSON.stringify(alignmentId)},` +
    `"caseId":${JSON.stringify(input.caseId)},` +
    `"mediaSourceId":${JSON.stringify(input.mediaSourceId)},` +
    `"results":${JSON.stringify(input.results)},` +
    `"totalAlignments":${totalAlignments},` +
    `"differencesDetected":${differencesDetected}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Media Alignment Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete media alignment entity.
 *
 * Counts total alignments and differences deterministically.
 * Two-pass hash derivation.
 *
 * Deterministic — same input always produces same output.
 */
export async function buildMediaAlignmentEntity(
  input: MediaAlignmentInput
): Promise<MediaAlignmentEntity> {
  const totalAlignments = input.results.length;
  let differencesDetected = 0;

  for (let i = 0; i < input.results.length; i++) {
    if (input.results[i].descriptionDifference) {
      differencesDetected++;
    }
  }

  const preIdCanonical = canonicalizeAlignmentPreId(input);
  const alignmentId = await computeTextSHA256(preIdCanonical);
  const fullCanonical = canonicalizeAlignmentFull(
    alignmentId, input, totalAlignments, differencesDetected
  );
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    alignmentId,
    caseId: input.caseId,
    mediaSourceId: input.mediaSourceId,
    results: input.results,
    totalAlignments,
    differencesDetected,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Media Alignment Entity — replay verification
// ---------------------------------------------------------------------------

export async function verifyMediaAlignmentEntity(
  entity: MediaAlignmentEntity
): Promise<{
  alignmentIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: MediaAlignmentInput = {
    caseId: entity.caseId,
    mediaSourceId: entity.mediaSourceId,
    results: entity.results,
  };

  const preIdCanonical = canonicalizeAlignmentPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const alignmentIdMatch = recomputedId === entity.alignmentId ? 'PASS' : 'FAIL';

  const fullCanonical = canonicalizeAlignmentFull(
    entity.alignmentId, input, entity.totalAlignments, entity.differencesDetected
  );
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    alignmentIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return { alignmentIdMatch, sha256Match, sha3_256Match, overallResult };
}
