// ============================================
// Court Access — API Client (Phase 96)
// Centralized fetch wrapper that auto-attaches JWT Authorization header.
// All frontend API calls should use this instead of raw fetch().
// ============================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TOKEN_KEY = 'court_access_token';
const REFRESH_TOKEN_KEY = 'court_access_refresh_token';

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function clearAllTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Authenticated fetch wrapper
// ---------------------------------------------------------------------------

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Auto-attach Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Default to JSON content type for non-FormData bodies
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // If 401, attempt silent refresh before giving up
  if (res.status === 401) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      // Retry the original request with the new token
      const retryHeaders: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
      };
      const newToken = getToken();
      if (newToken) {
        retryHeaders['Authorization'] = `Bearer ${newToken}`;
      }
      if (options.body && !(options.body instanceof FormData)) {
        retryHeaders['Content-Type'] = retryHeaders['Content-Type'] || 'application/json';
      }
      return fetch(url, { ...options, headers: retryHeaders });
    }

    // Refresh failed — clear everything and redirect
    clearAllTokens();
    if (window.location.pathname.startsWith('/app')) {
      window.location.href = '/login';
    }
  }

  return res;
}

// ---------------------------------------------------------------------------
// Phase 96I: Silent token refresh
// ---------------------------------------------------------------------------

let refreshPromise: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        clearAllTokens();
        return false;
      }

      const data = await res.json();
      setToken(data.token);
      // Store rotated refresh token if provided
      if (data.refreshToken) {
        setRefreshToken(data.refreshToken);
      }
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ---------------------------------------------------------------------------
// Convenience methods
// ---------------------------------------------------------------------------

export async function apiGet(path: string): Promise<Response> {
  return apiFetch(path);
}

export async function apiPost(path: string, body?: unknown): Promise<Response> {
  return apiFetch(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut(path: string, body?: unknown): Promise<Response> {
  return apiFetch(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiPatch(path: string, body?: unknown): Promise<Response> {
  return apiFetch(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete(path: string): Promise<Response> {
  return apiFetch(path, { method: 'DELETE' });
}

export { API_BASE };
