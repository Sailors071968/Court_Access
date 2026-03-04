// ============================================
// Court Access — Portfolio Metrics Model (Phase 16)
// Multi-Case Dashboard & Structured Indexing Layer
//
// Defines types for attorney-facing case portfolio view.
// Counts only. No interpretation. No prediction.
//
// This is documentation intelligence infrastructure:
//   - View multiple cases
//   - Compare structured issue counts
//   - View CALCRIM gap counts
//   - View policy comparison counts
//   - View media alignment counts
//   - No case ranking
//   - No performance scoring
//   - No "strength" metrics
//   - No outcome probability
//
// Allowed phrasing:
//   "3 unmatched elements"
//   "5 policy language differences"
//
// Not allowed:
//   "Weak prosecution"
//   "Strong defense"
//   "Favorable trend"
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
//   - No trend language / prediction logic
//   - Deterministic processing
//   - Summation only — no percentages implying success
// ============================================

// ---------------------------------------------------------------------------
// Portfolio Metrics — aggregate counts only
// ---------------------------------------------------------------------------

/**
 * Aggregate portfolio metrics across all cases for a tenant.
 *
 * Counts only. No interpretation. No prediction.
 * No percentages implying success. No trend language.
 */
export interface PortfolioMetrics {
  totalCases: number;
  totalIssues: number;
  totalUnmatchedElements: number;
  totalPolicyLanguageDifferences: number;
  totalMediaDescriptionDifferences: number;
}

// ---------------------------------------------------------------------------
// Case Metrics — per-case counts
// ---------------------------------------------------------------------------

/**
 * Metrics for a single case within the portfolio.
 *
 * Counts only. No ranking. No scoring.
 */
export interface CaseMetrics {
  caseId: string;
  tenantId: string;
  issueCount: number;
  unmatchedElementCount: number;
  policyLanguageDifferenceCount: number;
  mediaDescriptionDifferenceCount: number;
  totalDocuments: number;
  latestVersionNumber: number;
}

// ---------------------------------------------------------------------------
// Dashboard Entry — structured case summary
// ---------------------------------------------------------------------------

/**
 * A single entry in the attorney portfolio dashboard.
 *
 * Structured data only. No narrative. No ranking.
 * No "strength" or "weakness" language.
 */
export interface DashboardEntry {
  caseId: string;
  caseLabel: string;
  metrics: CaseMetrics;
}

// ---------------------------------------------------------------------------
// Portfolio Dashboard — complete view
// ---------------------------------------------------------------------------

/**
 * Complete portfolio dashboard for an attorney.
 *
 * Sorted by caseLabel ASCII ascending for deterministic ordering.
 * Counts only. No ranking. No prediction.
 */
export interface PortfolioDashboard {
  tenantId: string;
  attorneyUserId: string;
  generatedTimestamp: string;                // ISO 8601, caller-provided
  aggregateMetrics: PortfolioMetrics;
  entries: DashboardEntry[];
}
