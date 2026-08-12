// ============================================================================
// CSV enrichment policy — PDF is primary for "who is new."
//
// The daily revenue path is yesterday PDF vs today PDF. When a CSV arrives later
// the same day, it may enrich bookings already discovered from the PDF. It must
// never silently create a new inmate for a row the PDF did not contain; those
// rows become review exceptions.
// ============================================================================

export type IdentityOutcome =
  | 'new_inmate'
  | 'matched'
  | 'duplicate'
  | 'needs_review'
  | 'failed';

export interface CsvEnrichmentDecision {
  /** Outcome to persist after the policy is applied. */
  outcome: IdentityOutcome;
  /** True when the CSV row was demoted because PDF-primary discovery already ran. */
  forcedException: boolean;
  reason: string;
}

/**
 * Apply the PDF-primary / CSV-enrichment rule to one identity outcome.
 *
 * Pure: no I/O. Callers decide whether a PDF primary batch exists for the day.
 */
export function applyCsvEnrichmentPolicy(args: {
  sourceType: string;
  identityOutcome: IdentityOutcome;
  /** True when a completed PDF batch already exists for this facility + roster date. */
  pdfPrimaryAlreadyPresent: boolean;
}): CsvEnrichmentDecision {
  const isCsv = args.sourceType === 'csv';
  if (!isCsv || !args.pdfPrimaryAlreadyPresent) {
    return {
      outcome: args.identityOutcome,
      forcedException: false,
      reason: isCsv
        ? 'CSV ingested without a same-day PDF primary — treated as standalone (no demotion).'
        : 'Non-CSV source; enrichment policy does not apply.',
    };
  }

  if (args.identityOutcome === 'new_inmate') {
    return {
      outcome: 'needs_review',
      forcedException: true,
      reason:
        'CSV-only booking after PDF primary for this roster date. ' +
        'CSV must not determine newness — flagged as exception for review instead of creating a new inmate.',
    };
  }

  return {
    outcome: args.identityOutcome,
    forcedException: false,
    reason:
      args.identityOutcome === 'matched' || args.identityOutcome === 'duplicate'
        ? 'CSV matched an existing booking/person — enrichment path (update fields only).'
        : `CSV outcome ${args.identityOutcome} preserved under enrichment policy.`,
  };
}
