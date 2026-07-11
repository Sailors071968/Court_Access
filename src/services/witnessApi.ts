// Witness Workspace — repository-backed witnesses (CaseWitness). Evidence-governed;
// credibility findings are UNKNOWN until supported.
const API_BASE = '/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('court-access-token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export interface Witness {
  id: string;
  caseId: string;
  name: string;
  role?: string | null;
  witnessType?: string | null;
  agency?: string | null;
  employer?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  status: string;
  interviewStatus: string;
  credibilityStatus?: string | null;
  notes?: string | null;
  sourceType?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listWitnesses(caseId: string): Promise<Witness[]> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/witnesses`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load witnesses');
  const data = await res.json();
  return data.witnesses ?? [];
}

export async function createWitness(caseId: string, body: Partial<Witness>): Promise<Witness> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/investigator/witnesses`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create witness');
  }
  const data = await res.json();
  return data.witness;
}

export async function updateWitness(caseId: string, witnessId: string, body: Partial<Witness>): Promise<Witness> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/investigator/witnesses/${witnessId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update witness');
  }
  const data = await res.json();
  return data.witness;
}
