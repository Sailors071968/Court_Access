const API_BASE = '/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('court-access-token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' | 'repository-confirmed' | 'manual-review';

export interface ReportCitation {
  type: 'evidence' | 'authority' | 'timeline' | 'statute' | 'calcrim' | 'witness' | 'discovery' | 'repository' | 'audit';
  id: string;
  label?: string;
}

export interface ReportFinding {
  id: string;
  label: string;
  value: string;
  status?: string;
  confidence?: Confidence;
  citations: ReportCitation[];
  note?: string | null;
}

export interface ReportChargeElement {
  label: string;
  required: boolean;
  status: string;
  confidence: Confidence;
  supportingEvidence: string[];
}

export interface ReportCharge {
  chargeId: string;
  countNumber: number | null;
  code: string;
  section: string;
  offenseTitle: string;
  offenseId: string | null;
  classification: string;
  isPrimary: boolean;
  isEnhancement: boolean;
  dismissed: boolean;
  elements: ReportChargeElement[];
  mensRea: Array<{ type: string; terms: string[] }>;
  calcrim: Array<{ instructionNumber: string; title: string }>;
  enhancements: string[];
  defenses: string[];
  exceptions: string[];
  immunities: string[];
  sentencing: string[];
  authorities: Array<{ type: string; citation: string }>;
  repositoryConfidence: Confidence;
  repositoryVerified: boolean;
  manualReviewRequired: boolean;
  unknowns: string[];
}

export interface ReportEvidenceItem {
  evidenceId: string;
  fileName: string;
  evidenceType: string;
  mimeType: string | null;
  sizeBytes: string | null;
  sha256: string | null;
  ocrStatus: string;
  processingStatus: string;
  analysisStatus: string;
  uploadedAt: string;
  uploadedBy: string;
  confidence: Confidence;
  chainOfCustody: string;
  timelineLinked: boolean;
  citations: ReportCitation[];
}

export interface ReportWitness {
  id: string;
  name: string;
  witnessType: string;
  role: string;
  agency: string | null;
  status: string;
  interviewStatus: string;
  credibilityStatus: string;
  repositorySupport: string;
  sourceType: string;
  notes: string | null;
}

export interface ReportDiscoveryItem {
  id: string;
  title: string;
  category: string;
  sourceAgency: string | null;
  receivedDate: string | null;
  producedDate: string | null;
  hash: string | null;
  ocrStatus: string;
  reviewStatus: string;
  bradyFlag: boolean;
  giglioFlag: boolean;
  jencksFlag: boolean;
  flags: string[];
}

export interface ReportTimelineEvent {
  id: string;
  timestamp: string | null;
  timeText: string | null;
  description: string;
  actor: string | null;
  eventType: string | null;
  location: string | null;
  sourceType: string | null;
  conflictFlag: boolean;
  confidence: string | null;
}

export interface AttorneyReport {
  reportVersion: string;
  generatedAt: string;
  caseId: string;
  tenantId: string;
  reproducibilityHash: string;
  executiveSummary: {
    caseTitle: string;
    caseNumber: string;
    court: string;
    judge: string;
    status: string;
    phase: string;
    repositoryVersion: string;
    knowledgeGraphStatus: string;
    repositoryIntegrity: string;
    evidenceCount: number;
    witnessCount: number;
    discoveryCount: number;
    timelineEventCount: number;
    chargeCount: number;
    reportTimestamp: string;
  };
  caseOverview: {
    client: string;
    jurisdiction: string;
    caseType: string;
    prosecutor: string;
    defenseTeam: string[];
    filingDate: string | null;
    trialDate: string | null;
    nextHearing: string | null;
    county: string;
    notes: string | null;
  };
  charges: ReportCharge[];
  evidence: {
    total: number;
    byType: Record<string, number>;
    hashCoverage: string;
    processingPending: number;
    items: ReportEvidenceItem[];
    duplicates: Array<{ evidenceIds: string[]; reason: string }>;
    missing: string[];
  };
  witnesses: { total: number; byType: Record<string, number>; items: ReportWitness[]; gaps: ReportFinding[] };
  discovery: {
    total: number;
    received: number;
    bradyCount: number;
    giglioCount: number;
    jencksCount: number;
    humanReviewRequired: number;
    items: ReportDiscoveryItem[];
    missing: string[];
  };
  timeline: {
    eventCount: number;
    conflictCount: number;
    events: ReportTimelineEvent[];
    conflicts: ReportTimelineEvent[];
    gaps: ReportFinding[];
  };
  knowledgeGraph: { status: string; nodeCount: number; edgeCount: number; byType: Record<string, number> };
  authorities: {
    statutes: Array<{ code: string; section: string; title: string }>;
    calcrim: Array<{ instructionNumber: string; title: string }>;
    citations: Array<{ type: string; citation: string }>;
    providerAvailability: Array<{ provider: string; status: string }>;
    findings: ReportFinding[];
  };
  analysis: {
    caseStrength: ReportFinding;
    evidenceConfidence: ReportFinding;
    repositoryCompleteness: ReportFinding;
    missingElements: ReportFinding[];
    contradictions: ReportFinding[];
    repositoryGaps: ReportFinding[];
    humanReviewItems: string[];
  };
  recommendations: {
    additionalEvidence: ReportFinding[];
    witnessFollowUp: ReportFinding[];
    discoveryRequests: ReportFinding[];
    repositoryResearch: ReportFinding[];
    manualReview: string[];
    potentialMotionTopics: ReportFinding[];
  };
  auditTrail: Array<{ generatedAt: string; source: string; reasoning: string }>;
}

export async function fetchAttorneyReport(caseId: string): Promise<AttorneyReport> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/attorney-report`, { headers: authHeaders() });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to load attorney report');
  }
  const data = await res.json();
  return (data.report ?? data) as AttorneyReport;
}
