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

export async function loginApi(request: LoginRequest): Promise<LoginResponse> {
  void request;
  // Mock implementation — will be replaced with real API
  await new Promise((resolve) => setTimeout(resolve, 800));
  return {
    token: 'mock-jwt-token-' + Date.now(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function forgotPasswordApi(email: string): Promise<{ success: boolean }> {
  void email;
  await new Promise((resolve) => setTimeout(resolve, 800));
  return { success: true };
}

export async function resetPasswordApi(
  token: string,
  newPassword: string
): Promise<{ success: boolean }> {
  void token;
  void newPassword;
  await new Promise((resolve) => setTimeout(resolve, 800));
  return { success: true };
}
