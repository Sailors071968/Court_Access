// ============================================
// Court Access — Auth Store (Zustand)
// ============================================

import { create } from 'zustand';
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

// Mock users for development
const MOCK_USERS: Record<string, User> = {
  'attorney@courtaccess.com': {
    id: '1',
    name: 'Attorney Jane Doe',
    email: 'attorney@courtaccess.com',
    role: 'attorney',
    avatar: undefined,
  },
  'investigator@courtaccess.com': {
    id: '2',
    name: 'Agent J. Doe',
    email: 'investigator@courtaccess.com',
    role: 'investigator',
    avatar: undefined,
  },
  'admin@courtaccess.com': {
    id: '3',
    name: 'Admin User',
    email: 'admin@courtaccess.com',
    role: 'admin',
    avatar: undefined,
  },
  'staff@courtaccess.com': {
    id: '4',
    name: 'Staff Member',
    email: 'staff@courtaccess.com',
    role: 'staff',
    avatar: undefined,
  },
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email: string, _password: string) => {
    set({ isLoading: true });
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    const mockUser = MOCK_USERS[email];
    if (mockUser) {
      set({ user: mockUser, isAuthenticated: true, isLoading: false });
    } else {
      // Default to attorney role for any email
      set({
        user: {
          id: '99',
          name: email.split('@')[0],
          email,
          role: 'attorney',
        },
        isAuthenticated: true,
        isLoading: false,
      });
    }
  },

  register: async (name: string, email: string, _password: string, role: UserRole) => {
    set({ isLoading: true });
    await new Promise((resolve) => setTimeout(resolve, 800));
    set({
      user: { id: Date.now().toString(), name, email, role },
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: () => {
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
}));
