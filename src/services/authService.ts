// ============================================
// Court Access — Auth Service
// ============================================

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
}

export async function loginApi(request: LoginRequest): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(data.error || 'Login failed');
  }
  const data = await res.json();
  return {
    token: data.accessToken,
    expiresAt: new Date(Date.now() + (data.expiresIn || 900) * 1000).toISOString(),
  };
}

export async function forgotPasswordApi(email: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || 'Request failed');
  }
  return { success: true };
}

export async function resetPasswordApi(
  token: string,
  newPassword: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Reset failed' }));
    throw new Error(data.error || 'Reset failed');
  }
  return { success: true };
}
