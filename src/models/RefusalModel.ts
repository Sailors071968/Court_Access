// ============================================
// Court Access — Refusal Model (Phase 19)
// Structured Refusal Integrity Engine
//
// Standardizes AI refusal logic.
// Deterministic keyword detection for prohibited requests.
//
// Architectural boundary:
//   - Does NOT import any engine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction
//   - Deterministic processing
//   - Two-pass hash derivation
// ============================================

// ---------------------------------------------------------------------------
// Refusal Reason Type
// ---------------------------------------------------------------------------

export type RefusalReason =
  | 'INSUFFICIENT_DATA'
  | 'LEGAL_ADVICE_REQUEST'
  | 'OUTCOME_PREDICTION_REQUEST'
  | 'OCR_CONFIDENCE_LOW'
  | 'MOTIVE_ANALYSIS_REQUEST'
  | 'CREDIBILITY_ANALYSIS_REQUEST';

// ---------------------------------------------------------------------------
// Refusal Entity — immutable, dual-hashed
// ---------------------------------------------------------------------------

/**
 * Immutable record of a structured refusal.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> refusalId
 *   Pass 2: full canonical -> dual-hash
 */
export interface RefusalEntity {
  refusalId: string;               // SHA-256 of canonical pre-ID form
  tenantId: string;
  caseId: string;
  requestText: string;
  refusalReason: RefusalReason;
  createdTimestamp: string;        // ISO 8601, caller-provided
  sha256: string;
  sha3_256: string;
}

// ---------------------------------------------------------------------------
// Refusal Input
// ---------------------------------------------------------------------------

export interface RefusalInput {
  tenantId: string;
  caseId: string;
  requestText: string;
  refusalReason: RefusalReason;
  createdTimestamp: string;
}

// ---------------------------------------------------------------------------
// Refusal Trigger Scan Result
// ---------------------------------------------------------------------------

export interface RefusalTriggerScanResult {
  triggered: boolean;
  matchedReason: RefusalReason | null;
  matchedTerm: string | null;
}
