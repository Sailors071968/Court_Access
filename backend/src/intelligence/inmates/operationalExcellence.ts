// ============================================================================
// Operational Excellence Charter — priorities, Morning SLA, Trust Score, business metrics.
// Architecture frozen. Success = measurable Sacramento morning performance.
// ============================================================================

/** Fixed engineering priorities (Operational Excellence Charter). */
export const OPERATIONAL_PRIORITIES = [
  'Never miss a new inmate',
  'Never report a false new inmate',
  'Reduce human review',
  'Reduce processing time',
  'Improve operator workflow',
] as const;

/**
 * Morning SLA target in ms. Must come from real production hardware timing.
 * Unset / invalid → not calibrated (UNKNOWN). Do not invent aspirational numbers.
 */
export function morningSlaTargetMs(): number | null {
  const raw = process.env.SAC_MORNING_SLA_MS?.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export interface MorningSlaGate {
  id: string;
  label: string;
  ok: boolean;
}

export interface MorningSlaStatus {
  /** Elapsed upload → report-ready (ms), or null if not measurable yet. */
  elapsedMs: number | null;
  /** Calibrated target from SAC_MORNING_SLA_MS, or null if not set. */
  targetMs: number | null;
  /** true/false when both elapsed + target known; null = UNKNOWN. */
  withinTarget: boolean | null;
  gates: MorningSlaGate[];
  allGatesOk: boolean;
  summary: string;
}

export function evaluateMorningSla(args: {
  pdfAccepted: boolean;
  canonicalRosterGenerated: boolean;
  comparisonCompleted: boolean;
  newInmateReportAvailable: boolean;
  investigatorWorkspaceReady: boolean;
  certifiedReportPrintable: boolean;
  /** Upload timestamp → ready timestamp. */
  elapsedMs: number | null;
}): MorningSlaStatus {
  const gates: MorningSlaGate[] = [
    { id: 'pdf_accepted', label: 'PDF accepted without errors', ok: args.pdfAccepted },
    { id: 'canonical_roster', label: 'Canonical roster generated', ok: args.canonicalRosterGenerated },
    { id: 'comparison', label: 'Comparison completed', ok: args.comparisonCompleted },
    { id: 'new_inmate_report', label: 'New Inmate Report available', ok: args.newInmateReportAvailable },
    { id: 'investigator_workspace', label: 'Investigator Workspace ready', ok: args.investigatorWorkspaceReady },
    { id: 'certified_printable', label: 'Certified report printable', ok: args.certifiedReportPrintable },
  ];
  const allGatesOk = gates.every((g) => g.ok);
  const targetMs = morningSlaTargetMs();
  const elapsedMs = args.elapsedMs;
  let withinTarget: boolean | null = null;
  if (elapsedMs != null && targetMs != null) {
    withinTarget = elapsedMs <= targetMs;
  }

  let summary: string;
  if (!allGatesOk) {
    const first = gates.find((g) => !g.ok);
    summary = `SLA incomplete — next: ${first?.label ?? 'finish morning gates'}.`;
  } else if (elapsedMs == null) {
    summary = 'Gates complete · elapsed time UNKNOWN (timestamps missing).';
  } else if (targetMs == null) {
    summary =
      `Gates complete in ${(elapsedMs / 1000).toFixed(0)}s · target not calibrated `
      + '(set SAC_MORNING_SLA_MS from production hardware).';
  } else if (withinTarget) {
    summary = `Within Morning SLA: ${(elapsedMs / 1000).toFixed(0)}s ≤ ${(targetMs / 1000).toFixed(0)}s.`;
  } else {
    summary =
      `Morning SLA miss: ${(elapsedMs / 1000).toFixed(0)}s > ${(targetMs / 1000).toFixed(0)}s target.`;
  }

  return { elapsedMs, targetMs, withinTarget, gates, allGatesOk, summary };
}

export interface OperationalTrustInputs {
  certification: 'certified' | 'provisional' | 'missing' | 'failed' | 'PASS' | 'FAIL' | 'PROVISIONAL' | 'MISSING' | 'BLOCKED';
  reconcileOk: boolean | null;
  silentFailureCount: number;
  potentialClientsMissed: number | null;
  falseOpportunities: number | null;
  automaticClassificationRatePercent: number | null;
  consecutiveCertifiedDays: number;
  openCriticalDefects: number;
}

export interface OperationalTrustScore {
  /** 0–100, or null when insufficient evidence to score. */
  score: number | null;
  band: 'trusted' | 'watch' | 'untrusted' | 'unknown';
  factors: { id: string; points: number; max: number; detail: string }[];
  summary: string;
}

/**
 * Explainable Operational Trust Score — not a black-box model.
 * Rewards certification, zero misses/false news, reconciliation, ACR, streak;
 * penalizes silent failures and open critical defects.
 */
export function computeOperationalTrustScore(input: OperationalTrustInputs): OperationalTrustScore {
  const factors: OperationalTrustScore['factors'] = [];
  let points = 0;
  let max = 0;

  const certNorm = String(input.certification).toLowerCase();
  max += 25;
  if (certNorm === 'certified' || certNorm === 'pass') {
    points += 25;
    factors.push({ id: 'certification', points: 25, max: 25, detail: 'Certified PASS' });
  } else if (certNorm === 'provisional') {
    points += 10;
    factors.push({ id: 'certification', points: 10, max: 25, detail: 'Provisional' });
  } else if (certNorm === 'failed' || certNorm === 'fail' || certNorm === 'blocked') {
    factors.push({ id: 'certification', points: 0, max: 25, detail: 'Failed / blocked' });
  } else {
    factors.push({ id: 'certification', points: 0, max: 25, detail: 'Missing' });
  }

  max += 15;
  if (input.reconcileOk === true) {
    points += 15;
    factors.push({ id: 'reconciliation', points: 15, max: 15, detail: 'Reconcile OK' });
  } else if (input.reconcileOk === false) {
    factors.push({ id: 'reconciliation', points: 0, max: 15, detail: 'Reconcile FAIL' });
  } else {
    factors.push({ id: 'reconciliation', points: 0, max: 15, detail: 'Reconcile UNKNOWN' });
  }

  max += 15;
  if (input.potentialClientsMissed === 0) {
    points += 15;
    factors.push({ id: 'misses', points: 15, max: 15, detail: 'Zero missed new' });
  } else if (input.potentialClientsMissed == null) {
    factors.push({ id: 'misses', points: 0, max: 15, detail: 'Misses UNKNOWN (no ground truth)' });
  } else {
    factors.push({
      id: 'misses',
      points: 0,
      max: 15,
      detail: `${input.potentialClientsMissed} missed`,
    });
  }

  max += 15;
  if (input.falseOpportunities === 0) {
    points += 15;
    factors.push({ id: 'false_new', points: 15, max: 15, detail: 'Zero false new' });
  } else if (input.falseOpportunities == null) {
    factors.push({ id: 'false_new', points: 0, max: 15, detail: 'False new UNKNOWN (no ground truth)' });
  } else {
    factors.push({
      id: 'false_new',
      points: 0,
      max: 15,
      detail: `${input.falseOpportunities} false opportunities`,
    });
  }

  max += 10;
  if (input.silentFailureCount === 0) {
    points += 10;
    factors.push({ id: 'silent_failures', points: 10, max: 10, detail: 'Zero silent failures' });
  } else {
    factors.push({
      id: 'silent_failures',
      points: 0,
      max: 10,
      detail: `${input.silentFailureCount} silent-failure signal(s)`,
    });
  }

  max += 10;
  if (input.automaticClassificationRatePercent != null) {
    const acrPts = Math.round((Math.min(100, Math.max(0, input.automaticClassificationRatePercent)) / 100) * 10);
    points += acrPts;
    factors.push({
      id: 'acr',
      points: acrPts,
      max: 10,
      detail: `ACR ${input.automaticClassificationRatePercent}%`,
    });
  } else {
    factors.push({ id: 'acr', points: 0, max: 10, detail: 'ACR UNKNOWN' });
  }

  max += 10;
  const streakPts = Math.min(10, Math.max(0, input.consecutiveCertifiedDays));
  points += streakPts;
  factors.push({
    id: 'streak',
    points: streakPts,
    max: 10,
    detail: `${input.consecutiveCertifiedDays} consecutive certified day(s)`,
  });

  // Critical defects: subtract up to 20 from earned points (trust penalty).
  const defectPenalty = Math.min(20, Math.max(0, input.openCriticalDefects) * 5);
  if (defectPenalty > 0) {
    points = Math.max(0, points - defectPenalty);
    factors.push({
      id: 'critical_defects',
      points: -defectPenalty,
      max: 0,
      detail: `${input.openCriticalDefects} open critical defect(s) (−${defectPenalty})`,
    });
  } else {
    factors.push({
      id: 'critical_defects',
      points: 0,
      max: 0,
      detail: 'No open critical defects',
    });
  }

  const hasAnyEvidence =
    certNorm !== 'missing'
    || input.reconcileOk != null
    || input.potentialClientsMissed != null
    || input.falseOpportunities != null
    || input.automaticClassificationRatePercent != null
    || input.consecutiveCertifiedDays > 0;

  if (!hasAnyEvidence) {
    return {
      score: null,
      band: 'unknown',
      factors,
      summary: 'UNKNOWN — insufficient operational evidence to score trust.',
    };
  }

  const score = Math.round((points / max) * 1000) / 10;
  const band: OperationalTrustScore['band'] =
    score >= 85 ? 'trusted' : score >= 60 ? 'watch' : 'untrusted';

  return {
    score,
    band,
    factors,
    summary:
      band === 'trusted'
        ? `Trust score ${score} — investigator may focus on uncertain cases.`
        : band === 'watch'
          ? `Trust score ${score} — review discrepancies before treating as certified.`
          : `Trust score ${score} — do not rely on NIIS without manual compare.`,
  };
}

export interface BusinessMetrics {
  potentialNewClientsIdentifiedToday: number | null;
  potentialClientsMissed: number | null;
  falseOpportunities: number | null;
  evidence: string;
}

export function computeBusinessMetrics(args: {
  potentialClientsFound: number | null | undefined;
  potentialClientsMissed: number | null | undefined;
  newCount: number | null;
  returningCount: number | null;
  falseOpportunities: number | null;
  groundTruthSealed: boolean;
}): BusinessMetrics {
  const identified =
    args.potentialClientsFound
    ?? (args.newCount != null
      ? args.newCount + (args.returningCount ?? 0)
      : null);

  // Never invent zeros for miss/false without sealed ground truth.
  const missed = args.groundTruthSealed
    ? (args.potentialClientsMissed ?? 0)
    : (args.potentialClientsMissed ?? null);
  const falseOpp = args.groundTruthSealed
    ? (args.falseOpportunities ?? 0)
    : args.falseOpportunities;

  return {
    potentialNewClientsIdentifiedToday: identified,
    potentialClientsMissed: missed,
    falseOpportunities: falseOpp,
    evidence: args.groundTruthSealed
      ? 'Sealed against investigator ground truth for this ops date.'
      : 'Ground truth not sealed — missed/false may be UNKNOWN.',
  };
}

export function extrasCountFromCertSummary(summary: unknown): number | null {
  if (!summary || typeof summary !== 'object') return null;
  const extras = (summary as { extras?: unknown }).extras;
  if (!Array.isArray(extras)) return null;
  return extras.length;
}
