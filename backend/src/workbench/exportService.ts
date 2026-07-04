// ============================================================================
// Domain V — Workbench Export Service (Phase 9)
// All exports preserve citations and audit trails
// ============================================================================

import { createHash } from 'node:crypto';
import type { AttorneyIntelligenceReport } from '../intelligence/types.js';
import { generateAttorneyReport } from '../intelligence/reportGenerator.js';
import type {
  AttorneyWorkbenchBundle,
  CitationRef,
  ExportPackageType,
  WorkbenchExport,
} from './types.js';
import { WORKBENCH_VERSION } from './types.js';

function hashContent(data: unknown): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
}

function collectCitations(bundle: AttorneyWorkbenchBundle): CitationRef[] {
  const refs: CitationRef[] = [];
  for (const e of bundle.evidenceWorkbench.items) {
    refs.push(...e.citations);
  }
  for (const item of bundle.trialPreparation.trialNotebook) {
    refs.push(...item.citations);
  }
  return refs;
}

export function generateWorkbenchExport(
  bundle: AttorneyWorkbenchBundle,
  packageType: ExportPackageType,
): WorkbenchExport {
  const auditTrail = bundle.intelligence.auditTrail.map((a) => ({
    generatedAt: a.generatedAt,
    source: a.sourceType,
    reasoning: a.reasoning,
  }));

  let content: unknown;

  switch (packageType) {
    case 'attorney_report':
      content = bundle.renderedReport ?? generateAttorneyReport(bundle.intelligence);
      break;
    case 'trial_notebook':
      content = bundle.trialPreparation;
      break;
    case 'evidence_package':
      content = {
        items: bundle.evidenceWorkbench.items,
        contradictions: bundle.evidenceWorkbench.contradictions,
        missing: bundle.evidenceWorkbench.missing,
        graph: bundle.evidenceWorkbench.graph,
      };
      break;
    case 'witness_binder':
      content = bundle.trialPreparation.witnessList;
      break;
    case 'authority_binder':
      content = bundle.legalAuthority;
      break;
    case 'motion_package':
      content = {
        recommendedMotions: bundle.intelligence.recommendedMotions,
        impeachment: bundle.trialPreparation.impeachmentOpportunities,
      };
      break;
    case 'discovery_package':
      content = {
        discoveryRequests: bundle.investigation.discoveryRequests,
        recommendedDiscovery: bundle.investigation.recommendedDiscovery,
        evidenceGaps: bundle.investigation.evidenceGaps,
      };
      break;
    case 'investigation_package':
      content = {
        tasks: bundle.investigation.tasks,
        recommendedInvestigation: bundle.investigation.recommendedInvestigation,
        recommendedSubpoenas: bundle.investigation.recommendedSubpoenas,
        gaps: {
          evidence: bundle.investigation.evidenceGaps,
          witness: bundle.investigation.witnessGaps,
          timeline: bundle.investigation.timelineGaps,
        },
      };
      break;
    case 'chronology':
      content = {
        timeline: bundle.caseOverview.caseTimeline,
        summary: bundle.intelligence.timelineSummary,
      };
      break;
    default:
      content = bundle;
  }

  const citations = collectCitations(bundle);
  const reproducibilityHash = hashContent({ packageType, content, citations });

  return {
    packageType,
    generatedAt: new Date().toISOString(),
    caseId: bundle.caseId,
    tenantId: bundle.tenantId,
    workbenchVersion: WORKBENCH_VERSION,
    intelligenceVersion: bundle.intelligence.intelligenceVersion,
    content,
    citations,
    auditTrail,
    reproducibilityHash,
  };
}

export function exportFromIntelligence(
  intelligence: AttorneyIntelligenceReport,
  packageType: ExportPackageType,
): WorkbenchExport {
  const report = generateAttorneyReport(intelligence);
  const content = packageType === 'attorney_report' ? report : intelligence;
  return {
    packageType,
    generatedAt: new Date().toISOString(),
    caseId: intelligence.caseId,
    tenantId: intelligence.tenantId,
    workbenchVersion: WORKBENCH_VERSION,
    intelligenceVersion: intelligence.intelligenceVersion,
    content,
    citations: [],
    auditTrail: intelligence.auditTrail.map((a) => ({
      generatedAt: a.generatedAt,
      source: a.sourceType,
      reasoning: a.reasoning,
    })),
    reproducibilityHash: hashContent({ packageType, content }),
  };
}
