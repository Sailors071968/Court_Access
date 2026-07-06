// ============================================
// Court Access — Output Constitution Model (Phase 17)
// Output Constitutional Enforcement Layer
//
// Central output validation firewall.
// Before any AI-generated or derived output is displayed
// or exported: validate structure, citations, phrasing,
// forbidden language, section order, deterministic ordering.
//
// If violation → BLOCK output.
//
// Architectural boundary:
//   - Does NOT import any engine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction
//   - No credibility analysis / intent inference
//   - Deterministic processing
// ============================================

// ---------------------------------------------------------------------------
// Output Envelope — wraps all displayable output
// ---------------------------------------------------------------------------

export type OutputType =
  | 'ISSUE_INDEX'
  | 'CALCRIM_MAPPING'
  | 'POLICY_COMPARISON'
  | 'MEDIA_ALIGNMENT'
  | 'PORTFOLIO'
  | 'EXPORT';

export interface OutputEnvelope {
  outputType: OutputType;
  payload: unknown;
  citationCount: number;
  modelVersion: string;
}

// ---------------------------------------------------------------------------
// Forbidden Language Scan Result
// ---------------------------------------------------------------------------

export interface ForbiddenLanguageScanResult {
  status: 'PASS' | 'FAIL';
  matchedTerms: string[];
}

// ---------------------------------------------------------------------------
// Section Order — required ordering for structured exports
// ---------------------------------------------------------------------------

export const REQUIRED_SECTION_ORDER: readonly string[] = [
  'ISSUE_INDEX',
  'CALCRIM_MAPPING',
  'POLICY_COMPARISON',
  'MEDIA_ALIGNMENT',
  'SNAPSHOT_METADATA',
];

// ---------------------------------------------------------------------------
// Output Constitution Result
// ---------------------------------------------------------------------------

export interface OutputConstitutionResult {
  forbiddenLanguageStatus: 'PASS' | 'FAIL';
  citationStatus: 'PASS' | 'FAIL';
  sectionOrderStatus: 'PASS' | 'FAIL';
  overallStatus: 'PASS' | 'FAIL';
  matchedForbiddenTerms: string[];
}
