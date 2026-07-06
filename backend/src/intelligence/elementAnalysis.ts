// ============================================================================
// Domain U — Element Analysis (Phase 2)
// Deterministic element-to-evidence mapping; no unsupported inference
// ============================================================================

import type { ElementRecord } from '../legislative/knowledgeGraph/types.js';
import type { ElementAnalysisRow, ElementMatrix, EvidenceRef, IntelligenceAudit } from './types.js';
import { INTELLIGENCE_VERSION } from './types.js';

export interface ElementAnalysisContext {
  chargeId: string;
  code: string;
  section: string;
  elements: ElementRecord[];
  evidence: Array<{ evidenceId: string; fileName: string; evidenceType: string; processingStatus: string }>;
  claims: Array<{ claimId: string; claimText: string; evidenceId: string }>;
  validations: Array<{
    claimId: string;
    status: string;
    supportingEvidenceIds: string[];
    contradictingEvidenceIds: string[];
    reasoning: string | null;
  }>;
  timelineEvents: Array<{ id: string; description: string; sourceDoc: string | null; confidence: number | null }>;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3);
}

function keywordOverlap(elementText: string, candidateText: string): boolean {
  const a = new Set(tokenize(elementText));
  const b = tokenize(candidateText);
  let matches = 0;
  for (const token of b) {
    if (a.has(token)) matches += 1;
  }
  return matches >= 2;
}

function elementLabel(element: ElementRecord): string {
  const label = element.label.value !== 'UNKNOWN' ? element.label.value : '';
  const desc = element.description.value !== 'UNKNOWN' ? element.description.value : '';
  return `${label} ${desc}`.trim() || element.id;
}

function buildAudit(reasoning: string, sourceType: IntelligenceAudit['sourceType'], sourceId?: string): IntelligenceAudit {
  return {
    generatedAt: new Date().toISOString(),
    intelligenceVersion: INTELLIGENCE_VERSION,
    pipelineVersion: 'element-analysis-1.0.0',
    reasoning,
    sourceType,
    sourceId,
  };
}

export function analyzeElementsForCharge(ctx: ElementAnalysisContext): ElementMatrix {
  const rows: ElementAnalysisRow[] = [];

  for (const element of ctx.elements) {
    const label = elementLabel(element);
    const supportingEvidence: EvidenceRef[] = [];
    const contradictoryEvidence: EvidenceRef[] = [];
    const matchedClaimIds: string[] = [];
    const matchedTimelineIds: string[] = [];

    for (const claim of ctx.claims) {
      if (!keywordOverlap(label, claim.claimText)) continue;
      matchedClaimIds.push(claim.claimId);
      const validation = ctx.validations.find((v) => v.claimId === claim.claimId);
      if (validation?.status === 'supported') {
        for (const eid of validation.supportingEvidenceIds) {
          supportingEvidence.push({ evidenceId: eid, role: 'supports', excerpt: claim.claimText.slice(0, 120) });
        }
        if (validation.supportingEvidenceIds.length === 0) {
          supportingEvidence.push({ evidenceId: claim.evidenceId, role: 'supports', excerpt: claim.claimText.slice(0, 120) });
        }
      }
      if (validation?.status === 'contradicted') {
        for (const eid of validation.contradictingEvidenceIds) {
          contradictoryEvidence.push({ evidenceId: eid, role: 'contradicts', excerpt: claim.claimText.slice(0, 120) });
        }
      }
    }

    for (const event of ctx.timelineEvents) {
      if (keywordOverlap(label, event.description)) {
        matchedTimelineIds.push(event.id);
        if (event.sourceDoc) {
          const ev = ctx.evidence.find((e) => e.fileName === event.sourceDoc || e.evidenceId === event.sourceDoc);
          if (ev) {
            supportingEvidence.push({
              evidenceId: ev.evidenceId,
              role: 'mentions',
              excerpt: event.description.slice(0, 120),
            });
          }
        }
      }
    }

    let status: ElementAnalysisRow['status'] = 'unknown';
    let missingEvidenceReason: string | null = null;
    let confidence: ElementAnalysisRow['confidence'] = 'UNKNOWN';

    if (contradictoryEvidence.length > 0) {
      status = 'contradicted';
      confidence = 'HIGH';
    } else if (supportingEvidence.length > 0) {
      status = 'satisfied';
      confidence = supportingEvidence.length >= 2 ? 'HIGH' : 'MEDIUM';
    } else if (ctx.evidence.length === 0) {
      status = 'missing_evidence';
      missingEvidenceReason = 'No evidence uploaded for case';
      confidence = 'HIGH';
    } else if (element.label.value === 'UNKNOWN' || element.description.value === 'UNKNOWN') {
      status = 'unknown';
      missingEvidenceReason = 'Element definition UNKNOWN in repository';
    } else {
      status = 'unsatisfied';
      missingEvidenceReason = 'No evidence or claim maps to this element';
      confidence = 'MEDIUM';
    }

    rows.push({
      chargeId: ctx.chargeId,
      code: ctx.code,
      section: ctx.section,
      elementId: element.id,
      elementLabel: label,
      required: element.required,
      status,
      supportingEvidence,
      contradictoryEvidence,
      missingEvidenceReason,
      confidence,
      audit: buildAudit(
        `Element "${label}": ${status}. Claims matched: ${matchedClaimIds.length}. Timeline matched: ${matchedTimelineIds.length}.`,
        'statute',
        element.id,
      ),
    });
  }

  if (rows.length === 0) {
    rows.push({
      chargeId: ctx.chargeId,
      code: ctx.code,
      section: ctx.section,
      elementId: 'UNKNOWN',
      elementLabel: 'UNKNOWN — no elements in repository',
      required: true,
      status: 'unknown',
      supportingEvidence: [],
      contradictoryEvidence: [],
      missingEvidenceReason: 'No statutory elements extracted for this charge',
      confidence: 'UNKNOWN',
      audit: buildAudit('Repository returned zero elements for charge', 'repository'),
    });
  }

  return { chargeId: ctx.chargeId, code: ctx.code, section: ctx.section, rows };
}
