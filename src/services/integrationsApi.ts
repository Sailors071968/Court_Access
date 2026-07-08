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
  source?: 'app' | 'environment' | 'none';
  enabled?: boolean;
  editable?: boolean;
  lastSuccessAt?: string | null;
  rotatedAt?: string | null;
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

export async function saveIntegration(
  id: string,
  changes: { baseUrl?: string; apiKey?: string; enabled?: boolean; clearKey?: boolean },
): Promise<Integration> {
  const res = await fetch(`${API_BASE}/admin/integrations/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(changes),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save integration');
  }
  return res.json();
}

export async function rotateIntegrationSecret(id: string, apiKey: string): Promise<Integration> {
  const res = await fetch(`${API_BASE}/admin/integrations/${id}/rotate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ apiKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to rotate secret');
  }
  return res.json();
}
