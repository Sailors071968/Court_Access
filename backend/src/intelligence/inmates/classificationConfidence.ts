// ============================================================================
// Reduce Human Review — Automatic Classification Rate + uncertainty ranking.
//
// Investigator Workspace becomes a confidence monitor: surface the inmates
// NIIS is least confident about first (Manual Compare Assistant).
// ============================================================================

import type { DifferenceRow } from './dailyDifferenceViewer.js';

/** 0 = certain automatic class; 100 = must review. */
export function uncertaintyScore(row: DifferenceRow): number {
  let score = 0;

  switch (row.classification) {
    case 'review':
    case 'failed':
    case 'unclassified':
      score += 80;
      break;
    case 'returning':
      score += 35;
      break;
    case 'new':
      score += 25;
      break;
    case 'changed':
      score += 20;
      break;
    case 'existing':
    case 'unchanged':
      score += 5;
      break;
    default:
      score += 50;
  }

  const conf = row.current?.confidence ?? row.prior?.confidence ?? null;
  if (conf == null) score += 15;
  else if (conf < 70) score += 30;
  else if (conf < 85) score += 18;
  else if (conf < 90) score += 10;

  const tier = (row.current?.matchTier ?? row.prior?.matchTier ?? '').toLowerCase();
  if (tier.includes('partial') || tier.includes('weak') || tier === 'name_only') score += 12;

  if (row.why.attributeChanges?.length) {
    score += Math.min(15, row.why.attributeChanges.length * 4);
  }

  // Thin evidence → more uncertainty
  if (!row.evidence?.length) score += 8;
  if (row.onCurrent && !row.onPrior && row.classification === 'new' && conf != null && conf >= 95) {
    score = Math.max(0, score - 10);
  }

  return Math.min(100, Math.max(0, score));
}

export interface AutomaticClassificationRate {
  /** 0–100, or null when roster total unknown. */
  ratePercent: number | null;
  automaticallyCertified: number;
  humanReview: number;
  corrected: number;
  totalRoster: number;
  /** Operator-facing one-liner. */
  summary: string;
}

/**
 * Automatic Classification Rate for today.
 *
 * automaticallyCertified = total − humanReview (still open) − corrected
 * rate = automaticallyCertified / total
 */
export function computeAutomaticClassificationRate(args: {
  totalRoster: number | null;
  humanReview: number;
  corrected: number;
}): AutomaticClassificationRate {
  const total = args.totalRoster ?? 0;
  const humanReview = Math.max(0, args.humanReview);
  const corrected = Math.max(0, args.corrected);
  if (total <= 0) {
    return {
      ratePercent: null,
      automaticallyCertified: 0,
      humanReview,
      corrected,
      totalRoster: 0,
      summary: 'UNKNOWN — roster total not yet available.',
    };
  }
  const automaticallyCertified = Math.max(0, total - humanReview - corrected);
  const ratePercent = Math.round((automaticallyCertified / total) * 1000) / 10;
  return {
    ratePercent,
    automaticallyCertified,
    humanReview,
    corrected,
    totalRoster: total,
    summary:
      `Automatic Classification Rate ${ratePercent}% — `
      + `${automaticallyCertified.toLocaleString()} automatic, `
      + `${humanReview} review, ${corrected} corrected.`,
  };
}

export interface ManualCompareAssistant {
  /** Top uncertain candidates (keys + names + scores). */
  leastConfident: {
    key: string;
    name: string;
    classification: string;
    uncertainty: number;
    why: string;
  }[];
  /** Operator prompt. */
  message: string;
}

export function buildManualCompareAssistant(
  rows: DifferenceRow[],
  limit = 4,
): ManualCompareAssistant {
  const ranked = [...rows]
    .map((r) => ({
      key: r.key,
      name: r.name,
      classification: r.classification,
      uncertainty: uncertaintyScore(r),
      why: r.why.summary,
      row: r,
    }))
    // Prefer review/new/returning for the assistant list
    .filter((r) =>
      ['new', 'returning', 'review', 'failed', 'unclassified', 'changed'].includes(r.classification)
      || r.uncertainty >= 40,
    )
    .sort((a, b) => b.uncertainty - a.uncertainty || a.name.localeCompare(b.name));

  const leastConfident = ranked.slice(0, limit).map(({ key, name, classification, uncertainty, why }) => ({
    key,
    name,
    classification,
    uncertainty,
    why,
  }));

  const n = leastConfident.length;
  const message = n === 0
    ? 'No high-uncertainty cases — review queue is clear for this filter.'
    : `These are the ${n} inmate${n === 1 ? '' : 's'} I am least confident about. Please review ${n === 1 ? 'this' : 'these'} first.`;

  return { leastConfident, message };
}

/** Feature work unlocks only after sustained certified agreement. */
export function featureWorkGate(streak: number, required = Number(process.env.SAC_FEATURE_WORK_STREAK_REQUIRED ?? '30')): {
  allowed: boolean;
  streak: number;
  required: number;
  message: string;
} {
  return {
    allowed: streak >= required,
    streak,
    required,
    message: streak >= required
      ? `${streak} consecutive certified days — limited new feature work may begin.`
      : `${streak}/${required} consecutive certified days — no new feature work yet (watch lists, SMS, enrichment, cross-county, predictive).`,
  };
}
