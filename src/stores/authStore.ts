// ============================================
// Court Access — Auth Store (Zustand)
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole, DefaultRole } from '../types';
import { ROLE_PERMISSIONS } from '../constants';

type SubscriptionStatus = 'active' | 'trial' | 'trialing' | 'past_due' | 'cancelled' | 'none';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  subscriptionStatus: SubscriptionStatus;
  login: (email: string, password: string) => Promise<{ mfaRequired?: boolean; mfaSessionToken?: string }>;
  completeMfaLogin: (mfaSessionToken: string, code: string) => Promise<void>;
  register: (name: string, email: string, password: string, defaultRole: DefaultRole, options?: { termsAccepted?: boolean; privacyAccepted?: boolean }) => Promise<{ onboarding?: { postRegistrationRoute?: string; defaultDashboard?: string } } | void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  setSubscriptionStatus: (status: SubscriptionStatus) => void;
  hasPermission: (permission: keyof typeof ROLE_PERMISSIONS.admin) => boolean;
}

const API_BASE = '/api';

export const useAuthStore = create<AuthState>()(persist((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  subscriptionStatus: 'none',

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
      if (data.mfaRequired && data.mfaSessionToken) {
        set({ isLoading: false });
        return { mfaRequired: true, mfaSessionToken: data.mfaSessionToken };
      }
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
          name: data.user.name || data.user.email.split('@')[0],
          email: data.user.email,
          role: data.user.role,
        },
        isAuthenticated: true,
        isLoading: false,
        subscriptionStatus: (data.user.subscriptionStatus as SubscriptionStatus) || 'none',
      });
      return {};
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  completeMfaLogin: async (mfaSessionToken: string, code: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/auth/mfa/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaSessionToken, code }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'MFA verification failed' }));
        throw new Error(err.error || 'Invalid code');
      }
      const data = await res.json();
      if (data.accessToken) localStorage.setItem('court-access-token', data.accessToken);
      if (data.refreshToken) localStorage.setItem('court-access-refresh-token', data.refreshToken);
      set({
        user: {
          id: data.user.userId,
          name: data.user.name || data.user.email.split('@')[0],
          email: data.user.email,
          role: data.user.role,
        },
        isAuthenticated: true,
        isLoading: false,
        subscriptionStatus: (data.user.subscriptionStatus as SubscriptionStatus) || 'none',
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (name, email, password, defaultRole, options) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          defaultRole,
          termsAccepted: options?.termsAccepted ?? false,
          privacyAccepted: options?.privacyAccepted ?? false,
        }),
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
        user: {
          id: data.user.userId,
          name: data.user.name || name,
          email: data.user.email,
          role: data.user.role,
          defaultRole: data.user.defaultRole,
        },
        isAuthenticated: true,
        isLoading: false,
        subscriptionStatus: (data.user.subscriptionStatus as SubscriptionStatus) || 'none',
      });
      return { onboarding: data.onboarding };
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
    set({ user: null, isAuthenticated: false, subscriptionStatus: 'none' });
  },

  switchRole: (role: UserRole) => {
    const { user } = get();
    if (user) {
      set({ user: { ...user, role } });
    }
  },

  setSubscriptionStatus: (status: SubscriptionStatus) => {
    set({ subscriptionStatus: status });
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
    subscriptionStatus: state.subscriptionStatus,
  }),
}));
