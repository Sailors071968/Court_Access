// ============================================
// Court Access — Auth Store (Zustand)
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole } from '../types';
import { ROLE_PERMISSIONS } from '../constants';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  hasPermission: (permission: keyof typeof ROLE_PERMISSIONS.admin) => boolean;
}

const API_BASE = '/api';

export const useAuthStore = create<AuthState>()(persist((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(err.error || 'Invalid credentials');
      }
      const data = await res.json();
      // Store the access token for authenticated API calls
      if (data.accessToken) {
        localStorage.setItem('court-access-token', data.accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem('court-access-refresh-token', data.refreshToken);
      }
      set({
        user: {
          id: data.user.userId,
          name: data.user.email.split('@')[0],
          email: data.user.email,
          role: data.user.role,
        },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (name: string, email: string, password: string, role: UserRole) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(err.error || 'Registration failed');
      }
      const data = await res.json();
      if (data.accessToken) {
        localStorage.setItem('court-access-token', data.accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem('court-access-refresh-token', data.refreshToken);
      }
      set({
        user: { id: data.user.userId, name, email: data.user.email, role: data.user.role },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    // Attempt to call backend logout (fire-and-forget)
    const token = localStorage.getItem('court-access-token');
    if (token) {
      fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      }).catch(() => { /* ignore */ });
    }
    localStorage.removeItem('court-access-token');
    localStorage.removeItem('court-access-refresh-token');
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
}), {
  name: 'court-access-auth',
  partialize: (state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
  }),
}));
