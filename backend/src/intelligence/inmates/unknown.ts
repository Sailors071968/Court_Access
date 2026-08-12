// ============================================================================
// UNKNOWN — Zero Assumption Engineering Directive.
//
// Whenever NIIS cannot determine something, say UNKNOWN.
// Never silently substitute blanks, defaults, estimates, or fabricated values.
// ============================================================================

/** Sentinel for unresolved engineering values. Never coerce to 0/""/false. */
export const UNKNOWN = 'UNKNOWN' as const;
export type Unknown = typeof UNKNOWN;

export type KnownOrUnknown<T> = T | Unknown;

/** True when the value is the UNKNOWN sentinel. */
export function isUnknown(value: unknown): value is Unknown {
  return value === UNKNOWN;
}

/**
 * Format a metric for evidence reports.
 * null/undefined → UNKNOWN (not "—", not 0, not blank).
 */
export function evidenceValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return UNKNOWN;
  if (typeof value === 'number' && !Number.isFinite(value)) return UNKNOWN;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/** Percent for evidence blocks; null → UNKNOWN. */
export function evidencePercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return UNKNOWN;
  return `${(ratio * 100).toFixed(digits)}%`;
}

/**
 * Standard certification evidence block for any engine claim.
 * Status is never "complete" — only CERTIFIED / FAIL / BLOCKED / PROVISIONAL / UNKNOWN.
 */
export function formatCertificationEvidence(args: {
  engine: string;
  testDataset: string;
  rosterDate: string | null | undefined;
  manualGroundTruthNew: number | null | undefined;
  niisResultNew: number | null | undefined;
  falsePositives: number | null | undefined;
  falseNegatives: number | null | undefined;
  precision: number | null | undefined;
  recall: number | null | undefined;
  status: 'CERTIFIED' | 'FAIL' | 'BLOCKED' | 'PROVISIONAL' | 'UNKNOWN';
}): string {
  return [
    args.engine,
    '',
    `Test Dataset:        ${args.testDataset}`,
    `Roster Date:         ${evidenceValue(args.rosterDate)}`,
    '',
    `Manual Ground Truth: ${evidenceValue(args.manualGroundTruthNew)} New Inmates`,
    `NIIS Result:         ${evidenceValue(args.niisResultNew)} New Inmates`,
    `False Positives:     ${evidenceValue(args.falsePositives)}`,
    `False Negatives:     ${evidenceValue(args.falseNegatives)}`,
    `Precision:           ${evidencePercent(args.precision)}`,
    `Recall:              ${evidencePercent(args.recall)}`,
    '',
    `Status:              ${args.status}`,
  ].join('\n');
}
