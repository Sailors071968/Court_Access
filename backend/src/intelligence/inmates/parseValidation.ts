// ============================================================================
// Parse validation — Step 3 of the Primary Engineering Directive.
//
// Before comparison begins:
//   No duplicate XREFs · No missing names · No malformed DOBs
//   Alphabetical order verified · Every page processed · No skipped pages
//
// If validation fails: stop processing, produce an engineering error,
// never continue to comparison.
// ============================================================================

import type { CanonicalRoster } from './canonicalRoster.js';

export interface ParseValidationIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  xref?: string | null;
  name?: string | null;
  page?: number | null;
}

export interface ParseValidationResult {
  ok: boolean;
  inmateCount: number;
  pageCount: number | null;
  errors: ParseValidationIssue[];
  warnings: ParseValidationIssue[];
}

const DOB_RE = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(19|20)\d{2}$/;

/**
 * Validate a canonical roster before any comparison is allowed.
 */
export function validateCanonicalRoster(
  roster: CanonicalRoster,
  options: {
    /** Pages that yielded no text (from PDF extract). */
    emptyPages?: number[];
    /** Expected minimum inmates; 0 disables. */
    minInmates?: number;
  } = {},
): ParseValidationResult {
  const errors: ParseValidationIssue[] = [];
  const warnings: ParseValidationIssue[] = [];

  if (roster.inmates.length === 0) {
    errors.push({
      code: 'no_inmates_extracted',
      message: 'Parser produced zero inmate records. This is not an empty comparison — stop.',
      severity: 'error',
    });
  }

  const minInmates = options.minInmates ?? 1;
  if (roster.inmates.length > 0 && roster.inmates.length < minInmates) {
    errors.push({
      code: 'inmate_count_below_minimum',
      message: `Extracted ${roster.inmates.length} inmate(s); minimum expected is ${minInmates}.`,
      severity: 'error',
    });
  }

  if (options.emptyPages && options.emptyPages.length > 0) {
    errors.push({
      code: 'skipped_pages',
      message: `Page(s) ${options.emptyPages.join(', ')} produced no text — every page must be processed.`,
      severity: 'error',
    });
  }

  if (roster.pageCount != null && roster.pageCount <= 0) {
    errors.push({
      code: 'no_pages',
      message: 'Page count is zero; the source PDF was not processed.',
      severity: 'error',
    });
  }

  const xrefCounts = new Map<string, number>();
  for (const m of roster.inmates) {
    if (!m.normalizedName) {
      errors.push({
        code: 'missing_name',
        message: 'An extracted row has no name.',
        severity: 'error',
        xref: m.xref,
        page: m.sourcePage,
      });
    }
    if (m.xref) {
      xrefCounts.set(m.xref, (xrefCounts.get(m.xref) ?? 0) + 1);
    } else {
      warnings.push({
        code: 'missing_xref',
        message: `No XREF for ${m.normalizedName}.`,
        severity: 'warning',
        name: m.normalizedName,
        page: m.sourcePage,
      });
    }
    if (!m.dateOfBirth) {
      warnings.push({
        code: 'missing_dob',
        message: `Missing DOB for ${m.normalizedName}.`,
        severity: 'warning',
        name: m.normalizedName,
        xref: m.xref,
        page: m.sourcePage,
      });
    } else if (!DOB_RE.test(m.dateOfBirth)) {
      errors.push({
        code: 'malformed_dob',
        message: `Malformed DOB "${m.dateOfBirth}" for ${m.normalizedName}.`,
        severity: 'error',
        name: m.normalizedName,
        xref: m.xref,
        page: m.sourcePage,
      });
    }
  }

  for (const [xref, count] of xrefCounts) {
    if (count > 1) {
      errors.push({
        code: 'duplicate_xref',
        message: `XREF ${xref} appears ${count} times on the roster.`,
        severity: 'error',
        xref,
      });
    }
  }

  // Alphabetical order verified on the source extraction (Sheriff layout).
  if (roster.inmates.length > 1 && roster.sourceAlphabeticalOk === false) {
    errors.push({
      code: 'alphabetical_order_broken',
      message:
        'Extracted roster was not in alphabetical order before canonicalization. '
        + 'Parser may have missed or reordered pages.',
      severity: 'error',
    });
  }

  return {
    ok: errors.length === 0,
    inmateCount: roster.inmates.length,
    pageCount: roster.pageCount,
    errors,
    warnings,
  };
}
