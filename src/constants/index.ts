// ============================================
// Court Access — Design Tokens & Constants
// ============================================

import type { UserRole, RolePermissions, EvidenceStatus, MotionPriority, TaskPriority, AIAnalysisStatus, ExpertRecommendation } from '../types';

// --- Color Tokens ---
export const COLORS = {
  primary: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#1E3A5F',
    600: '#172E4A',
    700: '#112236',
    800: '#0B1621',
    900: '#050B11',
  },
  secondary: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#C8963E',
    600: '#B8860B',
    700: '#92400E',
    800: '#78350F',
    900: '#451A03',
  },
  success: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
  },
  danger: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
  },
  muted: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  info: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
  },
} as const;

// --- Evidence Status Badge Map (deterministic) ---
export const EVIDENCE_STATUS_CONFIG: Record<EvidenceStatus, { label: string; bgColor: string; textColor: string; icon: string }> = {
  established: { label: 'Established', bgColor: 'bg-green-100', textColor: 'text-green-800', icon: 'check-circle' },
  disputed: { label: 'Disputed', bgColor: 'bg-red-100', textColor: 'text-red-800', icon: 'x-circle' },
  weak: { label: 'Weak Evidence', bgColor: 'bg-amber-100', textColor: 'text-amber-800', icon: 'alert-triangle' },
  unclear: { label: 'Unclear', bgColor: 'bg-purple-100', textColor: 'text-purple-800', icon: 'help-circle' },
} as const;

// --- Motion Priority Badge Map (deterministic) ---
export const MOTION_PRIORITY_CONFIG: Record<MotionPriority, { label: string; bgColor: string; textColor: string }> = {
  high: { label: 'HIGH PRIORITY', bgColor: 'bg-red-500', textColor: 'text-white' },
  medium: { label: 'MEDIUM PRIORITY', bgColor: 'bg-amber-500', textColor: 'text-white' },
  low: { label: 'LOW PRIORITY', bgColor: 'bg-blue-500', textColor: 'text-white' },
} as const;

// --- Task Priority Badge Map (deterministic) ---
export const TASK_PRIORITY_CONFIG: Record<TaskPriority, { label: string; bgColor: string; textColor: string; borderColor: string }> = {
  high: { label: 'HIGH PRIORITY', bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' },
  medium: { label: 'MEDIUM PRIORITY', bgColor: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-200' },
  standard: { label: 'STANDARD', bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
} as const;

// --- AI Analysis Status Badge Map (deterministic) ---
export const AI_STATUS_CONFIG: Record<AIAnalysisStatus, { label: string; bgColor: string; textColor: string }> = {
  analyzed: { label: 'Analyzed', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  analyzing: { label: 'Analyzing...', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  pending: { label: 'Pending', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },
  failed: { label: 'Failed', bgColor: 'bg-red-100', textColor: 'text-red-800' },
} as const;

// --- Expert Recommendation Badge Map (deterministic) ---
export const EXPERT_RECOMMENDATION_CONFIG: Record<ExpertRecommendation, { label: string; bgColor: string; textColor: string }> = {
  recommended: { label: 'RECOMMENDED', bgColor: 'bg-green-500', textColor: 'text-white' },
  consider: { label: 'CONSIDER', bgColor: 'bg-blue-500', textColor: 'text-white' },
} as const;

// --- Role Permissions Map (deterministic) ---
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  investigator: {
    canViewCharges: true,
    canViewEvidence: true,
    canViewExperts: false,
    canViewMotions: false,
    canViewResearch: false,
    canViewActivity: true,
    canViewDocuments: true,
    canUploadDocuments: true,
    canManageCases: false,
    canViewAdmin: false,
    canViewTasks: true,
    canViewSettings: true,
  },
  attorney: {
    canViewCharges: true,
    canViewEvidence: true,
    canViewExperts: true,
    canViewMotions: true,
    canViewResearch: true,
    canViewActivity: true,
    canViewDocuments: true,
    canUploadDocuments: true,
    canManageCases: true,
    canViewAdmin: false,
    canViewTasks: true,
    canViewSettings: true,
  },
  admin: {
    canViewCharges: true,
    canViewEvidence: true,
    canViewExperts: true,
    canViewMotions: true,
    canViewResearch: true,
    canViewActivity: true,
    canViewDocuments: true,
    canUploadDocuments: true,
    canManageCases: true,
    canViewAdmin: true,
    canViewTasks: true,
    canViewSettings: true,
  },
  staff: {
    canViewCharges: true,
    canViewEvidence: true,
    canViewExperts: false,
    canViewMotions: false,
    canViewResearch: false,
    canViewActivity: true,
    canViewDocuments: true,
    canUploadDocuments: true,
    canManageCases: false,
    canViewAdmin: false,
    canViewTasks: false,
    canViewSettings: true,
  },
  client: {
    canViewCharges: false,
    canViewEvidence: false,
    canViewExperts: false,
    canViewMotions: false,
    canViewResearch: false,
    canViewActivity: false,
    canViewDocuments: true,
    canUploadDocuments: true,
    canManageCases: false,
    canViewAdmin: false,
    canViewTasks: false,
    canViewSettings: true,
  },
} as const;

// --- Case Tab Definitions (deterministic order) ---
export const CASE_TABS = [
  { id: 'overview', label: 'Overview', path: '', permission: null },
  { id: 'charges', label: 'Charges', path: '/charges', permission: 'canViewCharges' as const },
  { id: 'evidence', label: 'Evidence', path: '/evidence', permission: 'canViewEvidence' as const },
  { id: 'documents', label: 'Documents', path: '/documents', permission: 'canViewDocuments' as const },
  { id: 'experts', label: 'Experts', path: '/experts', permission: 'canViewExperts' as const },
  { id: 'motions', label: 'Motions', path: '/motions', permission: 'canViewMotions' as const },
  { id: 'research', label: 'Research', path: '/research', permission: 'canViewResearch' as const },
  { id: 'activity', label: 'Activity', path: '/activity', permission: 'canViewActivity' as const },
  { id: 'settings', label: 'Settings', path: '/settings', permission: 'canManageCases' as const },
] as const;

// --- Sidebar Navigation ---
export const SIDEBAR_NAV = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard', permission: null },
  { id: 'cases', label: 'Cases', path: '/cases', icon: 'Briefcase', permission: null },
  { id: 'search', label: 'Search', path: '/search', icon: 'Search', permission: null },
  { id: 'notifications', label: 'Notifications & Alerts', path: '/notifications', icon: 'Bell', permission: null },
  { id: 'settings', label: 'Settings', path: '/settings', icon: 'Settings', permission: 'canViewSettings' as const },
  { id: 'admin', label: 'Admin', path: '/admin', icon: 'Shield', permission: 'canViewAdmin' as const },
] as const;
