// ============================================================================
// Domain U — Investigative Analysis (Phase 4)
// ============================================================================

import { detectEvidenceGaps } from '../services/evidenceGapDetectionService.js';
import { detectContradictions } from '../services/contradictionEngine.js';
import type { IntelligenceFinding, InvestigativeAnalysis } from './types.js';
import { INTELLIGENCE_VERSION } from './types.js';

function finding(
  id: string,
  category: string,
  text: string,
  status: IntelligenceFinding['status'],
  evidence: IntelligenceFinding['evidence'] = [],
  timelineEventIds: string[] = [],
): IntelligenceFinding {
  return {
    id,
    category,
    finding: text,
    status,
    authority: null,
    evidence,
    timelineEventIds,
    claimIds: [],
    audit: {
      generatedAt: new Date().toISOString(),
      intelligenceVersion: INTELLIGENCE_VERSION,
      pipelineVersion: 'investigative-analysis-1.0.0',
      reasoning: text,
      sourceType: 'evidence',
    },
  };
}

export async function buildInvestigativeAnalysis(
  caseId: string,
  tenantId: string,
  timelineEventCount: number,
  evidenceCount: number,
): Promise<InvestigativeAnalysis> {
  const evidenceGaps: IntelligenceFinding[] = [];
  const witnessGaps: IntelligenceFinding[] = [];
  const timelineGaps: IntelligenceFinding[] = [];
  const chainOfCustodyGaps: IntelligenceFinding[] = [];
  const missingRecords: IntelligenceFinding[] = [];
  const recommendedInvestigation: string[] = [];
  const recommendedSubpoenas: string[] = [];
  const recommendedDiscovery: string[] = [];

  try {
    const gapResult = await detectEvidenceGaps(caseId, tenantId);
    for (const gap of gapResult.gaps) {
      evidenceGaps.push(
        finding(`gap-${gap.type}`, 'evidence_gap', `${gap.title}: ${gap.description}`, 'missing_evidence', [], gap.sourceEventIds),
      );
      recommendedDiscovery.push(gap.title);
    }
  } catch {
    evidenceGaps.push(finding('gap-detection-unavailable', 'evidence_gap', 'Evidence gap detection could not run', 'unknown'));
  }

  if (timelineEventCount === 0 && evidenceCount > 0) {
    timelineGaps.push(
      finding('no-timeline', 'timeline_gap', 'Evidence uploaded but no timeline events reconstructed', 'missing_evidence'),
    );
    recommendedInvestigation.push('Rebuild timeline from uploaded evidence');
  }

  if (evidenceCount === 0) {
    missingRecords.push(
      finding('no-evidence', 'missing_records', 'No evidence records on file for case', 'missing_evidence'),
    );
    recommendedInvestigation.push('Obtain police reports, bodycam, and dispatch records');
    recommendedSubpoenas.push('Law enforcement agency records — incident reports and media');
  }

  const hasWitnessEvidence = false; // no Witness model yet
  if (!hasWitnessEvidence && evidenceCount > 0) {
    witnessGaps.push(
      finding('no-witness-index', 'witness_gap', 'No indexed witness statements — UNKNOWN witness coverage', 'unknown'),
    );
    recommendedInvestigation.push('Identify and interview witnesses referenced in discovery');
  }

  try {
    const contradictions = await detectContradictions(caseId, tenantId);
    if (contradictions.length > 0) {
      recommendedInvestigation.push(`Resolve ${contradictions.length} timeline contradiction(s)`);
    }
  } catch {
    // contradiction engine optional
  }

  chainOfCustodyGaps.push(
    finding('custody-review', 'chain_of_custody', 'Chain of custody audit requires evidence metadata review', 'unclear'),
  );

  return {
    evidenceGaps,
    witnessGaps,
    timelineGaps,
    chainOfCustodyGaps,
    missingRecords,
    recommendedInvestigation,
    recommendedSubpoenas,
    recommendedDiscovery,
  };
}
