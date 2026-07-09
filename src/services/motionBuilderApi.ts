import type { ReportFinding, ReportEvidenceItem, ReportWitness, ReportDiscoveryItem, ReportTimelineEvent } from './attorneyReportApi';

const API_BASE = '/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('court-access-token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export type MotionTypeId =
  | 'suppress' | 'dismiss' | 'in_limine' | 'pitchess' | 'brady' | 'discovery'
  | 'continuance' | 'severance' | 'protective_order' | 'expert' | 'preservation'
  | 'research_memo' | 'custom';

export interface MotionCitation {
  type: 'evidence' | 'authority' | 'statute' | 'calcrim' | 'timeline' | 'witness' | 'discovery' | 'repository' | 'kg' | 'audit';
  id: string;
  label?: string;
}

export interface MotionParagraph { text: string; citations: MotionCitation[]; unknown?: boolean }
export interface MotionSection { id: string; title: string; paragraphs: MotionParagraph[] }
export interface MotionSupportItem { id: string; label: string; detail?: string; citations: MotionCitation[] }

export interface MotionTypeMeta {
  id: MotionTypeId;
  label: string;
  category: string;
  description: string;
  statutoryBasis: string[];
  repositorySupport: 'supported' | 'partial' | 'unknown';
  supportSummary: string;
}

export interface MotionDraft {
  motionVersion: string;
  generatedAt: string;
  caseId: string;
  tenantId: string;
  reproducibilityHash: string;
  motionType: MotionTypeId;
  header: {
    motionTitle: string;
    caseTitle: string;
    caseNumber: string;
    court: string;
    judge: string;
    attorney: string;
    repositoryStatus: string;
    knowledgeGraphStatus: string;
    generatedAt: string;
    repositoryVersion: string;
  };
  repositoryAnalysis: {
    supportingEvidence: MotionSupportItem[];
    supportingAuthorities: MotionSupportItem[];
    supportingTimeline: MotionSupportItem[];
    supportingWitnesses: MotionSupportItem[];
    supportingDiscovery: MotionSupportItem[];
    supportingRepositoryRecords: MotionSupportItem[];
    supportingCalcrim: MotionSupportItem[];
  };
  draft: { sections: MotionSection[] };
  authorityPanel: {
    statutes: Array<{ code: string; section: string; title: string }>;
    courtListener: Array<{ citation: string; status: string }>;
    cap: Array<{ citation: string; status: string }>;
    openLaws: Array<{ citation: string; status: string }>;
    calcrim: Array<{ instructionNumber: string; title: string }>;
    citations: Array<{ type: string; citation: string }>;
    providerAvailability: Array<{ provider: string; status: string }>;
  };
  evidencePanel: {
    evidence: ReportEvidenceItem[];
    witnesses: ReportWitness[];
    discovery: ReportDiscoveryItem[];
    timeline: ReportTimelineEvent[];
    knowledgeGraph: { status: string; nodeCount: number; edgeCount: number; byType: Record<string, number> };
    repositoryReferences: Array<{ code: string; section: string; title: string }>;
  };
  attorneyReview: {
    repositoryConfidence: ReportFinding;
    humanReviewRequired: string[];
    repositoryGaps: ReportFinding[];
    unknownEvidence: string[];
    contradictions: ReportFinding[];
    missingAuthorities: string[];
    missingEvidence: ReportFinding[];
  };
  attorneyNotesHint: string;
}

export async function fetchMotionTypes(caseId: string): Promise<MotionTypeMeta[]> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/motion-types`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load motion types');
  const data = await res.json();
  return data.motionTypes ?? [];
}

export async function fetchMotionDraft(caseId: string, motionType: MotionTypeId): Promise<MotionDraft> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/motion-builder/${motionType}`, { headers: authHeaders() });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to generate motion draft');
  }
  const data = await res.json();
  return (data.draft ?? data) as MotionDraft;
}
