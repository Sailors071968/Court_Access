// ============================================
// Court Access — Forbidden Phrase Model (Phase 13)
// Interpretation Guard Layer (FOIL Enforcement Engine)
//
// Defines the forbidden phrase registry, violation structures,
// and validation matrix for epistemic boundary enforcement.
//
// FOIL = Facts Only, Interpretation Limited
//
// This layer prevents interpretive, probabilistic, speculative,
// or inferential language from entering Court Access outputs.
// Court Access produces structural facts only — never opinions,
// predictions, likelihoods, or recommendations.
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No ranking
//   - No anomaly detection
//   - No likelihood
//   - No confidence
//   - No prediction
//   - No intent inference
//   - No interpretive language
//   - No ML classification
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - Additive-only rule registry
//   - No downgrade path
//   - No silent bypass flag
//   - Binary PASS/FAIL only
// ============================================

// ---------------------------------------------------------------------------
// Forbidden Phrase Category
// ---------------------------------------------------------------------------

/**
 * Categories of forbidden phrases.
 * Each category represents a class of epistemic violation.
 * Additive-only — new categories may be added, none removed.
 */
export type ForbiddenPhraseCategory =
  | 'PROBABILISTIC'        // "likely", "probably", "chance", "odds"
  | 'SPECULATIVE'          // "might", "could", "possibly", "perhaps"
  | 'INFERENTIAL'          // "suggests", "implies", "indicates", "appears"
  | 'INTERPRETIVE'         // "seems", "looks like", "in my opinion"
  | 'PREDICTIVE'           // "will likely", "expected to", "forecast"
  | 'SCORING'              // "score", "rating", "confidence level"
  | 'RECOMMENDATION'       // "should", "recommend", "advise", "consider"
  | 'ANOMALY'              // "unusual", "anomalous", "outlier", "suspicious"
  | 'INTENT'               // "intended", "meant to", "trying to"
  | 'SENTIMENT';           // "positive", "negative" (when used as assessment)

// ---------------------------------------------------------------------------
// Forbidden Phrase Entry
// ---------------------------------------------------------------------------

/**
 * A single forbidden phrase entry in the registry.
 *
 * Each entry defines:
 *   - phrase: the exact lowercase token sequence to match
 *   - category: the epistemic violation category
 *   - registeredEpoch: when this phrase was added (additive-only)
 *   - severity: always 'BLOCK' — no warning-only mode, no soft bypass
 *
 * Matching rules:
 *   - Phrases are matched as token sequences (word boundaries)
 *   - Matching is case-insensitive (text normalized to lowercase before scan)
 *   - No regex patterns — exact token sequence matching only
 *   - No fuzzy matching — deterministic exact match
 */
export interface ForbiddenPhraseEntry {
  phrase: string;                      // Exact lowercase token sequence
  category: ForbiddenPhraseCategory;
  registeredEpoch: number;             // Epoch when phrase was registered
  severity: 'BLOCK';                   // Always BLOCK — no soft bypass
}

// ---------------------------------------------------------------------------
// Forbidden Phrase Registry
// ---------------------------------------------------------------------------

/**
 * The forbidden phrase registry.
 * Static, deterministic, additive-only.
 *
 * Rules:
 *   - Entries are sorted by phrase (ASCII comparator)
 *   - Entries may only be added, never removed or modified
 *   - No downgrade path — once a phrase is forbidden, it stays forbidden
 *   - No silent bypass flag
 *   - Registry version increments on each addition
 */
export interface ForbiddenPhraseRegistry {
  entries: ForbiddenPhraseEntry[];
  registryVersion: number;
  registryEpoch: number;
}

// ---------------------------------------------------------------------------
// Token — structural unit for text analysis
// ---------------------------------------------------------------------------

/**
 * A single token extracted from text.
 * Tokens are the structural unit for phrase matching.
 *
 * position: zero-based index of the token in the token array
 * value: the lowercase normalized token string
 */
export interface TextToken {
  position: number;
  value: string;
}

// ---------------------------------------------------------------------------
// Violation Record — single forbidden phrase match
// ---------------------------------------------------------------------------

/**
 * A single violation record — one forbidden phrase match.
 *
 * Records the exact location and matched phrase.
 * No interpretive commentary. Structural fact only.
 */
export interface ViolationRecord {
  phrase: string;                      // The matched forbidden phrase
  category: ForbiddenPhraseCategory;
  tokenStartPosition: number;          // Start token index (zero-based)
  tokenEndPosition: number;            // End token index (exclusive)
  matchedText: string;                 // The exact text that matched (from original tokens)
}

// ---------------------------------------------------------------------------
// Text Validation Result — binary PASS/FAIL
// ---------------------------------------------------------------------------

/**
 * Result of validating a text against the forbidden phrase registry.
 *
 * result: PASS if zero violations, FAIL if any violations detected.
 * Binary only. No scoring. No confidence. No severity ranking.
 *
 * violations: array of all matched forbidden phrases (empty if PASS).
 * tokenCount: total tokens in the analyzed text.
 * phrasesChecked: total forbidden phrases in registry.
 */
export interface TextValidationResult {
  result: 'PASS' | 'FAIL';
  violations: ViolationRecord[];
  tokenCount: number;
  phrasesChecked: number;
}

// ---------------------------------------------------------------------------
// Validation Field Result — per-field binary
// ---------------------------------------------------------------------------

/**
 * Single field validation for interpretation guard.
 * Binary only: PASS or FAIL.
 */
export interface GuardFieldValidation {
  field: string;
  result: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Guard Validation Matrix — overall binary
// ---------------------------------------------------------------------------

/**
 * Validation matrix for interpretation guard checks.
 * Overall: PASS only if ALL fields pass.
 * No partial pass. Binary only.
 */
export interface GuardValidationMatrix {
  fields: GuardFieldValidation[];
  overallResult: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// CI Enforcement Result
// ---------------------------------------------------------------------------

/**
 * Result of CI enforcement check.
 * Used by build/CI pipeline to gate outputs.
 *
 * Binary only: PASS or FAIL.
 * If FAIL, violatingFields lists which fields contain violations.
 * No soft pass. No warning-only mode.
 */
export interface CIEnforcementResult {
  result: 'PASS' | 'FAIL';
  violatingFields: string[];
  totalViolations: number;
}
