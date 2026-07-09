const API_BASE = '/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('court-access-token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export interface CalcrimCitation {
  type: 'evidence' | 'authority' | 'statute' | 'calcrim' | 'timeline' | 'witness' | 'discovery' | 'repository' | 'kg';
  id: string;
  label?: string;
}

export interface CalcrimElement {
  label: string;
  required: boolean;
  status: string;
  confidence: string;
  supportingEvidence: Array<{ evidenceId: string; fileName: string }>;
}

export interface CalcrimEvidenceMapping {
  evidence: Array<{ evidenceId: string; fileName: string; confidence: string }>;
  witnesses: Array<{ id: string; name: string }>;
  discovery: Array<{ id: string; title: string }>;
  timeline: Array<{ id: string; description: string }>;
}

export interface CalcrimInstruction {
  instructionNumber: string;
  title: string;
  category: string;
  repositoryStatus: 'repository-linked' | 'UNKNOWN';
  confidence: string;
  charge: { chargeId: string; code: string; section: string; offenseTitle: string };
  authorityReferences: string[];
  elements: CalcrimElement[];
  evidenceMapping: CalcrimEvidenceMapping;
}

export interface CalcrimCenter {
  calcrimVersion: string;
  generatedAt: string;
  caseId: string;
  tenantId: string;
  reproducibilityHash: string;
  header: {
    caseTitle: string;
    caseNumber: string;
    court: string;
    judge: string;
    repositoryVersion: string;
    knowledgeGraphStatus: string;
    repositoryIntegrity: string;
    generatedAt: string;
  };
  dashboard: {
    totalInstructions: number;
    chargesTotal: number;
    chargesWithInstructions: number;
    chargesWithoutInstructions: number;
    elementsTotal: number;
    elementsSatisfied: number;
    elementsUnsupported: number;
    evidenceLinkedElements: number;
    humanReviewCount: number;
  };
  instructions: CalcrimInstruction[];
  authorities: {
    statutes: Array<{ code: string; section: string; title: string }>;
    calcrim: Array<{ instructionNumber: string; title: string }>;
    citations: Array<{ type: string; citation: string }>;
    providerAvailability: Array<{ provider: string; status: string }>;
    findings: Array<{ id: string; label: string; value: string; citations: CalcrimCitation[] }>;
  };
  knowledgeGraph: { status: string; nodeCount: number; edgeCount: number; byType: Record<string, number> };
  attorneyReview: {
    missingElements: Array<{ instruction: string; element: string; reason: string; citations: CalcrimCitation[] }>;
    weakElements: Array<{ instruction: string; element: string; confidence: string }>;
    conflictingEvidence: Array<{ id: string; label: string; value: string; citations: CalcrimCitation[] }>;
    repositoryGaps: Array<{ id: string; label: string; value: string; citations: CalcrimCitation[] }>;
    humanReviewItems: string[];
  };
}

export async function fetchCalcrimCenter(caseId: string): Promise<CalcrimCenter> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/calcrim-center`, { headers: authHeaders() });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Failed to load CALCRIM center');
  }
  const data = await res.json();
  return (data.calcrim ?? data) as CalcrimCenter;
}
