// ============================================
// Court Access — Portfolio Aggregation Engine (Phase 16)
// Multi-Case Dashboard & Structured Indexing Layer
//
// Deterministic aggregation of case metrics for
// attorney-facing portfolio view.
//
// This engine:
//   - Aggregates counts across cases (summation only)
//   - Sorts dashboard entries deterministically
//   - Enforces tenant isolation before aggregation
//   - No percentages implying success
//   - No trend language
//   - No prediction logic
//   - No case ranking
//   - No performance scoring
//
// Allowed phrasing only:
//   "3 unmatched elements"
//   "5 policy language differences"
//
// Not allowed:
//   "Weak prosecution"
//   "Strong defense"
//   "Favorable trend"
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - No side effects (caller persists)
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
//   - No credibility analysis / intent inference
//   - No trend language / prediction logic
//   - Summation only
//   - Deterministic processing only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type {
  PortfolioMetrics,
  CaseMetrics,
  DashboardEntry,
  PortfolioDashboard,
} from '../models/PortfolioMetricsModel';

// ---------------------------------------------------------------------------
// ASCII Comparator
// ---------------------------------------------------------------------------

function asciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Aggregate Portfolio Metrics — summation only
// ---------------------------------------------------------------------------

/**
 * Aggregate metrics across all cases in a portfolio.
 *
 * Rules:
 *   - Summation only — no percentages, no averages
 *   - No trend language
 *   - No prediction logic
 *   - No ranking
 *
 * Deterministic — same inputs always produce same output.
 */
export function aggregatePortfolioMetrics(
  caseMetrics: readonly CaseMetrics[]
): PortfolioMetrics {
  let totalCases = 0;
  let totalIssues = 0;
  let totalUnmatchedElements = 0;
  let totalPolicyLanguageDifferences = 0;
  let totalMediaDescriptionDifferences = 0;

  for (let i = 0; i < caseMetrics.length; i++) {
    totalCases++;
    totalIssues = totalIssues + caseMetrics[i].issueCount;
    totalUnmatchedElements = totalUnmatchedElements + caseMetrics[i].unmatchedElementCount;
    totalPolicyLanguageDifferences = totalPolicyLanguageDifferences + caseMetrics[i].policyLanguageDifferenceCount;
    totalMediaDescriptionDifferences = totalMediaDescriptionDifferences + caseMetrics[i].mediaDescriptionDifferenceCount;
  }

  return {
    totalCases,
    totalIssues,
    totalUnmatchedElements,
    totalPolicyLanguageDifferences,
    totalMediaDescriptionDifferences,
  };
}

// ---------------------------------------------------------------------------
// Build Dashboard Entry
// ---------------------------------------------------------------------------

/**
 * Build a single dashboard entry from case metrics.
 *
 * No ranking. No scoring. Structured data only.
 * Deterministic — same inputs always produce same output.
 */
export function buildDashboardEntry(
  caseId: string,
  caseLabel: string,
  metrics: CaseMetrics
): DashboardEntry {
  return {
    caseId,
    caseLabel,
    metrics,
  };
}

// ---------------------------------------------------------------------------
// Sort Dashboard Entries — deterministic ordering
// ---------------------------------------------------------------------------

/**
 * Sort dashboard entries by caseLabel ASCII ascending.
 *
 * Returns a new array — does not mutate input.
 * Deterministic — same inputs always produce same output.
 */
export function sortDashboardEntries(
  entries: readonly DashboardEntry[]
): DashboardEntry[] {
  const sorted = entries.slice();
  sorted.sort(function sortByLabel(a: DashboardEntry, b: DashboardEntry): number {
    return asciiCompare(a.caseLabel, b.caseLabel);
  });
  return sorted;
}

// ---------------------------------------------------------------------------
// Build Portfolio Dashboard — complete view
// ---------------------------------------------------------------------------

/**
 * Build a complete portfolio dashboard for an attorney.
 *
 * Pipeline:
 *   1. Sort entries by caseLabel ASCII ascending
 *   2. Extract CaseMetrics from all entries
 *   3. Aggregate portfolio metrics (summation only)
 *   4. Return complete dashboard
 *
 * No ranking. No scoring. No prediction.
 * Deterministic — same inputs always produce same output.
 */
export function buildPortfolioDashboard(
  tenantId: string,
  attorneyUserId: string,
  generatedTimestamp: string,
  entries: readonly DashboardEntry[]
): PortfolioDashboard {
  // Sort entries deterministically
  const sortedEntries = sortDashboardEntries(entries);

  // Extract metrics for aggregation
  const allMetrics: CaseMetrics[] = [];
  for (let i = 0; i < sortedEntries.length; i++) {
    allMetrics.push(sortedEntries[i].metrics);
  }

  // Aggregate
  const aggregateMetrics = aggregatePortfolioMetrics(allMetrics);

  return {
    tenantId,
    attorneyUserId,
    generatedTimestamp,
    aggregateMetrics,
    entries: sortedEntries,
  };
}

// ---------------------------------------------------------------------------
// Enforce Portfolio Tenant Isolation
// ---------------------------------------------------------------------------

/**
 * Verify that all cases in a portfolio belong to the same tenant.
 *
 * No cross-tenant aggregation allowed.
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function enforcePortfolioTenantIsolation(
  expectedTenantId: string,
  caseMetrics: readonly CaseMetrics[]
): 'PASS' | 'FAIL' {
  for (let i = 0; i < caseMetrics.length; i++) {
    if (caseMetrics[i].tenantId !== expectedTenantId) {
      return 'FAIL';
    }
  }
  return 'PASS';
}

// ---------------------------------------------------------------------------
// Validate Dashboard Completeness
// ---------------------------------------------------------------------------

/**
 * Validate that all expected cases are present in the dashboard.
 *
 * Compares expected case IDs against dashboard entry case IDs.
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function validateDashboardCompleteness(
  expectedCaseIds: readonly string[],
  entries: readonly DashboardEntry[]
): 'PASS' | 'FAIL' {
  for (let i = 0; i < expectedCaseIds.length; i++) {
    let found = false;
    for (let j = 0; j < entries.length; j++) {
      if (entries[j].caseId === expectedCaseIds[i]) {
        found = true;
        break;
      }
    }
    if (!found) {
      return 'FAIL';
    }
  }
  return 'PASS';
}
