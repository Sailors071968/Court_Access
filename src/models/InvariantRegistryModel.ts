// ============================================
// Court Access — Invariant Registry Model (Phase 14)
// Structural Drift Detector (CI Invariant Enforcement Layer)
//
// Defines the immutable invariant registry schema, canonical
// invariant encoding, and CI validation structures.
//
// This layer prevents gradual erosion of constitutional doctrine
// by enforcing structural invariants at build time.
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of invariant registry
//   - No soft warnings
//   - No downgrade path
//   - No dynamic invariant removal
//   - Additive-only invariant expansion
//   - Binary PASS/FAIL only
//   - ASCII comparator only
// ============================================

// ---------------------------------------------------------------------------
// Invariant Category
// ---------------------------------------------------------------------------

/**
 * Categories of structural invariants.
 * Each category represents a class of constitutional rule.
 * Additive-only — new categories may be added, none removed.
 */
export type InvariantCategory =
  | 'FORBIDDEN_CONSTRUCT'       // Banned code constructs (e.g., localeCompare, Date.now)
  | 'FORBIDDEN_KEYWORD'         // Banned keywords in engine output (e.g., "likely", "score")
  | 'REQUIRED_PATTERN'          // Required structural patterns (e.g., ASCII comparator)
  | 'IMPORT_BOUNDARY'           // Forbidden cross-layer imports
  | 'MUTATION_GUARD'            // Forbidden mutation operations (update, delete)
  | 'ENTROPY_GUARD'             // Forbidden randomness sources (Math.random, crypto.random)
  | 'TEMPORAL_GUARD'            // Forbidden non-deterministic time sources (Date.now, new Date)
  | 'HASH_DISCIPLINE';          // Hash format enforcement (raw hex, no prefixes)

// ---------------------------------------------------------------------------
// Invariant Severity
// ---------------------------------------------------------------------------

/**
 * Invariant severity is always BLOCK.
 * No warning-only mode. No soft bypass. No downgrade path.
 */
export type InvariantSeverity = 'BLOCK';

// ---------------------------------------------------------------------------
// Invariant Entry
// ---------------------------------------------------------------------------

/**
 * A single invariant entry in the registry.
 *
 * Each entry defines:
 *   - invariantId: unique identifier (deterministic, derived from canonical fields)
 *   - category: the invariant category
 *   - description: human-readable description of the invariant
 *   - pattern: the exact string or token pattern to detect
 *   - patternType: how the pattern is matched:
 *       'TOKEN_EXACT'    — exact token sequence (word boundaries)
 *       'SUBSTRING'      — exact substring match in source text
 *       'IMPORT_PATH'    — forbidden import path segment
 *   - scope: which files this invariant applies to:
 *       'ALL'            — all source files
 *       'ENGINES'        — *Engine.ts files only
 *       'SERVICES'       — *Service.ts files only
 *       'MODELS'         — *Model.ts files only
 *   - severity: always 'BLOCK'
 *   - registeredEpoch: when this invariant was added (additive-only)
 *
 * Invariants are matched deterministically.
 * No regex patterns. No fuzzy matching. No probabilistic detection.
 */
export interface InvariantEntry {
  invariantId: string;
  category: InvariantCategory;
  description: string;
  pattern: string;
  patternType: 'TOKEN_EXACT' | 'SUBSTRING' | 'IMPORT_PATH';
  scope: 'ALL' | 'ENGINES' | 'SERVICES' | 'MODELS';
  severity: InvariantSeverity;
  registeredEpoch: number;
}

// ---------------------------------------------------------------------------
// Invariant Registry
// ---------------------------------------------------------------------------

/**
 * The immutable invariant registry.
 * Static, deterministic, additive-only.
 *
 * Rules:
 *   - Entries are sorted by invariantId (ASCII comparator)
 *   - Entries may only be added, never removed or modified
 *   - No downgrade path — once an invariant is registered, it stays
 *   - No dynamic removal at runtime
 *   - Registry version increments on each addition
 *   - Registry is frozen at runtime
 */
export interface InvariantRegistry {
  entries: InvariantEntry[];
  registryVersion: number;
  registryEpoch: number;
}

// ---------------------------------------------------------------------------
// Violation Record — single invariant breach
// ---------------------------------------------------------------------------

/**
 * A single invariant violation record.
 *
 * Records:
 *   - Which invariant was breached
 *   - Which file contained the violation
 *   - Which line number
 *   - The matched text (exact match, not inferred)
 *
 * No interpretive commentary. Structural fact only.
 */
export interface InvariantViolation {
  invariantId: string;
  category: InvariantCategory;
  filePath: string;
  lineNumber: number;
  matchedText: string;
  description: string;
}

// ---------------------------------------------------------------------------
// File Scan Result — per-file binary
// ---------------------------------------------------------------------------

/**
 * Result of scanning a single file against the invariant registry.
 *
 * result: PASS if zero violations, FAIL if any violations detected.
 * Binary only. No scoring.
 */
export interface FileScanResult {
  filePath: string;
  result: 'PASS' | 'FAIL';
  violations: InvariantViolation[];
}

// ---------------------------------------------------------------------------
// Cross-File Scan Result — aggregate binary
// ---------------------------------------------------------------------------

/**
 * Result of scanning multiple files against the invariant registry.
 *
 * overallResult: PASS only if ALL files pass.
 * No partial pass. Binary only.
 */
export interface CrossFileScanResult {
  files: FileScanResult[];
  overallResult: 'PASS' | 'FAIL';
  totalViolations: number;
  filesScanned: number;
  invariantsChecked: number;
}

// ---------------------------------------------------------------------------
// CI Build Gate Result
// ---------------------------------------------------------------------------

/**
 * Result of CI build gate enforcement.
 *
 * Binary only: PASS or FAIL.
 * If FAIL, build MUST be blocked. No soft pass.
 * No warning-only mode. No bypass flag.
 */
export interface CIBuildGateResult {
  result: 'PASS' | 'FAIL';
  violatingFiles: string[];
  totalViolations: number;
  registryVersion: number;
}

// ---------------------------------------------------------------------------
// Invariant Field Validation — per-check binary
// ---------------------------------------------------------------------------

/**
 * Single invariant check for registry integrity verification.
 * Binary only: PASS or FAIL.
 */
export interface InvariantFieldValidation {
  field: string;
  result: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Registry Integrity Result
// ---------------------------------------------------------------------------

/**
 * Result of verifying the invariant registry's own structural integrity.
 * Overall: PASS only if ALL checks pass.
 */
export interface RegistryIntegrityResult {
  fields: InvariantFieldValidation[];
  overallResult: 'PASS' | 'FAIL';
}
