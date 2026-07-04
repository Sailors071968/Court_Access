// ============================================
// Court Access — Doctrine Intelligence Frontend Service
// Fetches doctrine compliance analysis, search,
// and status from the backend API.
// Constitutional compliance: never fabricate legal conclusions.
// On failure, surfaces UNKNOWN — never demo or mock data.
// ============================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DoctrineFlagType = 'violation' | 'concern' | 'compliant';
export type DoctrineCategory =
  | 'constitutional'
  | 'encounter'
  | 'detention'
  | 'search'
  | 'arrest'
  | 'miranda'
  | 'interrogation'
  | 'use_of_force'
  | 'pursuit'
  | 'evidence_presentation'
  | 'chain_of_custody'
  | 'testimony'
  | 'report_writing'
  | 'evidence_handling'
  | 'evidence_collection'
  | 'crime_scene'
  | 'patrol'
  | 'field_contact'
  | 'general';

export interface DoctrineMatchResult {
  doctrineId: string;
  source: string;
  chapter: string;
  topic: string;
  ruleText: string;
  category: DoctrineCategory;
  similarityScore: number;
  effectiveSimilarity: number;
  flagType: DoctrineFlagType;
  flagDescription: string;
  legalImplication: string | null;
}

export interface DoctrineComplianceResponse {
  overallCompliance: 'compliant' | 'concerns' | 'violations';
  totalRulesChecked: number;
  violations: number;
  concerns: number;
  compliant: number;
  matches: DoctrineMatchResult[];
  analyzedAt: string;
}

export interface DoctrineQuickScanResponse {
  hasViolations: boolean;
  hasConcerns: boolean;
  violations: Array<{
    doctrineId: string;
    topic: string;
    ruleText: string;
    flagDescription: string;
    similarityScore: number;
  }>;
  concerns: Array<{
    doctrineId: string;
    topic: string;
    ruleText: string;
    flagDescription: string;
    similarityScore: number;
  }>;
}

export interface DoctrineStatusResponse {
  status: string;
  totalRules: number;
  totalEmbeddings: number;
  rulesByCategory: Record<string, number>;
  rulesBySource: Record<string, number>;
  rulesByDomain: Record<string, number>;
  seedDataLoaded: boolean;
}

export interface DoctrineRuleResponse {
  doctrineId: string;
  sourceType: string;
  sourceName: string;
  domain: string;
  chapter: string;
  topic: string;
  ruleText: string;
  explanation: string | null;
  legalImplication: string | null;
  category: DoctrineCategory;
  keywords: string[];
}

export class DoctrineApiError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'DoctrineApiError';
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// API Helpers
// ---------------------------------------------------------------------------

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('court-access-token') || sessionStorage.getItem('accessToken');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

const API_BASE = '/api/doctrine';

async function parseApiError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string; message?: string };
    return body.error || body.message || `Doctrine API error (${response.status})`;
  } catch {
    return `Doctrine API error (${response.status})`;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze evidence text for doctrine compliance.
 * Throws DoctrineApiError on failure — never returns fabricated results.
 */
export async function analyzeDoctrineCompliance(
  evidenceText: string,
  options?: { category?: DoctrineCategory; maxResults?: number },
): Promise<DoctrineComplianceResponse> {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      evidenceText,
      category: options?.category,
      maxResults: options?.maxResults ?? 20,
    }),
  });

  if (!response.ok) {
    throw new DoctrineApiError(await parseApiError(response), response.status);
  }
  return await response.json() as DoctrineComplianceResponse;
}

/**
 * Quick scan evidence text for violations.
 */
export async function quickScanDoctrine(
  evidenceText: string,
): Promise<DoctrineQuickScanResponse> {
  const response = await fetch(`${API_BASE}/quick-scan`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ evidenceText }),
  });

  if (!response.ok) {
    throw new DoctrineApiError(await parseApiError(response), response.status);
  }
  return await response.json() as DoctrineQuickScanResponse;
}

/**
 * Get doctrine system status.
 */
export async function fetchDoctrineStatus(): Promise<DoctrineStatusResponse> {
  const response = await fetch(`${API_BASE}/status`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new DoctrineApiError(await parseApiError(response), response.status);
  }
  return await response.json() as DoctrineStatusResponse;
}

/**
 * Search doctrine rules by keyword.
 */
export async function searchDoctrineRules(
  query: string,
  maxResults: number = 20,
): Promise<{ count: number; rules: DoctrineRuleResponse[] }> {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  const response = await fetch(`${API_BASE}/search?${params}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new DoctrineApiError(await parseApiError(response), response.status);
  }
  return await response.json() as { count: number; rules: DoctrineRuleResponse[] };
}

/**
 * Trigger seed data loading.
 */
export async function loadDoctrineSeedData(): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/seed`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new DoctrineApiError(await parseApiError(response), response.status);
  }
  return await response.json() as { success: boolean; message: string };
}
