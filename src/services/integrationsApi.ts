const API_BASE = '/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('court-access-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface Integration {
  id: string;
  name: string;
  category: string;
  description: string;
  docsUrl?: string | null;
  baseUrl?: string | null;
  requiredEnv: string[];
  optionalEnv: string[];
  configured: boolean;
  hasCredential: boolean;
  credentialHint: string | null;
  status: 'online' | 'configured' | 'not_configured' | 'degraded' | 'unknown';
  capabilities: string[];
  rateLimits: unknown;
  health: { status: string; detail: string; latencyMs: number | null } | null;
  lastCheckedAt: string;
}

export interface IntegrationsSnapshot {
  checkedAt: string;
  total: number;
  configured: number;
  online: number;
  integrations: Integration[];
}

export async function listIntegrations(): Promise<IntegrationsSnapshot> {
  const res = await fetch(`${API_BASE}/admin/integrations`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load integrations');
  return res.json();
}

export interface TestResult {
  id: string;
  ok: boolean;
  status: string;
  detail: string | null;
  latencyMs: number;
}

export async function testIntegration(id: string): Promise<TestResult> {
  const res = await fetch(`${API_BASE}/admin/integrations/${id}/test`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Test failed');
  return res.json();
}
