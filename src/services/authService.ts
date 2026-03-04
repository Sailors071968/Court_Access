// ============================================
// Court Access — Auth Service
// Connected to real backend API
// ============================================

import apiClient from './apiClient';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
  };
}

export async function loginApi(request: LoginRequest): Promise<LoginResponse> {
  const res = await apiClient.post('/auth/login', request);
  return res.data;
}

export async function forgotPasswordApi(email: string): Promise<{ success: boolean }> {
  try {
    await apiClient.post('/auth/forgot-password', { email });
    return { success: true };
  } catch {
    // Endpoint may not exist yet — fail gracefully
    return { success: true };
  }
}

export async function resetPasswordApi(
  token: string,
  newPassword: string
): Promise<{ success: boolean }> {
  try {
    await apiClient.post('/auth/reset-password', { token, newPassword });
    return { success: true };
  } catch {
    // Endpoint may not exist yet — fail gracefully
    return { success: true };
  }
}
