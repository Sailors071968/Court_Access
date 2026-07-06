// ============================================
// Court Access — Structured Issue Index Model (Phase 8)
// Canonical Issue Extraction + Normalized Variation Registry
//
// Defines types for the deterministic, cross-document
// issue registry that extracts variations mechanically.
//
// This is documentation intelligence infrastructure:
//   - Extracts variations mechanically
//   - Classifies variation types
//   - Assigns issue IDs (SHA-256 derived)
//   - Normalizes references
//   - Produces attorney-ready structured output
//   - Does NOT interpret intent
//   - Does NOT suggest strategy
//   - Does NOT make accusations
//
// Architectural boundary:
//   - Does NOT import any engine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of historical entries
//   - No deletion
//   - Append-only discipline
//   - Deterministic processing
//   - Two-pass hash derivation
//   - No legal advice
//   - No outcome prediction
//   - No strategy suggestions
//   - No credibility analysis
//   - No intent inference
// ============================================

// ---------------------------------------------------------------------------
// Issue Category — mechanically derived classification
// ---------------------------------------------------------------------------

/**
 * Classification of detected variations.
 *
 * Each issue must be mechanically derived from document comparison.
 * No interpretation. No intent inference. No credibility analysis.
 *
 * TIMELINE_VARIATION           — timestamps or sequences differ between documents
 * LANGUAGE_DIFFERENCE          — wording differs between documents
 * ELEMENT_GAP                  — CALCRIM element not matched in uploaded documents
 * POLICY_REFERENCE_GAP         — policy section not referenced in conduct description
 * MEDIA_DESCRIPTION_DIFFERENCE — description differs between media transcript and report
 * OMISSION_FLAG                — information present in one document absent in another
 */
export type IssueCategory =
  | 'TIMELINE_VARIATION'
  | 'LANGUAGE_DIFFERENCE'
  | 'ELEMENT_GAP'
  | 'POLICY_REFERENCE_GAP'
  | 'MEDIA_DESCRIPTION_DIFFERENCE'
  | 'OMISSION_FLAG';

// ---------------------------------------------------------------------------
// Structured Issue Entity — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of a mechanically detected issue.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical (excludes issueId, sha256, sha3_256) -> issueId
 *   Pass 2: full canonical (includes issueId, excludes sha256, sha3_256) -> dual-hash
 *
 * descriptionText: direct quotation only — no adjectives added, no conclusions
 * comparisonText: structured difference only — no narrative summary
 *
 * Append-only. No update. No delete.
 */
export interface StructuredIssueEntity {
  issueId: string;                           // SHA-256 of canonical pre-ID form (64 hex chars)
  caseId: string;
  category: IssueCategory;
  sourceDocumentIds: string[];               // Document IDs where variation detected
  citationReferences: string[];              // Specific citation locations
  descriptionText: string;                   // Direct quotation only
  comparisonText: string;                    // Structured difference only
  sha256: string;                            // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                          // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Structured Issue Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a new structured issue entity.
 *
 * The caller provides all fields except:
 *   - issueId (derived from canonical form)
 *   - sha256 / sha3_256 (computed from canonical form)
 */
export interface StructuredIssueInput {
  caseId: string;
  category: IssueCategory;
  sourceDocumentIds: string[];
  citationReferences: string[];
  descriptionText: string;
  comparisonText: string;
}

// ---------------------------------------------------------------------------
// Token-Aligned Segment — for comparison
// ---------------------------------------------------------------------------

/**
 * A segment of text aligned at token boundaries for comparison.
 * Used by the issue builder to detect variations mechanically.
 */
export interface TokenAlignedSegment {
  documentId: string;
  segmentIndex: number;
  tokens: string[];                          // Whitespace-split tokens
  rawText: string;
}

// ---------------------------------------------------------------------------
// Variation Detection Result
// ---------------------------------------------------------------------------

/**
 * Result of comparing two token-aligned segments.
 *
 * missingTerms: tokens present in one segment but absent in the other
 * differingTokenIndices: indices where tokens differ
 */
export interface VariationDetectionResult {
  segmentIndexA: number;
  segmentIndexB: number;
  documentIdA: string;
  documentIdB: string;
  missingTerms: string[];
  differingTokenIndices: number[];
  variationDetected: boolean;
}

// ---------------------------------------------------------------------------
// Issue Merge Record
// ---------------------------------------------------------------------------

/**
 * Record of deterministic issue merging.
 *
 * When multiple documents produce the same variation,
 * they are merged under the same issueId.
 * Deterministic merge rules — no fuzzy merging.
 */
export interface IssueMergeRecord {
  primaryIssueId: string;
  mergedIssueIds: string[];
  mergeReason: string;                       // Deterministic reason
}
