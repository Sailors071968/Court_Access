// ============================================
// Court Access — Auth Store (Zustand) — Phase 96
// Real JWT authentication against backend API.
// ============================================

import { create } from 'zustand';
import type { User, UserRole } from '../types';
import { ROLE_PERMISSIONS } from '../constants';
import { getToken, setToken, clearAllTokens, setRefreshToken, getRefreshToken, apiFetch } from '../services/apiClient';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionChecked: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  hasPermission: (permission: keyof typeof ROLE_PERMISSIONS.admin) => boolean;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  sessionChecked: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });

    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      set({ isLoading: false });
      throw new Error(data.error || 'Login failed');
    }

    // Store JWT tokens (access + refresh)
    setToken(data.token);
    if (data.refreshToken) setRefreshToken(data.refreshToken);

    set({
      user: {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role as UserRole,
      },
      isAuthenticated: true,
      isLoading: false,
      sessionChecked: true,
    });
  },

  register: async (name: string, email: string, password: string, _role: UserRole) => {
    set({ isLoading: true });

    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await res.json();

    if (!res.ok) {
      set({ isLoading: false });
      throw new Error(data.error || 'Registration failed');
    }

    // Store JWT tokens (access + refresh)
    setToken(data.token);
    if (data.refreshToken) setRefreshToken(data.refreshToken);

    set({
      user: {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role as UserRole,
      },
      isAuthenticated: true,
      isLoading: false,
      sessionChecked: true,
    });
  },

  logout: () => {
    // Phase 96I: Revoke refresh token on server before clearing
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {}); // Fire and forget
    }
    clearAllTokens();
    set({ user: null, isAuthenticated: false });
  },

  switchRole: (role: UserRole) => {
    const { user } = get();
    if (user) {
      set({ user: { ...user, role } });
    }
  },

  hasPermission: (permission) => {
    const { user } = get();
    if (!user) return false;
    return ROLE_PERMISSIONS[user.role][permission];
  },

  // Restore session from stored JWT on app load
  restoreSession: async () => {
    const token = getToken();
    if (!token) {
      set({ sessionChecked: true });
      return;
    }

    try {
      const res = await apiFetch('/api/auth/me');
      if (!res.ok) {
          // Only clear token on 401 (unauthorized/expired) — not on transient 500 errors
          if (res.status === 401) {
            clearAllTokens();
          }
        set({ sessionChecked: true });
        return;
      }

      const data = await res.json();
      set({
        user: {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role as UserRole,
        },
        isAuthenticated: true,
        sessionChecked: true,
      });
    } catch {
      // Token invalid or expired — clear silently
      clearAllTokens();
      set({ sessionChecked: true });
    }
  },
}));
