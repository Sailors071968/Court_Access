const API_BASE = '/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('court-access-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getCurrentOrganization() {
  const res = await fetch(`${API_BASE}/organizations/current`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load organization');
  return res.json();
}

export async function updateOrganization(data: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/organizations/current`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update organization');
  return res.json();
}

export async function advanceOnboarding(data: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/organizations/onboarding`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Onboarding failed');
  return res.json();
}

export async function listOffices() {
  const res = await fetch(`${API_BASE}/organizations/offices`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load offices');
  return res.json();
}

export async function createOffice(data: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/organizations/offices`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create office');
  return res.json();
}

export async function listPracticeGroups() {
  const res = await fetch(`${API_BASE}/organizations/practice-groups`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load practice groups');
  return res.json();
}

export async function createPracticeGroup(data: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/organizations/practice-groups`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create practice group');
  return res.json();
}

export async function listMembers() {
  const res = await fetch(`${API_BASE}/organizations/members`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load members');
  return res.json();
}

export async function listCollaborators() {
  const res = await fetch(`${API_BASE}/organizations/collaborators`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load collaborators');
  return res.json();
}

export async function updateCollaborator(
  memberId: string,
  changes: { status?: string; role?: string; caseRole?: string | null },
) {
  const res = await fetch(`${API_BASE}/organizations/members/${memberId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(changes),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update collaborator');
  }
  return res.json();
}

export async function removeCollaborator(memberId: string) {
  const res = await fetch(`${API_BASE}/organizations/members/${memberId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to remove collaborator');
  }
  return res.json();
}

export async function listInvitations() {
  const res = await fetch(`${API_BASE}/organizations/invitations`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load invitations');
  return res.json();
}

export async function createInvitation(data: { email: string; role: string; officeId?: string; practiceGroupId?: string }) {
  const res = await fetch(`${API_BASE}/organizations/invitations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send invitation');
  }
  return res.json();
}

export async function getFirmAnalytics() {
  const res = await fetch(`${API_BASE}/organizations/analytics`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json();
}

export async function firmSearch(q: string) {
  const res = await fetch(`${API_BASE}/organizations/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function previewInvitation(token: string) {
  const res = await fetch(`${API_BASE}/organizations/invitations/preview?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error('Invalid invitation');
  return res.json();
}

export async function acceptInvitation(token: string, name: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/accept-invitation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, name, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to accept invitation');
  }
  return res.json();
}
