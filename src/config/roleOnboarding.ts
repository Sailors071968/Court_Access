// ============================================================================
// Program 2A — Role-Based Onboarding (frontend config)
// ============================================================================

export const DEFAULT_ROLES = [
  'attorney',
  'criminal_investigator',
  'criminal_defendant',
  'paralegal',
  'secretary',
  'expert_witness',
  'family_member',
  'law_office_administrator',
  'other',
] as const;

export type DefaultRole = (typeof DEFAULT_ROLES)[number];

export interface RoleOnboardingConfig {
  defaultRole: DefaultRole;
  label: string;
  description: string;
  platformRole: 'attorney' | 'investigator' | 'staff' | 'defendant' | 'admin';
  defaultDashboard: string;
  postRegistrationRoute: string;
  onboardingSteps: readonly string[];
  recommendedWorkflows: readonly string[];
  navigationHighlights: readonly string[];
}

export const REGISTRATION_ROLE_OPTIONS: { value: DefaultRole; label: string; description: string }[] = [
  { value: 'attorney', label: 'Attorney', description: 'Criminal defense attorney or counsel of record' },
  { value: 'criminal_investigator', label: 'Criminal Investigator', description: 'Private or defense investigator' },
  { value: 'criminal_defendant', label: 'Criminal Defendant', description: 'Defendant managing their own case' },
  { value: 'paralegal', label: 'Paralegal', description: 'Paralegal supporting defense litigation' },
  { value: 'secretary', label: 'Secretary', description: 'Legal secretary or administrative support' },
  { value: 'expert_witness', label: 'Expert Witness', description: 'Forensic, medical, or technical expert' },
  { value: 'family_member', label: 'Family Member', description: 'Authorized family member supporting a defendant' },
  { value: 'law_office_administrator', label: 'Law Office Administrator', description: 'Firm administrator managing users and billing' },
  { value: 'other', label: 'Other', description: 'Consultant, interpreter, or other authorized participant' },
];

export const ROLE_DASHBOARD_ROUTES: Record<DefaultRole, string> = {
  attorney: '/dashboard',
  criminal_investigator: '/dashboard',
  criminal_defendant: '/client-portal',
  paralegal: '/dashboard',
  secretary: '/dashboard',
  expert_witness: '/dashboard',
  family_member: '/client-portal',
  law_office_administrator: '/dashboard',
  other: '/dashboard',
};

export function getDefaultDashboardForRole(defaultRole: DefaultRole | string): string {
  if (defaultRole in ROLE_DASHBOARD_ROUTES) {
    return ROLE_DASHBOARD_ROUTES[defaultRole as DefaultRole];
  }
  return '/dashboard';
}
