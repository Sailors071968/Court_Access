const API = '/api';

function headers(): HeadersInit {
  const token = localStorage.getItem('court-access-token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function firmGet(path: string) {
  const res = await fetch(`${API}/firm${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  return res.json();
}

async function firmPost(path: string, body: unknown) {
  const res = await fetch(`${API}/firm${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${path}`);
  }
  return res.json();
}

async function firmPut(path: string, body: unknown) {
  const res = await fetch(`${API}/firm${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  return res.json();
}

async function firmPatch(path: string, body: unknown) {
  const res = await fetch(`${API}/firm${path}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  return res.json();
}

export const firmApi = {
  getAnalytics: (officeId?: string) => firmGet(`/analytics${officeId ? `?officeId=${officeId}` : ''}`),
  getPersonnel: (params?: { personnelType?: string; officeId?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return firmGet(`/personnel${q ? `?${q}` : ''}`);
  },
  updatePersonnel: (userId: string, data: Record<string, unknown>) => firmPut(`/personnel/${userId}`, data),
  getDepartments: (officeId?: string) => firmGet(`/departments${officeId ? `?officeId=${officeId}` : ''}`),
  createDepartment: (data: Record<string, unknown>) => firmPost('/departments', data),
  getMessages: () => firmGet('/messages'),
  sendMessage: (data: { body: string; recipientId?: string; channel?: string }) => firmPost('/messages', data),
  getTasks: (params?: { assigneeId?: string; status?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return firmGet(`/tasks${q ? `?${q}` : ''}`);
  },
  createTask: (data: Record<string, unknown>) => firmPost('/tasks', data),
  getKnowledge: (type?: string) => firmGet(`/knowledge${type ? `?type=${type}` : ''}`),
  createKnowledge: (data: Record<string, unknown>) => firmPost('/knowledge', data),
  checkConflicts: (name: string) => firmPost('/conflicts/check', { name }),
  getConflicts: () => firmGet('/conflicts'),
  getPermissions: () => firmGet('/permissions'),
  grantPermission: (data: Record<string, unknown>) => firmPost('/permissions', data),
  seedCaliforniaOffices: () => firmPost('/offices/seed-california', {}),
  updateTheme: (data: Record<string, unknown>) => firmPatch('/theme', data),
  assignClientTeam: (clientId: string, data: Record<string, unknown>) => firmPut(`/clients/${clientId}/team`, data),
};
