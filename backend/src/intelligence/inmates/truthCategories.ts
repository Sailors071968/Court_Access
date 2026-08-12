// ============================================================================
// Engineering Law #0 — The System Must Never Lie.
//
// Every statement belongs to exactly one truth category.
// Never optimize for appearing correct. Optimize for being truthful.
// ============================================================================

/** Exactly four truth categories. No others. */
export type TruthCategory =
  | 'verified_fact'
  | 'verified_conclusion'
  | 'analytical_intelligence'
  | 'unknown';

/** Disposition labels used for operational explanations (avoids circular imports). */
export type ExplainableDisposition =
  | 'new'
  | 'returning'
  | 'existing'
  | 'review'
  | 'failed'
  | 'unclassified';

export const TRUTH_CATEGORY_LABEL: Record<TruthCategory, string> = {
  verified_fact: 'Verified Fact',
  verified_conclusion: 'Verified Conclusion',
  analytical_intelligence: 'Analytical Intelligence',
  unknown: 'UNKNOWN',
};

/** Short operator cue for badges. */
export const TRUTH_CATEGORY_CUE: Record<TruthCategory, string> = {
  verified_fact: 'Fact',
  verified_conclusion: 'Conclusion',
  analytical_intelligence: 'Intelligence · Not Fact',
  unknown: 'UNKNOWN',
};

export type OperationalAlertSeverity = 'critical' | 'warning' | 'info';

/**
 * A condition that could change the morning report.
 * Must never be buried in logs — surface on the Morning Operations Dashboard.
 */
export interface OperationalAlert {
  id: string;
  severity: OperationalAlertSeverity;
  /** One sentence an operator understands immediately. */
  message: string;
  /** Optional link into the relevant surface. */
  href?: string;
}

/**
 * Bail-agent one-liner: why is this person on the New Inmate Report?
 * Requires no engineering knowledge.
 */
export function explainReportableWhy(args: {
  disposition: ExplainableDisposition;
  historicalBookingCount?: number;
  reviewReason?: string | null;
}): { why: string; truthCategory: TruthCategory } {
  switch (args.disposition) {
    case 'new':
      return {
        why: "Appears on today's roster but not yesterday's certified roster.",
        truthCategory: 'verified_conclusion',
      };
    case 'returning':
      return {
        why:
          "Appears on today's roster but not yesterday's certified roster "
          + `(known from ${args.historicalBookingCount ?? 'prior'} earlier booking(s)).`,
        truthCategory: 'verified_conclusion',
      };
    case 'review':
      return {
        why: args.reviewReason?.trim()
          || 'Manual review required — evidence is insufficient for an automatic decision.',
        truthCategory: 'unknown',
      };
    case 'existing':
      return {
        why: "Appears on both today's and yesterday's certified rosters.",
        truthCategory: 'verified_conclusion',
      };
    case 'failed':
      return {
        why: 'Could not be read from the roster — do not treat as a booking decision.',
        truthCategory: 'unknown',
      };
    default:
      return {
        why: 'Classification UNKNOWN — evidence insufficient.',
        truthCategory: 'unknown',
      };
  }
}

/** Format a value that must never be invented. */
export function truthOrUnknown(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'UNKNOWN';
  return String(value);
}

export function isUnknownValue(value: string | number | null | undefined): boolean {
  return value === null || value === undefined || value === '' || value === 'UNKNOWN';
}

/**
 * Analytical intelligence must always carry an explicit non-fact status.
 */
export function analyticalClaim(args: {
  statement: string;
  confidencePercent: number | null;
  evidence: string[];
}): {
  truthCategory: 'analytical_intelligence';
  statement: string;
  confidencePercent: number | null;
  status: 'Not Fact';
  evidence: string[];
} {
  return {
    truthCategory: 'analytical_intelligence',
    statement: args.statement,
    confidencePercent: args.confidencePercent,
    status: 'Not Fact',
    evidence: args.evidence,
  };
}

/** North-star sentence — place at the top of every NIIS engineering surface. */
export const OPERATIONAL_NORTH_STAR =
  'Every morning NIIS must tell the truth about who is newly booked into the Sacramento County Jail.';

export const HUMAN_REVIEW_IS_SUCCESS =
  'Routing an uncertain case to review is success. Silently making the wrong decision is failure.';

/** Architecture COMPLETE · V1.0 FROZEN — operator mode. */
export const OPERATIONAL_LOCK_NOTICE =
  'Architecture phase complete. V1.0 design frozen. Success = operational performance only.';
