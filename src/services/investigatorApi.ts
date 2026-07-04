// ============================================================================
// Program 12 — Investigator Workbench API Client
// ============================================================================

const API_BASE = '/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('court-access-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface InvestigatorWorkbench {
  generatedAt: string;
  version: string;
  caseId: string;
  dashboard: {
    caseTitle: string;
    caseNumber: string;
    phase: string;
    openTasks: number;
    openLeads: number;
    witnessCount: number;
    evidenceCount: number;
    unknownCount: number;
  };
  assignments: Array<{ id: string; investigatorId: string; role: string; status: string }>;
  tasks: Array<{ id: string; title: string; status: string; priority: string; assignedTo: string | null }>;
  leads: Array<{ id: string; title: string; status: string; priority: string }>;
  witnesses: Array<{ id: string; name: string; role: string | null; interviewStatus: string; citations: Array<{ type: string; id: string }> }>;
  evidenceCollection: {
    photos: Array<{ evidenceId: string; fileName: string }>;
    videos: Array<{ evidenceId: string; fileName: string }>;
    audio: Array<{ evidenceId: string; fileName: string }>;
  };
  chainOfCustody: Array<{ evidenceId: string; fileName: string; status: string }>;
  timeline: Array<{ id: string; timestamp: string | null; description: string; actor: string | null }>;
  fieldNotes: Array<{ id: string; title: string | null; content: string; noteType: string }>;
  recommendedInvestigation: string[];
  gaps: { evidence: string[]; witness: string[]; timeline: string[] };
  unknowns: string[];
}

export async function fetchInvestigatorWorkbench(caseId: string): Promise<InvestigatorWorkbench> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/investigator-workbench`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to load investigator workbench: HTTP ${res.status}`);
  return res.json();
}

export async function createWitness(caseId: string, data: { name: string; role?: string; contactPhone?: string }): Promise<void> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/investigator/witnesses`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create witness: HTTP ${res.status}`);
}

export async function createLead(caseId: string, data: { title: string; description?: string }): Promise<void> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/investigator/leads`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create lead: HTTP ${res.status}`);
}

export async function createFieldNote(caseId: string, content: string, noteType = 'general'): Promise<void> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/investigator/field-notes`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ content, noteType }),
  });
  if (!res.ok) throw new Error(`Failed to create field note: HTTP ${res.status}`);
}
