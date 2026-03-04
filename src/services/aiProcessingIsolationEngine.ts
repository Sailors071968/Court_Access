// ============================================
// Court Access — AI Processing Isolation Engine (Phase 23)
// AI Processing Isolation Layer
//
// Prevents AI cross-session contamination.
// Enforces RAG isolation, embedding namespace isolation,
// and token budget limits.
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - No side effects
//
// Architectural boundary:
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access
//   - No SES calls
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction
//   - Deterministic processing only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type {
  EmbeddingNamespace,
  RAGIsolationResult,
  TokenBudgetConfig,
  TokenBudgetResult,
} from '../models/AIProcessingIsolationModel';

// ---------------------------------------------------------------------------
// Build Embedding Namespace — deterministic
// ---------------------------------------------------------------------------

/**
 * Build a scoped embedding namespace for a tenant + case.
 *
 * Format: tenantId_caseId_namespace
 * Deterministic — same inputs always produce same output.
 */
export function buildEmbeddingNamespace(
  tenantId: string,
  caseId: string,
  namespace: string
): EmbeddingNamespace {
  return {
    tenantId,
    caseId,
    namespace,
    fullNamespace: tenantId + '_' + caseId + '_' + namespace,
  };
}

// ---------------------------------------------------------------------------
// Validate RAG Isolation
// ---------------------------------------------------------------------------

/**
 * Validate that RAG retrieval is scoped to the correct tenant and case.
 *
 * Checks:
 *   1. Namespace scope matches expected format
 *   2. Tenant ID matches
 *   3. Case ID matches
 *
 * Binary PASS/FAIL per check + overall.
 * Deterministic — same inputs always produce same result.
 */
export function validateRAGIsolation(
  expectedTenantId: string,
  expectedCaseId: string,
  embeddingNamespace: EmbeddingNamespace
): RAGIsolationResult {
  const expectedFull = expectedTenantId + '_' + expectedCaseId + '_' + embeddingNamespace.namespace;
  const namespaceScopeStatus = embeddingNamespace.fullNamespace === expectedFull ? 'PASS' : 'FAIL';
  const tenantMatchStatus = embeddingNamespace.tenantId === expectedTenantId ? 'PASS' : 'FAIL';
  const caseMatchStatus = embeddingNamespace.caseId === expectedCaseId ? 'PASS' : 'FAIL';

  const overallStatus =
    namespaceScopeStatus === 'PASS' &&
    tenantMatchStatus === 'PASS' &&
    caseMatchStatus === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return {
    namespaceScopeStatus,
    tenantMatchStatus,
    caseMatchStatus,
    overallStatus,
  };
}

// ---------------------------------------------------------------------------
// Validate Token Budget — hard cap enforcement
// ---------------------------------------------------------------------------

/**
 * Validate that token counts are within budget limits.
 *
 * Hard cap on token input and output size.
 * Binary FAIL if exceeded.
 *
 * Deterministic — same inputs always produce same result.
 */
export function validateTokenBudget(
  inputTokenCount: number,
  outputTokenCount: number,
  config: TokenBudgetConfig
): TokenBudgetResult {
  const inputStatus = inputTokenCount <= config.maxInputTokens ? 'PASS' : 'FAIL';
  const outputStatus = outputTokenCount <= config.maxOutputTokens ? 'PASS' : 'FAIL';

  const overallStatus =
    inputStatus === 'PASS' && outputStatus === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return {
    inputTokenCount,
    maxInputTokens: config.maxInputTokens,
    inputStatus,
    outputTokenCount,
    maxOutputTokens: config.maxOutputTokens,
    outputStatus,
    overallStatus,
  };
}

// ---------------------------------------------------------------------------
// Enforce Namespace Isolation — no global search
// ---------------------------------------------------------------------------

/**
 * Verify that a retrieval query is scoped to a specific namespace.
 *
 * No global embedding search allowed.
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function enforceNamespaceIsolation(
  queryNamespace: string,
  allowedNamespaces: readonly string[]
): 'PASS' | 'FAIL' {
  for (let i = 0; i < allowedNamespaces.length; i++) {
    if (queryNamespace === allowedNamespaces[i]) {
      return 'PASS';
    }
  }
  return 'FAIL';
}
