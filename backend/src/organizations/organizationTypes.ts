// ============================================================================
// Program 2 — Organization Types
// ============================================================================

export const ORG_TYPES = ['law_firm', 'solo', 'public_defender', 'investigator'] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const MEMBER_ROLES = ['admin', 'attorney', 'investigator', 'staff'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const INVITE_ROLES = MEMBER_ROLES;
export type InviteRole = MemberRole;

export const ONBOARDING_STEPS = ['created', 'profile', 'offices', 'team', 'complete'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const PRACTICE_AREAS = [
  'criminal_defense',
  'appellate',
  'juvenile',
  'federal',
  'misdemeanor',
  'felony',
] as const;

export function validateOrgType(value: string): value is OrgType {
  return (ORG_TYPES as readonly string[]).includes(value);
}

export function validateMemberRole(value: string): value is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(value);
}

export function validateOnboardingStep(value: string): value is OnboardingStep {
  return (ONBOARDING_STEPS as readonly string[]).includes(value);
}

export function isOrgAdmin(role: string, memberRole?: string | null): boolean {
  return role === 'admin' || memberRole === 'admin';
}

export interface UpdateOrganizationBody {
  name?: string;
  orgType?: OrgType;
  settings?: Record<string, unknown>;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  tagline?: string;
  website?: string;
  billingEmail?: string;
}

export interface CreateOfficeBody {
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  isPrimary?: boolean;
}

export interface CreatePracticeGroupBody {
  name: string;
  description?: string;
  practiceArea?: string;
  officeId?: string;
}

export interface CreateInvitationBody {
  email: string;
  role: InviteRole;
  officeId?: string;
  practiceGroupId?: string;
}

export interface AcceptInvitationBody {
  token: string;
  name: string;
  password: string;
}

export interface OnboardingBody {
  step: OnboardingStep;
  profile?: UpdateOrganizationBody;
  primaryOffice?: CreateOfficeBody;
}
