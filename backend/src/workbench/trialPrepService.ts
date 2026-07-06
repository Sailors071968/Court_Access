// ============================================================================
// Domain V — Trial Preparation (Phase 6)
// Generated only from structured intelligence with citations
// ============================================================================

import type { AttorneyIntelligenceReport } from '../intelligence/types.js';
import type { CitationRef, TrialPrepItem, TrialPreparationSection } from './types.js';

function cite(type: CitationRef['type'], id: string, label?: string): CitationRef {
  return { type, id, label };
}

function item(
  id: string,
  title: string,
  detail: string,
  citations: CitationRef[],
  confidence: TrialPrepItem['confidence'] = 'MEDIUM',
): TrialPrepItem {
  return { id, title, detail, citations, confidence };
}

export function buildTrialPreparation(
  intelligence: AttorneyIntelligenceReport,
  evidence: Array<{ evidenceId: string; fileName: string; evidenceType: string }>,
  timelineEvents: Array<{ id: string; actor: string | null; description: string }>,
  impeachments: Array<{ id: string; claimText: string; severity: string; suggestedQuestion: string | null }>,
): TrialPreparationSection {
  const witnessActors = new Set<string>();
  for (const e of timelineEvents) {
    if (e.actor?.trim()) witnessActors.add(e.actor.trim());
  }

  const witnessList: TrialPrepItem[] = [...witnessActors].map((actor, i) =>
    item(
      `witness-${i}`,
      actor,
      `Timeline actor referenced in ${timelineEvents.filter((t) => t.actor === actor).length} event(s)`,
      timelineEvents.filter((t) => t.actor === actor).map((t) => cite('timeline', t.id, t.description)),
      timelineEvents.some((t) => t.actor === actor) ? 'MEDIUM' : 'UNKNOWN',
    ),
  );

  if (witnessList.length === 0) {
    witnessList.push(
      item('witness-unknown', 'UNKNOWN — Witness list', 'No timeline actors indexed; witness coverage UNKNOWN', [], 'UNKNOWN'),
    );
  }

  const exhibitList: TrialPrepItem[] = evidence.map((e) =>
    item(
      `exhibit-${e.evidenceId}`,
      e.fileName,
      `Evidence type: ${e.evidenceType}`,
      [cite('evidence', e.evidenceId, e.fileName)],
      'HIGH',
    ),
  );

  const crossExaminationTopics: TrialPrepItem[] = intelligence.contradictionAnalysis.map((c, i) =>
    item(
      `cross-${i}`,
      `Contradiction: ${c.category}`,
      c.finding,
      [
        ...c.evidence.map((ev) => cite('evidence', ev.evidenceId)),
        ...c.timelineEventIds.map((tid) => cite('timeline', tid)),
      ],
      c.status === 'disputed' ? 'HIGH' : 'MEDIUM',
    ),
  );

  const impeachmentOpportunities: TrialPrepItem[] = impeachments.map((imp) =>
    item(
      `impeach-${imp.id}`,
      `Impeachment — ${imp.severity} severity`,
      imp.suggestedQuestion ?? imp.claimText,
      [cite('claim', imp.id, imp.claimText.slice(0, 60))],
      imp.severity === 'high' ? 'HIGH' : 'MEDIUM',
    ),
  );

  const voirDireNotes: TrialPrepItem[] = intelligence.riskFactors
    .filter((r) => r.category === 'element_risk')
    .slice(0, 5)
    .map((r, i) =>
      item(`voir-${i}`, r.finding, `Element risk for voir dire screening`, r.evidence.map((e) => cite('evidence', e.evidenceId)), 'MEDIUM'),
    );

  const openingOutline: TrialPrepItem[] = [
    item('opening-1', 'Case posture', `${intelligence.caseOverview.charges.length} charge(s); phase: ${intelligence.caseOverview.phase}`, [], 'HIGH'),
    ...intelligence.elementMatrices.flatMap((m, mi) =>
      m.rows
        .filter((r) => r.status === 'unsatisfied' || r.status === 'contradicted')
        .slice(0, 2)
        .map((r, ri) =>
          item(
            `opening-el-${mi}-${ri}`,
            `Element issue: ${r.elementLabel}`,
            `Status: ${r.status}${r.missingEvidenceReason ? ` — ${r.missingEvidenceReason}` : ''}`,
            r.supportingEvidence.map((e) => cite('evidence', e.evidenceId)),
            r.confidence,
          ),
        ),
    ),
  ];

  const closingOutline: TrialPrepItem[] = [
    ...intelligence.unknowns.all.slice(0, 3).map((u, i) =>
      item(`closing-unknown-${i}`, 'Outstanding unknown', u, [], 'UNKNOWN'),
    ),
    ...intelligence.recommendedMotions.slice(0, 3).map((m, i) =>
      item(`closing-motion-${i}`, 'Motion opportunity', m, [], 'MEDIUM'),
    ),
  ];

  const trialNotebook: TrialPrepItem[] = [
    ...witnessList.slice(0, 5),
    ...exhibitList.slice(0, 5),
    ...crossExaminationTopics.slice(0, 5),
    ...impeachmentOpportunities.slice(0, 5),
  ];

  return {
    witnessList,
    exhibitList,
    crossExaminationTopics,
    impeachmentOpportunities,
    voirDireNotes,
    openingOutline,
    closingOutline,
    trialNotebook,
  };
}
