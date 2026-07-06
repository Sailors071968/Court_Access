// ============================================================================
// Domain U — Unknown Management (Phase 7)
// ============================================================================

import type {
  AttorneyIntelligenceReport,
  ChargeLegalAnalysis,
  ElementMatrix,
  UnknownRegistry,
} from './types.js';

export function collectUnknowns(
  offenseAnalysis: ChargeLegalAnalysis[],
  elementMatrices: ElementMatrix[],
  additional: string[] = [],
): UnknownRegistry {
  const facts: string[] = [];
  const legalIssues: string[] = [];
  const elements: string[] = [];
  const evidence: string[] = [];
  const timelines: string[] = [];

  for (const charge of offenseAnalysis) {
    legalIssues.push(...charge.unknownLegalQuestions);
    if (!charge.statuteIntelligence) {
      legalIssues.push(`Statute repository entry UNKNOWN for ${charge.code} §${charge.section}`);
    }
  }

  for (const matrix of elementMatrices) {
    for (const row of matrix.rows) {
      if (row.status === 'unknown' || row.status === 'missing_evidence' || row.status === 'unsatisfied') {
        elements.push(`${matrix.code} §${matrix.section} — ${row.elementLabel}: ${row.status}`);
      }
      if (row.missingEvidenceReason) {
        evidence.push(row.missingEvidenceReason);
      }
    }
  }

  const all = [...new Set([...facts, ...legalIssues, ...elements, ...evidence, ...timelines, ...additional])];
  return { facts, legalIssues, elements, evidence, timelines, all };
}

export function unknownsFromReport(report: AttorneyIntelligenceReport): UnknownRegistry {
  return report.unknowns;
}
