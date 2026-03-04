// ============================================
// Court Access — Media Alignment Model (Phase 11)
// Audio/Video to Report Alignment
//
// Defines types for deterministic timestamp-to-report mapping.
//
// This is documentation intelligence infrastructure:
//   - No interpretation of tone
//   - No claims about demeanor
//   - No claims of contradiction
//   - Only: "Description differs."
//
// Architectural boundary:
//   - Does NOT import any engine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction / strategy
//   - No credibility analysis / intent inference
//   - No tone interpretation / demeanor claims
//   - No "likely" / "appears to" / "suggests"
//   - No "weak" / "strong" / "contradiction" / "violation"
//   - Deterministic processing
//   - Two-pass hash derivation
// ============================================

// ---------------------------------------------------------------------------
// Transcript Segment
// ---------------------------------------------------------------------------

/**
 * A segment of audio/video transcript with timestamps.
 * No interpretation of tone. No demeanor claims.
 */
export interface TranscriptSegment {
  startTime: string;                         // Timestamp format: "HH:MM:SS" or ISO 8601
  endTime: string;
  text: string;                              // Verbatim transcript text
}

// ---------------------------------------------------------------------------
// Media Alignment Result
// ---------------------------------------------------------------------------

/**
 * Result of aligning a report statement to a transcript segment.
 *
 * descriptionDifference: true if description differs between
 * report and transcript.
 *
 * Only allowed phrase: "Description differs."
 * No claims of contradiction. No tone interpretation.
 */
export interface MediaAlignmentResult {
  reportCitation: string;                    // Citation to report statement
  transcriptTimestamp: string;               // Timestamp of matched transcript segment
  descriptionDifference: boolean;            // true = description differs
}

// ---------------------------------------------------------------------------
// Media Alignment Entity — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of media-to-report alignment for a case.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> alignmentId
 *   Pass 2: full canonical -> dual-hash
 *
 * Append-only. No update. No delete.
 */
export interface MediaAlignmentEntity {
  alignmentId: string;                       // SHA-256 of canonical pre-ID form
  caseId: string;
  mediaSourceId: string;
  results: MediaAlignmentResult[];
  totalAlignments: number;
  differencesDetected: number;
  sha256: string;
  sha3_256: string;
}

// ---------------------------------------------------------------------------
// Media Alignment Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a media alignment entity.
 */
export interface MediaAlignmentInput {
  caseId: string;
  mediaSourceId: string;
  results: MediaAlignmentResult[];
}

// ---------------------------------------------------------------------------
// Report Statement Segment
// ---------------------------------------------------------------------------

/**
 * A segment of a report statement with citation reference.
 * Used for alignment against transcript segments.
 */
export interface ReportStatementSegment {
  reportCitation: string;
  tokens: string[];
  rawText: string;
}
