import type { ReportEvidenceItem } from './attorneyReportApi';

const API_BASE = '/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('court-access-token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export interface TrialCitation {
  type: 'evidence' | 'authority' | 'statute' | 'calcrim' | 'timeline' | 'witness' | 'discovery' | 'repository' | 'kg' | 'audit';
  id: string;
  label?: string;
}

export interface TrialReadinessMetric {
  id: string;
  label: string;
  value: string;
  score: number | null;
  status: 'ready' | 'partial' | 'incomplete' | 'unknown';
  note: string;
}

export interface TrialWitnessPrep {
  id: string;
  name: string;
  witnessType: string;
  role: string;
  statementStatus: string;
  interviewStatus: string;
  credibilityStatus: string;
  evidenceLinks: string[];
  timelineLinks: string[];
  knowledgeGraphLinked: boolean;
  potentialImpeachment: Array<{ text: string; citations: TrialCitation[] }>;
  priorStatements: string;
  crossExaminationNotes: Array<{ text: string; citations: TrialCitation[] }>;
}

export interface TrialExhibit {
  exhibitNumber: string;
  evidenceItem: string;
  repositoryId: string;
  evidenceType: string;
  hashVerification: string;
  chainOfCustody: string;
  ocrStatus: string;
  admissionStatus: string;
  relatedWitnesses: string[];
  relatedTimelineEvents: string[];
  knowledgeGraphLinked: boolean;
}

export interface TrialTimelineEvent {
  id: string;
  bucket: 'incident' | 'investigation' | 'discovery' | 'court' | 'evidence' | 'witness' | 'other';
  timestamp: string | null;
  timeText: string | null;
  description: string;
  actor: string | null;
  citations: TrialCitation[];
}

export interface TrialChecklistItem {
  id: string;
  label: string;
  status: 'ready' | 'incomplete' | 'unknown';
  detail: string;
  citations: TrialCitation[];
}

export interface TrialNotebookItem {
  id: string;
  title: string;
  detail: string;
  confidence: string;
  citations: TrialCitation[];
}

export interface TrialPrepReport {
  trialPrepVersion: string;
  generatedAt: string;
  caseId: string;
  tenantId: string;
  reproducibilityHash: string;
  header: {
    caseTitle: string;
    caseNumber: string;
    court: string;
    judge: string;
    attorney: string;
    trialDate: string | null;
    repositoryVersion: string;
    knowledgeGraphStatus: string;
    repositoryIntegrity: string;
    generatedAt: string;
  };
  dashboard: {
    caseReadiness: TrialReadinessMetric;
    evidenceReadiness: TrialReadinessMetric;
    witnessReadiness: TrialReadinessMetric;
    motionReadiness: TrialReadinessMetric;
    discoveryStatus: TrialReadinessMetric;
    repositoryCoverage: TrialReadinessMetric;
    knowledgeGraphHealth: TrialReadinessMetric;
    timelineCompleteness: TrialReadinessMetric;
    humanReview: TrialReadinessMetric;
  };
  witnessPrep: TrialWitnessPrep[];
  exhibits: TrialExhibit[];
  trialTimeline: { buckets: Record<string, number>; events: TrialTimelineEvent[] };
  authorities: {
    statutes: Array<{ code: string; section: string; title: string }>;
    calcrim: Array<{ instructionNumber: string; title: string }>;
    citations: Array<{ type: string; citation: string }>;
    providerAvailability: Array<{ provider: string; status: string }>;
    findings: Array<{ id: string; label: string; value: string; citations: TrialCitation[] }>;
  };
  checklist: TrialChecklistItem[];
  notebook: {
    issueList: TrialNotebookItem[];
    voirDire: TrialNotebookItem[];
    opening: TrialNotebookItem[];
    closing: TrialNotebookItem[];
    directExamination: TrialNotebookItem[];
    crossExamination: TrialNotebookItem[];
    objections: TrialNotebookItem[];
    trialNotebook: TrialNotebookItem[];
  };
  knowledgeGraph: { status: string; nodeCount: number; edgeCount: number; byType: Record<string, number> };
  _evidence?: ReportEvidenceItem[];
}

export async function fetchTrialPrep(caseId: string): Promise<TrialPrepReport> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/trial-prep`, { headers: authHeaders() });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to load trial preparation');
  }
  const data = await res.json();
  return (data.trialPrep ?? data) as TrialPrepReport;
}
