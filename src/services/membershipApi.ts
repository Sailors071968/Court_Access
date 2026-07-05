// ============================================================================
// Program 1 — Membership API Client
// ============================================================================

const API_BASE = '/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('court-access-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface MembershipAccount {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    emailVerified: boolean;
    mfaEnabled: boolean;
    termsAcceptedAt?: string;
    privacyAcceptedAt?: string;
  };
  subscription: {
    planId: string;
    status: string;
    tier: string;
    trialEndsAt?: string;
    billingInterval: string;
    billingPeriodEnd: string;
  } | null;
  settings: Record<string, unknown> | null;
  delegatedUsers: number;
  delegatedUserLimit: number;
  universalCapabilities: boolean;
  plans: Array<{
    id: string;
    name: string;
    priceCentsMonthly: number;
    priceCentsAnnual: number;
    storageLabel: string;
    monthlyAiCredits: number;
    description: string;
  }>;
}

export async function fetchMembershipAccount(): Promise<MembershipAccount> {
  const res = await fetch(`${API_BASE}/membership/account`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load account');
  return res.json();
}

export async function updateMembershipSettings(settings: Record<string, boolean | string>): Promise<void> {
  const res = await fetch(`${API_BASE}/membership/settings`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
}

export interface SharedWorkspace {
  sharedBy: string;
  organizationId: string;
  role: string;
  cases: Array<{ caseId: string; title: string; caseNumber: string }>;
  disclosures: Array<{
    packageId: string;
    caseId: string;
    documentId: string;
    recipientType: string;
    status: string;
    publishedAt?: string;
  }>;
  permissions: Array<{ scope: string; resourceId: string | null; permission: string }>;
}

export async function fetchSharedAccess(): Promise<{ workspaces: SharedWorkspace[] }> {
  const res = await fetch(`${API_BASE}/membership/shared-access`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load shared access');
  return res.json();
}

export async function createPermissionGrant(data: {
  userId: string;
  scope: string;
  resourceId?: string;
  permission: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/membership/permission-grants`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create permission grant');
}

export async function startSubscriptionCheckout(
  planId: string,
  billingInterval: 'month' | 'year' = 'month',
): Promise<{ url?: string; sessionId?: string }> {
  const res = await fetch(`${API_BASE}/billing/create-checkout-session`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ planId, billingInterval }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Checkout failed');
  }
  return res.json();
}
