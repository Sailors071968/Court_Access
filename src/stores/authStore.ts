// ============================================
// Court Access — Auth Store (Zustand)
// Connected to real backend API
// ============================================

import { create } from 'zustand';
import type { User, UserRole } from '../types';
import { ROLE_PERMISSIONS } from '../constants';
import apiClient from '../services/apiClient';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  hasPermission: (permission: keyof typeof ROLE_PERMISSIONS.admin) => boolean;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('court_access_token'),
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post('/auth/login', { email, password });
      const { token, user } = res.data;
      localStorage.setItem('court_access_token', token);
      set({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
          phone: user.phone,
        },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (name: string, email: string, password: string, role: UserRole) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post('/auth/register', { name, email, password, role });
      const { token, user } = res.data;
      localStorage.setItem('court_access_token', token);
      set({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
          phone: undefined,
        },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('court_access_token');
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

  loadUser: async () => {
    const token = localStorage.getItem('court_access_token');
    if (!token) {
      set({ user: null, isAuthenticated: false });
      return;
    }
    try {
      const res = await apiClient.get('/auth/me');
      const user = res.data;
      set({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
          phone: user.phone,
        },
        isAuthenticated: true,
      });
    } catch {
      localStorage.removeItem('court_access_token');
      set({ user: null, isAuthenticated: false });
    }
  },
}));
