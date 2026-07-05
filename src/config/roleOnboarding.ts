// ============================================================================
// Program 2A — Role-Based Onboarding (frontend config) v17.0
// ============================================================================

export const DEFAULT_ROLES = [
  'attorney',
  'criminal_investigator',
  'criminal_defendant',
  'self_represented_litigant',
  'paralegal',
  'secretary',
  'legal_assistant',
  'law_office_administrator',
  'expert_witness',
  'family_member',
  'interpreter',
  'consultant',
  'other',
] as const;

export type DefaultRole = (typeof DEFAULT_ROLES)[number];

export const REGISTRATION_ROLE_OPTIONS: { value: DefaultRole; label: string; description: string }[] = [
  { value: 'attorney', label: 'Attorney', description: 'Criminal defense attorney or counsel of record' },
  { value: 'criminal_investigator', label: 'Criminal Investigator', description: 'Private or defense investigator' },
  { value: 'criminal_defendant', label: 'Criminal Defendant', description: 'Defendant represented by counsel' },
  { value: 'self_represented_litigant', label: 'Self-Represented Litigant', description: 'Defendant representing themselves pro per' },
  { value: 'paralegal', label: 'Paralegal', description: 'Paralegal supporting defense litigation' },
  { value: 'secretary', label: 'Secretary', description: 'Legal secretary managing schedules and communications' },
  { value: 'legal_assistant', label: 'Legal Assistant', description: 'Legal assistant supporting document preparation' },
  { value: 'law_office_administrator', label: 'Law Office Administrator', description: 'Firm administrator managing users and billing' },
  { value: 'expert_witness', label: 'Expert Witness', description: 'Forensic, medical, or technical expert' },
  { value: 'family_member', label: 'Family Member', description: 'Authorized family member supporting a defendant' },
  { value: 'interpreter', label: 'Interpreter', description: 'Court-certified or case interpreter' },
  { value: 'consultant', label: 'Consultant', description: 'External consultant supporting defense strategy' },
  { value: 'other', label: 'Other', description: 'Other authorized case participant' },
];

const PORTAL_ROLES = new Set<DefaultRole>([
  'criminal_defendant',
  'self_represented_litigant',
  'family_member',
]);

export const ROLE_DASHBOARD_ROUTES: Record<DefaultRole, string> = {
  attorney: '/dashboard',
  criminal_investigator: '/dashboard',
  criminal_defendant: '/client-portal',
  self_represented_litigant: '/client-portal',
  paralegal: '/dashboard',
  secretary: '/dashboard',
  legal_assistant: '/dashboard',
  expert_witness: '/dashboard',
  family_member: '/client-portal',
  law_office_administrator: '/dashboard',
  interpreter: '/dashboard',
  consultant: '/dashboard',
  other: '/dashboard',
};

export function getDefaultDashboardForRole(defaultRole: DefaultRole | string): string {
  if (defaultRole in ROLE_DASHBOARD_ROUTES) {
    return ROLE_DASHBOARD_ROUTES[defaultRole as DefaultRole];
  }
  return '/dashboard';
}

export function isPortalRole(defaultRole: DefaultRole | string | undefined): boolean {
  return defaultRole != null && PORTAL_ROLES.has(defaultRole as DefaultRole);
}
