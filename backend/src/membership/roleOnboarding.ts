// ============================================================================
// Program 2A — Role-Based Onboarding
// Default role determines dashboard, navigation, onboarding — NOT capabilities.
// Every subscriber receives the complete CourtAccess platform.
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

export interface RoleOnboardingConfig {
  defaultRole: DefaultRole;
  label: string;
  description: string;
  platformRole: 'attorney' | 'investigator' | 'staff' | 'defendant' | 'admin';
  personnelType: string | null;
  orgType: 'law_firm' | 'solo' | 'public_defender' | 'investigator';
  defaultDashboard: string;
  postRegistrationRoute: string;
  onboardingSteps: readonly string[];
  recommendedWorkflows: readonly string[];
  navigationHighlights: readonly string[];
}

export const ROLE_ONBOARDING_CONFIG: Record<DefaultRole, RoleOnboardingConfig> = {
  attorney: {
    defaultRole: 'attorney',
    label: 'Attorney',
    description: 'Criminal defense attorney or counsel of record',
    platformRole: 'attorney',
    personnelType: 'attorney',
    orgType: 'law_firm',
    defaultDashboard: '/dashboard',
    postRegistrationRoute: '/onboarding',
    onboardingSteps: ['welcome', 'organization', 'first_case', 'invite_team', 'upload_evidence'],
    recommendedWorkflows: ['charge_mapping', 'discovery_review', 'motion_preparation', 'client_publication'],
    navigationHighlights: ['cases', 'attorney_workbench', 'reports', 'disclosures'],
  },
  criminal_investigator: {
    defaultRole: 'criminal_investigator',
    label: 'Criminal Investigator',
    description: 'Private or defense investigator',
    platformRole: 'investigator',
    personnelType: 'investigator',
    orgType: 'investigator',
    defaultDashboard: '/dashboard',
    postRegistrationRoute: '/onboarding',
    onboardingSteps: ['welcome', 'organization', 'evidence_requests', 'first_case', 'osint_setup'],
    recommendedWorkflows: ['interview_management', 'surveillance_log', 'crime_scene', 'evidence_requests'],
    navigationHighlights: ['investigator_workbench', 'evidence', 'tasks', 'leads'],
  },
  criminal_defendant: {
    defaultRole: 'criminal_defendant',
    label: 'Criminal Defendant',
    description: 'Defendant represented by counsel',
    platformRole: 'defendant',
    personnelType: null,
    orgType: 'solo',
    defaultDashboard: '/client-portal',
    postRegistrationRoute: '/onboarding',
    onboardingSteps: ['welcome', 'understand_charges', 'court_dates', 'shared_documents', 'messaging'],
    recommendedWorkflows: ['review_charges', 'timeline', 'published_evidence', 'secure_messaging'],
    navigationHighlights: ['client_portal', 'timeline', 'documents', 'messages'],
  },
  self_represented_litigant: {
    defaultRole: 'self_represented_litigant',
    label: 'Self-Represented Litigant',
    description: 'Defendant representing themselves pro per',
    platformRole: 'defendant',
    personnelType: null,
    orgType: 'solo',
    defaultDashboard: '/client-portal',
    postRegistrationRoute: '/onboarding',
    onboardingSteps: ['welcome', 'understand_charges', 'legal_research', 'court_dates', 'document_upload'],
    recommendedWorkflows: ['charge_breakdown', 'calcrim_reference', 'timeline', 'evidence_organization'],
    navigationHighlights: ['client_portal', 'research', 'timeline', 'documents'],
  },
  paralegal: {
    defaultRole: 'paralegal',
    label: 'Paralegal',
    description: 'Paralegal supporting defense litigation',
    platformRole: 'staff',
    personnelType: 'paralegal',
    orgType: 'law_firm',
    defaultDashboard: '/dashboard',
    postRegistrationRoute: '/onboarding',
    onboardingSteps: ['welcome', 'organization', 'document_management', 'deadline_tracking'],
    recommendedWorkflows: ['document_organization', 'discovery_indexing', 'calendar_management'],
    navigationHighlights: ['documents', 'timeline', 'tasks', 'cases'],
  },
  secretary: {
    defaultRole: 'secretary',
    label: 'Secretary',
    description: 'Legal secretary managing schedules and communications',
    platformRole: 'staff',
    personnelType: 'receptionist',
    orgType: 'law_firm',
    defaultDashboard: '/dashboard',
    postRegistrationRoute: '/onboarding',
    onboardingSteps: ['welcome', 'organization', 'scheduling', 'communications'],
    recommendedWorkflows: ['court_date_tracking', 'client_communications', 'filing_management'],
    navigationHighlights: ['calendar', 'messages', 'cases', 'contacts'],
  },
  legal_assistant: {
    defaultRole: 'legal_assistant',
    label: 'Legal Assistant',
    description: 'Legal assistant supporting document preparation and case files',
    platformRole: 'staff',
    personnelType: 'legal_assistant',
    orgType: 'law_firm',
    defaultDashboard: '/dashboard',
    postRegistrationRoute: '/onboarding',
    onboardingSteps: ['welcome', 'organization', 'document_preparation', 'filing_support'],
    recommendedWorkflows: ['document_drafting', 'discovery_support', 'calendar_management'],
    navigationHighlights: ['documents', 'cases', 'tasks', 'timeline'],
  },
  expert_witness: {
    defaultRole: 'expert_witness',
    label: 'Expert Witness',
    description: 'Forensic, medical, or technical expert',
    platformRole: 'staff',
    personnelType: 'expert_witness',
    orgType: 'solo',
    defaultDashboard: '/dashboard',
    postRegistrationRoute: '/onboarding',
    onboardingSteps: ['welcome', 'scoped_access', 'evidence_review', 'report_generation'],
    recommendedWorkflows: ['published_evidence_review', 'expert_report', 'attorney_collaboration'],
    navigationHighlights: ['shared_access', 'documents', 'reports', 'messages'],
  },
  family_member: {
    defaultRole: 'family_member',
    label: 'Family Member',
    description: 'Authorized family member supporting a defendant',
    platformRole: 'staff',
    personnelType: null,
    orgType: 'solo',
    defaultDashboard: '/client-portal',
    postRegistrationRoute: '/onboarding',
    onboardingSteps: ['welcome', 'delegated_access', 'court_dates', 'published_updates'],
    recommendedWorkflows: ['court_date_alerts', 'published_documents', 'family_messaging'],
    navigationHighlights: ['client_portal', 'timeline', 'notifications', 'messages'],
  },
  law_office_administrator: {
    defaultRole: 'law_office_administrator',
    label: 'Law Office Administrator',
    description: 'Firm administrator managing users and billing',
    platformRole: 'staff',
    personnelType: 'office_admin',
    orgType: 'law_firm',
    defaultDashboard: '/dashboard',
    postRegistrationRoute: '/onboarding',
    onboardingSteps: ['welcome', 'organization', 'team_management', 'billing_setup'],
    recommendedWorkflows: ['user_management', 'billing_portal', 'firm_settings', 'usage_reports'],
    navigationHighlights: ['organization', 'billing', 'team', 'admin'],
  },
  interpreter: {
    defaultRole: 'interpreter',
    label: 'Interpreter',
    description: 'Court-certified or case interpreter',
    platformRole: 'staff',
    personnelType: null,
    orgType: 'solo',
    defaultDashboard: '/dashboard',
    postRegistrationRoute: '/onboarding',
    onboardingSteps: ['welcome', 'scoped_access', 'session_scheduling', 'communications'],
    recommendedWorkflows: ['hearing_schedule', 'published_materials', 'secure_messaging'],
    navigationHighlights: ['calendar', 'messages', 'shared_access', 'cases'],
  },
  consultant: {
    defaultRole: 'consultant',
    label: 'Consultant',
    description: 'External consultant supporting defense strategy',
    platformRole: 'staff',
    personnelType: 'contract_investigator',
    orgType: 'solo',
    defaultDashboard: '/dashboard',
    postRegistrationRoute: '/onboarding',
    onboardingSteps: ['welcome', 'scoped_access', 'case_briefing', 'deliverables'],
    recommendedWorkflows: ['case_analysis', 'evidence_review', 'report_delivery'],
    navigationHighlights: ['shared_access', 'documents', 'reports', 'messages'],
  },
  other: {
    defaultRole: 'other',
    label: 'Other',
    description: 'Other authorized case participant',
    platformRole: 'staff',
    personnelType: null,
    orgType: 'solo',
    defaultDashboard: '/dashboard',
    postRegistrationRoute: '/onboarding',
    onboardingSteps: ['welcome', 'platform_overview', 'permissions', 'first_workspace'],
    recommendedWorkflows: ['case_access', 'evidence_review', 'secure_messaging'],
    navigationHighlights: ['cases', 'shared_access', 'messages'],
  },
};

export function validateDefaultRole(value: string): value is DefaultRole {
  return (DEFAULT_ROLES as readonly string[]).includes(value);
}

export function resolveRoleOnboarding(defaultRole: string): RoleOnboardingConfig {
  if (validateDefaultRole(defaultRole)) {
    return ROLE_ONBOARDING_CONFIG[defaultRole];
  }
  return ROLE_ONBOARDING_CONFIG.other;
}

export function mapDefaultRoleToPlatformRole(defaultRole: string): RoleOnboardingConfig['platformRole'] {
  return resolveRoleOnboarding(defaultRole).platformRole;
}
