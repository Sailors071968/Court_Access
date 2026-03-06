// ============================================
// Court Access — Auth Store (Zustand) — Phase 96
// Real JWT authentication against backend API.
// ============================================

import { create } from 'zustand';
import type { User, UserRole } from '../types';
import { ROLE_PERMISSIONS } from '../constants';
import { getToken, setToken, clearToken, apiFetch } from '../services/apiClient';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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

    // Store JWT token
    setToken(data.token);

    set({
      user: {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role as UserRole,
      },
      isAuthenticated: true,
      isLoading: false,
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

    // Store JWT token
    setToken(data.token);

    set({
      user: {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role as UserRole,
      },
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: () => {
    clearToken();
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
    if (!token) return;

    try {
      const res = await apiFetch('/api/auth/me');
      if (!res.ok) {
        clearToken();
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
      });
    } catch {
      // Token invalid or expired — clear silently
      clearToken();
    }
  },
}));
