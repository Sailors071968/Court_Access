// ============================================
// Court Access — CALCRIM Mapping Model (Phase 9)
// Charge Element Cross-Reference Matrix
//
// Defines types for mechanically mapping charge elements
// to case documentation. No strategy. No inference.
// No outcome commentary.
//
// This is documentation intelligence infrastructure:
//   - Structured CALCRIM element database
//   - Element-by-element mapping to documents
//   - Gap detection (unmatched elements)
//   - No legal advice
//   - No "weakness" statements
//   - Only: "No citation located in uploaded documents."
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
//   - No "likely" / "appears to" / "suggests"
//   - No "weak" / "strong" / "contradiction" / "violation"
//   - Deterministic processing
//   - Two-pass hash derivation
// ============================================

// ---------------------------------------------------------------------------
// CALCRIM Element — verbatim instruction element
// ---------------------------------------------------------------------------

/**
 * A single element from a CALCRIM jury instruction.
 *
 * No paraphrasing allowed.
 * verbatimText must be exact text from CALCRIM instruction.
 */
export interface CalcrimElement {
  instructionNumber: string;                 // e.g. "520", "187"
  elementNumber: number;                     // 1-indexed element within instruction
  verbatimText: string;                      // Exact CALCRIM text — no paraphrasing
}

// ---------------------------------------------------------------------------
// CALCRIM Instruction — collection of elements
// ---------------------------------------------------------------------------

/**
 * A complete CALCRIM instruction with all elements.
 */
export interface CalcrimInstruction {
  instructionNumber: string;
  title: string;                             // Instruction title (verbatim)
  elements: CalcrimElement[];                // Ordered by elementNumber
}

// ---------------------------------------------------------------------------
// Element Mapping Result
// ---------------------------------------------------------------------------

/**
 * Result of mapping a single CALCRIM element to case documents.
 *
 * matchedCitations: specific document citations where element is referenced
 * unmatched: true if no citation located in uploaded documents
 *
 * If unmatched === true:
 *   Output: "No citation located in uploaded documents."
 * No commentary. No "weakness" statement.
 */
export interface ElementMappingResult {
  instructionNumber: string;
  elementNumber: number;
  elementText: string;                       // Verbatim CALCRIM element text
  matchedCitations: string[];                // Document citations
  unmatched: boolean;                        // true = no citation located
}

// ---------------------------------------------------------------------------
// Charge Element Mapping Entity — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of charge-to-element mapping for a case.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> mappingId
 *   Pass 2: full canonical -> dual-hash
 *
 * Append-only. No update. No delete.
 */
export interface ChargeElementMappingEntity {
  mappingId: string;                         // SHA-256 of canonical pre-ID form
  caseId: string;
  chargeId: string;
  instructionNumber: string;
  elementResults: ElementMappingResult[];
  totalElements: number;
  matchedElements: number;
  unmatchedElements: number;
  sha256: string;
  sha3_256: string;
}

// ---------------------------------------------------------------------------
// Charge Element Mapping Input
// ---------------------------------------------------------------------------

/**
 * Input for creating a charge element mapping entity.
 */
export interface ChargeElementMappingInput {
  caseId: string;
  chargeId: string;
  instructionNumber: string;
  elementResults: ElementMappingResult[];
}
