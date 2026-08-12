// ============================================================================
// Defect categories — separate algorithm quality from data quality.
//
// When NIIS disagrees with the investigator, classify WHY before "fixing."
// Over time this yields objective evidence of where improvements are needed.
// ============================================================================

/** Canonical defect taxonomy (Evidence Certification Directive). */
export type DefectCategory =
  | 'parser_defect'
  | 'ocr_defect'
  | 'identity_defect'
  | 'comparison_defect'
  | 'source_defect'
  | 'manual_review'
  | 'unknown';

export const DEFECT_CATEGORIES: readonly DefectCategory[] = [
  'parser_defect',
  'ocr_defect',
  'identity_defect',
  'comparison_defect',
  'source_defect',
  'manual_review',
  'unknown',
] as const;

export const DEFECT_CATEGORY_EXAMPLES: Record<DefectCategory, string> = {
  parser_defect: 'Missed an inmate because a page failed to parse',
  ocr_defect: 'Name extracted incorrectly',
  identity_defect: 'Failed to recognize an alias',
  comparison_defect: 'Classified an existing inmate as new',
  source_defect: 'PDF itself contained inconsistent data',
  manual_review: 'Investigator corrected an ambiguous case',
  unknown: 'Root cause not yet diagnosed',
};

/** Legacy Learning Queue rootCause values → canonical categories. */
const LEGACY_ROOT_CAUSE_MAP: Record<string, DefectCategory> = {
  parser: 'parser_defect',
  normalization: 'parser_defect',
  identity: 'identity_defect',
  classification: 'comparison_defect',
  report: 'comparison_defect',
  ocr: 'ocr_defect',
  source: 'source_defect',
  manual: 'manual_review',
  manual_review: 'manual_review',
  parser_defect: 'parser_defect',
  ocr_defect: 'ocr_defect',
  identity_defect: 'identity_defect',
  comparison_defect: 'comparison_defect',
  source_defect: 'source_defect',
  unknown: 'unknown',
};

export function normalizeDefectCategory(value: string | null | undefined): DefectCategory {
  if (!value) return 'unknown';
  const key = value.trim().toLowerCase().replace(/\s+/g, '_');
  return LEGACY_ROOT_CAUSE_MAP[key] ?? (DEFECT_CATEGORIES.includes(key as DefectCategory)
    ? (key as DefectCategory)
    : 'unknown');
}

/**
 * Infer defect category from stage / rule / evidence text.
 * Prefers algorithm defects when the signal is clear; otherwise unknown.
 */
export function inferDefectCategory(args: {
  stage?: string | null;
  rule?: string | null;
  evidence?: string | null;
  why?: string | null;
  errorType?: string | null;
}): DefectCategory {
  const blob = [args.stage, args.rule, args.evidence, args.why, args.errorType]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!blob.trim()) return 'unknown';

  if (
    blob.includes('manual review')
    || blob.includes('investigator')
    || blob.includes('ambiguous')
    || blob.includes('corrected by')
  ) {
    return 'manual_review';
  }
  if (
    blob.includes('source pdf')
    || blob.includes('source defect')
    || blob.includes('inconsistent data')
    || blob.includes('sheriff')
    || blob.includes('roster itself')
  ) {
    return 'source_defect';
  }
  if (
    blob.includes('ocr')
    || blob.includes('misread')
    || blob.includes('garbled')
    || blob.includes('character recognition')
  ) {
    return 'ocr_defect';
  }
  if (
    blob.includes('alias')
    || blob.includes('identity')
    || blob.includes('resolve')
    || blob.includes('merge')
    || blob.includes('xref mismatch')
  ) {
    return 'identity_defect';
  }
  if (
    blob.includes('parse')
    || blob.includes('jail_scan')
    || blob.includes('page failed')
    || blob.includes('skipped page')
    || blob.includes('extraction')
    || blob.includes('canonical roster')
  ) {
    return 'parser_defect';
  }
  if (
    blob.includes('classif')
    || blob.includes('comparison')
    || blob.includes('set-diff')
    || blob.includes('set_diff')
    || blob.includes('presence')
    || blob.includes('false new')
    || blob.includes('missed_new')
    || blob.includes('false_new')
    || blob.includes('report generation')
    || blob.includes('ground truth')
  ) {
    return 'comparison_defect';
  }

  return 'unknown';
}

export function defectQualityAxis(category: DefectCategory): 'algorithm' | 'data' | 'process' | 'unknown' {
  switch (category) {
    case 'parser_defect':
    case 'ocr_defect':
    case 'identity_defect':
    case 'comparison_defect':
      return 'algorithm';
    case 'source_defect':
      return 'data';
    case 'manual_review':
      return 'process';
    default:
      return 'unknown';
  }
}

export interface DefectTally {
  category: DefectCategory;
  axis: 'algorithm' | 'data' | 'process' | 'unknown';
  count: number;
  example: string;
}

export function tallyDefects(
  items: { rootCause?: string | null; category?: string | null }[],
): DefectTally[] {
  const counts = new Map<DefectCategory, number>();
  for (const item of items) {
    const cat = normalizeDefectCategory(item.category ?? item.rootCause);
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return DEFECT_CATEGORIES.map((category) => ({
    category,
    axis: defectQualityAxis(category),
    count: counts.get(category) ?? 0,
    example: DEFECT_CATEGORY_EXAMPLES[category],
  })).filter((t) => t.count > 0 || t.category === 'unknown');
}
