// ============================================
// Court Access — Auth Service (Mock)
// ============================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
}

export async function loginApi(_request: LoginRequest): Promise<LoginResponse> {
  // Mock implementation — will be replaced with real API
  await new Promise((resolve) => setTimeout(resolve, 800));
  return {
    token: 'mock-jwt-token-' + Date.now(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function forgotPasswordApi(_email: string): Promise<{ success: boolean }> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return { success: true };
}

export async function resetPasswordApi(
  _token: string,
  _newPassword: string
): Promise<{ success: boolean }> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return { success: true };
}
