// Repository-backed California legislative intelligence (codes, sections, offense metadata).
const API_BASE = '/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('court-access-token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export interface RepoCode {
  code: string;
  name: string;
  sectionCount: number;
}

export interface RepoSection {
  code: string;
  section: string;
  citation: string;
  title: string | null;
  classification: string;
  classificationConfidence: string;
}

export interface StatuteIntelligence {
  code: string;
  section: string;
  offenseTitle?: string | null;
  offenseId?: string | null;
  classification?: string | null;
  severity?: string | null;
  elements?: unknown[];
  mensRea?: unknown;
  calcrim?: unknown[];
  maximumPunishment?: unknown;
  enhancements?: unknown[];
  defenses?: unknown[];
  exceptions?: unknown[];
  immunities?: unknown[];
  sentencing?: unknown[];
  authorities?: unknown[];
  confidence?: string;
  [k: string]: unknown;
}

export async function getCaCodes(): Promise<RepoCode[]> {
  const res = await fetch(`${API_BASE}/legislative/codes`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load California codes');
  const data = await res.json();
  return data.codes ?? [];
}

export async function searchSections(code: string, q: string): Promise<RepoSection[]> {
  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (q) params.set('q', q);
  params.set('limit', '40');
  const res = await fetch(`${API_BASE}/legislative/sections?${params.toString()}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to search sections');
  const data = await res.json();
  return data.sections ?? [];
}

/** Repository offense intelligence for a section. Returns null when coverage is incomplete (UNKNOWN). */
export async function getStatuteIntelligence(code: string, section: string): Promise<StatuteIntelligence | null> {
  const res = await fetch(`${API_BASE}/legislative/intelligence/${encodeURIComponent(code)}/${encodeURIComponent(section)}`, { headers: authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load statute intelligence');
  return res.json();
}
