// ============================================================================
// Domain U — Report Generator (Phase 6)
// Narrative text generated ONLY from structured intelligence data
// ============================================================================

import { createHash } from 'node:crypto';
import type { AttorneyIntelligenceReport, AttorneyRenderedReport, ReportSection } from './types.js';

function cite(
  text: string,
  citations: ReportSection['sentences'][0]['citations'],
): ReportSection['sentences'][0] {
  return { text, citations };
}

export function generateAttorneyReport(intelligence: AttorneyIntelligenceReport): AttorneyRenderedReport {
  const sections: ReportSection[] = [];

  // Case Overview
  const overviewSentences = [
    cite(
      `Case ${intelligence.caseOverview.caseNumber}: ${intelligence.caseOverview.title} (${intelligence.caseOverview.status}/${intelligence.caseOverview.phase}).`,
      [{ type: 'audit', id: intelligence.caseId }],
    ),
    cite(
      `Charges on file: ${intelligence.caseOverview.charges.length}. Evidence items: ${intelligence.caseOverview.evidenceCount}. Timeline events: ${intelligence.caseOverview.timelineEventCount}.`,
      [{ type: 'audit', id: intelligence.caseId }],
    ),
  ];
  if (intelligence.caseOverview.client) {
    overviewSentences.push(
      cite(`Client: ${intelligence.caseOverview.client.name}.`, [{ type: 'audit', id: intelligence.caseOverview.client.clientId }]),
    );
  }
  sections.push({ id: 'case-overview', title: 'Case Overview', sentences: overviewSentences });

  // Offense Analysis
  const offenseSentences: ReportSection['sentences'] = [];
  for (const charge of intelligence.offenseAnalysis) {
    if (charge.statuteIntelligence) {
      offenseSentences.push(
        cite(
          `Charge ${charge.code} §${charge.section}: ${charge.statuteIntelligence.title}. Criminal liability likely: ${charge.statuteIntelligence.criminalLiabilityLikely}.`,
          [{ type: 'authority', id: `${charge.code}/${charge.section}` }],
        ),
      );
    } else {
      offenseSentences.push(
        cite(`Charge ${charge.code} §${charge.section}: statute repository entry UNKNOWN.`, [
          { type: 'authority', id: `${charge.code}/${charge.section}` },
        ]),
      );
    }
  }
  sections.push({ id: 'offense-analysis', title: 'Offense Analysis', sentences: offenseSentences });

  // Element Matrix
  const elementSentences: ReportSection['sentences'] = [];
  for (const matrix of intelligence.elementMatrices) {
    for (const row of matrix.rows) {
      const refs = row.supportingEvidence.map((e) => ({ type: 'evidence' as const, id: e.evidenceId }));
      elementSentences.push(
        cite(
          `${matrix.code} §${matrix.section} — Element "${row.elementLabel}": ${row.status.toUpperCase()}${row.missingEvidenceReason ? ` (${row.missingEvidenceReason})` : ''}.`,
          refs.length ? refs : [{ type: 'audit', id: row.elementId }],
        ),
      );
    }
  }
  sections.push({ id: 'element-matrix', title: 'Element Matrix', sentences: elementSentences });

  // Contradictions
  const contradictionSentences = intelligence.contradictionAnalysis.map((c) =>
    cite(c.finding, c.timelineEventIds.map((id) => ({ type: 'timeline' as const, id }))),
  );
  sections.push({ id: 'contradictions', title: 'Contradiction Analysis', sentences: contradictionSentences });

  // Unknowns
  const unknownSentences = intelligence.unknowns.all.map((u) =>
    cite(`UNKNOWN: ${u}`, [{ type: 'audit', id: 'unknown-registry' }]),
  );
  sections.push({ id: 'unknowns', title: 'Unknowns', sentences: unknownSentences });

  // Recommended Investigation
  const investigationSentences = intelligence.recommendedInvestigation.map((r) =>
    cite(r, [{ type: 'audit', id: 'investigative-analysis' }]),
  );
  sections.push({ id: 'recommended-investigation', title: 'Recommended Investigation', sentences: investigationSentences });

  const hashInput = JSON.stringify({ caseId: intelligence.caseId, sections });
  const reproducibilityHash = createHash('sha256').update(hashInput).digest('hex');

  return {
    generatedAt: new Date().toISOString(),
    caseId: intelligence.caseId,
    sections,
    reproducibilityHash,
  };
}
