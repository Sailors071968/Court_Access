// ============================================================================
// Domain U — Attorney Intelligence Engine Types
// Evidence-governed structured intelligence; no unsupported inference
// ============================================================================

import type { AttorneyStatuteIntelligence } from '../legislative/attorneyIntelligence.js';

export const INTELLIGENCE_VERSION = '1.0.0';

export type FindingStatus =
  | 'established'
  | 'satisfied'
  | 'unsatisfied'
  | 'disputed'
  | 'contradicted'
  | 'missing_evidence'
  | 'unknown'
  | 'unclear';

export interface EvidenceRef {
  evidenceId: string;
  role: 'supports' | 'contradicts' | 'mentions' | 'source';
  excerpt?: string;
}

export interface AuthorityRef {
  code: string;
  section: string;
  elementId?: string;
  calcrimId?: string;
  authorityId?: string;
}

export interface IntelligenceAudit {
  generatedAt: string;
  intelligenceVersion: string;
  pipelineVersion: string;
  reasoning: string;
  sourceType: 'evidence' | 'timeline' | 'claim' | 'statute' | 'repository';
  sourceId?: string;
}

export interface IntelligenceFinding {
  id: string;
  category: string;
  finding: string;
  status: FindingStatus;
  authority: AuthorityRef | null;
  evidence: EvidenceRef[];
  timelineEventIds: string[];
  claimIds: string[];
  audit: IntelligenceAudit;
}

// Phase 1 — Case understanding
export interface CaseUnderstanding {
  caseId: string;
  tenantId: string;
  title: string;
  caseNumber: string;
  status: string;
  phase: string;
  client: { clientId: string; name: string } | null;
  charges: Array<{ id: string; code: string; section: string; title: string | null; victim: string }>;
  evidenceCount: number;
  timelineEventCount: number;
  claimCount: number;
  witnessCount: number;
}

// Phase 2 — Element analysis
export interface ElementAnalysisRow {
  chargeId: string;
  code: string;
  section: string;
  elementId: string;
  elementLabel: string;
  required: boolean;
  status: FindingStatus;
  supportingEvidence: EvidenceRef[];
  contradictoryEvidence: EvidenceRef[];
  missingEvidenceReason: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  audit: IntelligenceAudit;
}

export interface ElementMatrix {
  chargeId: string;
  code: string;
  section: string;
  rows: ElementAnalysisRow[];
}

// Phase 3 — Legal analysis
export interface ChargeLegalAnalysis {
  chargeId: string;
  code: string;
  section: string;
  statuteIntelligence: AttorneyStatuteIntelligence | null;
  applicableStatutes: AuthorityRef[];
  applicableAuthorities: AuthorityRef[];
  applicableCalcrim: Array<{ instructionNumber: string; title: string; audit: IntelligenceAudit }>;
  enhancements: string[];
  defenses: string[];
  exceptions: string[];
  crossReferences: AuthorityRef[];
  unknownLegalQuestions: string[];
}

// Phase 4 — Investigative analysis
export interface InvestigativeAnalysis {
  evidenceGaps: IntelligenceFinding[];
  witnessGaps: IntelligenceFinding[];
  timelineGaps: IntelligenceFinding[];
  chainOfCustodyGaps: IntelligenceFinding[];
  missingRecords: IntelligenceFinding[];
  recommendedInvestigation: string[];
  recommendedSubpoenas: string[];
  recommendedDiscovery: string[];
}

// Phase 5 — Attorney intelligence bundle
export interface AttorneyIntelligenceReport {
  generatedAt: string;
  intelligenceVersion: string;
  caseId: string;
  tenantId: string;
  caseOverview: CaseUnderstanding;
  offenseAnalysis: ChargeLegalAnalysis[];
  elementMatrices: ElementMatrix[];
  evidenceSummary: {
    total: number;
    byType: Record<string, number>;
    processingPending: number;
    findings: IntelligenceFinding[];
  };
  authorityMatrix: IntelligenceFinding[];
  timelineSummary: {
    eventCount: number;
    conflictCount: number;
    findings: IntelligenceFinding[];
  };
  contradictionAnalysis: IntelligenceFinding[];
  unknowns: UnknownRegistry;
  riskFactors: IntelligenceFinding[];
  recommendedInvestigation: string[];
  recommendedMotions: string[];
  calcrimAnalysis: IntelligenceFinding[];
  auditTrail: IntelligenceAudit[];
}

// Phase 6 — Rendered report (text derived FROM structured data only)
export interface ReportSection {
  id: string;
  title: string;
  sentences: Array<{
    text: string;
    citations: Array<{ type: 'evidence' | 'authority' | 'timeline' | 'claim' | 'audit'; id: string }>;
  }>;
}

export interface AttorneyRenderedReport {
  generatedAt: string;
  caseId: string;
  sections: ReportSection[];
  reproducibilityHash: string;
}

// Phase 7 — Unknown management
export interface UnknownRegistry {
  facts: string[];
  legalIssues: string[];
  elements: string[];
  evidence: string[];
  timelines: string[];
  all: string[];
}
