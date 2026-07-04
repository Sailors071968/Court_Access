// ============================================================================
// Domain V — Attorney Workbench Types
// Evidence-governed workspace; all outputs traceable to sources
// ============================================================================

import type { AttorneyIntelligenceReport, InvestigativeAnalysis } from '../intelligence/types.js';
import type { AttorneyRenderedReport } from '../intelligence/types.js';

export const WORKBENCH_VERSION = '1.0.0';

export interface CitationRef {
  type: 'evidence' | 'authority' | 'timeline' | 'claim' | 'audit' | 'repository';
  id: string;
  label?: string;
}

export interface CaseOverviewSection {
  client: { clientId: string; name: string } | null;
  case: {
    caseId: string;
    title: string;
    caseNumber: string;
    status: string;
    phase: string;
    jurisdiction: string;
    caseType: string;
  };
  charges: Array<{ id: string; code: string; section: string; title: string | null }>;
  court: string | null;
  judge: string | null;
  prosecutor: string | null;
  defenseTeam: Array<{ userId: string; role: string }>;
  currentStatus: string;
  upcomingHearings: Array<{ date: string | null; note: string | null }>;
  caseTimeline: Array<{
    id: string;
    timestamp: string | null;
    description: string;
    actor: string | null;
    conflictFlag: boolean;
    citations: CitationRef[];
  }>;
  evidenceSummary: AttorneyIntelligenceReport['evidenceSummary'];
  intelligenceSummary: {
    unknownCount: number;
    riskCount: number;
    contradictionCount: number;
    offenseCount: number;
  };
  outstandingUnknowns: string[];
}

export interface EvidenceWorkbenchSection {
  items: Array<{
    evidenceId: string;
    fileName: string;
    evidenceType: string;
    processingStatus: string;
    analysisStatus: string;
    uploadedAt: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
    chainOfCustody: { status: 'complete' | 'partial' | 'unknown'; notes: string };
    citations: CitationRef[];
  }>;
  timeline: Array<{ evidenceId: string; uploadedAt: string; fileName: string }>;
  graph: { nodes: Array<{ id: string; type: string; label: string }>; edges: Array<{ from: string; to: string; relation: string }> };
  contradictions: AttorneyIntelligenceReport['contradictionAnalysis'];
  duplicates: Array<{ evidenceIds: string[]; reason: string }>;
  missing: string[];
  filters: { types: string[]; statuses: string[] };
}

export interface LegalAuthoritySection {
  statutes: AttorneyIntelligenceReport['offenseAnalysis'];
  authorities: AttorneyIntelligenceReport['authorityMatrix'];
  calcrim: AttorneyIntelligenceReport['calcrimAnalysis'];
  crossReferences: Array<{ code: string; section: string; citations: CitationRef[] }>;
  enhancements: string[];
  exceptions: string[];
  defenses: string[];
  relatedOffenses: string[];
}

export interface InvestigationWorkbenchSection extends InvestigativeAnalysis {
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    assignedTo: string | null;
    dueDate: string | null;
    sourceType: string | null;
    sourceId: string | null;
    citations: CitationRef[];
  }>;
  discoveryRequests: Array<{ id: string; title: string; status: string; priority: string }>;
  outstandingSubpoenas: string[];
}

export interface TrialPrepItem {
  id: string;
  title: string;
  detail: string;
  citations: CitationRef[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
}

export interface TrialPreparationSection {
  witnessList: TrialPrepItem[];
  exhibitList: TrialPrepItem[];
  crossExaminationTopics: TrialPrepItem[];
  impeachmentOpportunities: TrialPrepItem[];
  voirDireNotes: TrialPrepItem[];
  openingOutline: TrialPrepItem[];
  closingOutline: TrialPrepItem[];
  trialNotebook: TrialPrepItem[];
}

export interface AttorneyNotesSection {
  notes: Array<{
    id: string;
    title: string | null;
    content: string;
    entityType: string | null;
    entityId: string | null;
    isPrivate: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  pins: Array<{
    id: string;
    pinType: string;
    entityId: string;
    label: string | null;
    createdAt: string;
  }>;
}

export interface CommandCenterSection {
  caseHealth: { score: number; label: string; factors: string[] };
  evidenceHealth: { score: number; label: string; pending: number; failed: number };
  legalCoverage: { score: number; label: string; offensesCovered: number; offensesTotal: number };
  timelineCoverage: { score: number; label: string; eventCount: number; conflictCount: number };
  unknownCount: number;
  contradictionCount: number;
  motionOpportunities: number;
  discoveryStatus: { pending: number; acknowledged: number; total: number };
  investigationStatus: { open: number; inProgress: number; completed: number };
  trialReadiness: { score: number; label: string };
  productionGateStatus: { pass: number; total: number; status: string };
}

export type ExportPackageType =
  | 'attorney_report'
  | 'trial_notebook'
  | 'evidence_package'
  | 'witness_binder'
  | 'authority_binder'
  | 'motion_package'
  | 'discovery_package'
  | 'investigation_package'
  | 'chronology';

export interface WorkbenchExport {
  packageType: ExportPackageType;
  generatedAt: string;
  caseId: string;
  tenantId: string;
  workbenchVersion: string;
  intelligenceVersion: string;
  content: unknown;
  citations: CitationRef[];
  auditTrail: Array<{ generatedAt: string; source: string; reasoning: string }>;
  reproducibilityHash: string;
}

export interface AttorneyWorkbenchBundle {
  generatedAt: string;
  workbenchVersion: string;
  caseId: string;
  tenantId: string;
  caseOverview: CaseOverviewSection;
  offenseAnalysis: AttorneyIntelligenceReport['offenseAnalysis'];
  elementMatrices: AttorneyIntelligenceReport['elementMatrices'];
  evidenceWorkbench: EvidenceWorkbenchSection;
  legalAuthority: LegalAuthoritySection;
  investigation: InvestigationWorkbenchSection;
  trialPreparation: TrialPreparationSection;
  attorneyNotes: AttorneyNotesSection;
  commandCenter: CommandCenterSection;
  intelligence: AttorneyIntelligenceReport;
  renderedReport: AttorneyRenderedReport | null;
}
