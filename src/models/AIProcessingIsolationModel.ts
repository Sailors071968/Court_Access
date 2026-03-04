// ============================================
// Court Access — AI Processing Isolation Model (Phase 23)
// AI Processing Isolation Layer
//
// Prevents AI cross-session contamination.
// Enforces RAG isolation, embedding namespace isolation,
// and token budget limits.
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
// ============================================

// ---------------------------------------------------------------------------
// Embedding Namespace — tenant + case scoped
// ---------------------------------------------------------------------------

/**
 * Embedding namespace scoped to tenant and case.
 *
 * Format: tenantId_caseId_namespace
 * No global embedding search allowed.
 */
export interface EmbeddingNamespace {
  tenantId: string;
  caseId: string;
  namespace: string;
  fullNamespace: string;           // tenantId_caseId_namespace
}

// ---------------------------------------------------------------------------
// RAG Isolation Validation Result
// ---------------------------------------------------------------------------

/**
 * Result of validating RAG retrieval isolation.
 *
 * Binary PASS/FAIL.
 */
export interface RAGIsolationResult {
  namespaceScopeStatus: 'PASS' | 'FAIL';
  tenantMatchStatus: 'PASS' | 'FAIL';
  caseMatchStatus: 'PASS' | 'FAIL';
  overallStatus: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Token Budget Configuration
// ---------------------------------------------------------------------------

/**
 * Token budget configuration for AI processing.
 *
 * Hard cap on token input size.
 * Binary FAIL if exceeded.
 */
export interface TokenBudgetConfig {
  maxInputTokens: number;
  maxOutputTokens: number;
}

// ---------------------------------------------------------------------------
// Token Budget Validation Result
// ---------------------------------------------------------------------------

export interface TokenBudgetResult {
  inputTokenCount: number;
  maxInputTokens: number;
  inputStatus: 'PASS' | 'FAIL';
  outputTokenCount: number;
  maxOutputTokens: number;
  outputStatus: 'PASS' | 'FAIL';
  overallStatus: 'PASS' | 'FAIL';
}
