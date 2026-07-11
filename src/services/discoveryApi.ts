// Discovery Workspace — inbound criminal discovery items. Evidence-governed;
// Brady/Giglio/Jencks are user-set candidate flags, never fabricated.
const API_BASE = '/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('court-access-token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export interface DiscoveryItem {
  id: string;
  caseId: string;
  title: string;
  category: string;
  sourceAgency?: string | null;
  originalFileName?: string | null;
  receivedDate?: string | null;
  producedDate?: string | null;
  hash?: string | null;
  fileSize?: string | null;
  ocrStatus: string;
  reviewStatus: string;
  reviewedBy?: string | null;
  reviewRole?: string | null;
  bradyFlag: boolean;
  giglioFlag: boolean;
  jencksFlag: boolean;
  flags: string[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listDiscovery(caseId: string): Promise<DiscoveryItem[]> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/discovery`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load discovery');
  const data = await res.json();
  return data.items ?? [];
}

export async function createDiscovery(caseId: string, body: Partial<DiscoveryItem>): Promise<DiscoveryItem> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/discovery`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to create discovery item'); }
  return (await res.json()).item;
}

export async function updateDiscovery(caseId: string, itemId: string, body: Partial<DiscoveryItem>): Promise<DiscoveryItem> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/discovery/${itemId}`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to update discovery item'); }
  return (await res.json()).item;
}
