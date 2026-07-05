// ============================================================================
// Program 1 — Universal Membership Model
// One subscription. Full platform capabilities for every subscriber.
// Access restrictions apply only through ownership and delegated permissions.
// ============================================================================

export const DELEGATED_USER_LIMIT = 5;
export const TRIAL_PERIOD_DAYS = 30;

/** Every subscriber receives all platform capabilities regardless of plan. */
export const UNIVERSAL_PLATFORM_CAPABILITIES = Object.freeze([
  'case_management',
  'document_platform',
  'evidence_platform',
  'attorney_workbench',
  'investigator_workbench',
  'client_portal',
  'knowledge_graph',
  'calcrim_explorer',
  'authority_explorer',
  'contradiction_engine',
  'document_redaction',
  'disclosure_manager',
  'delegated_access',
  'secure_messaging',
  'billing_portal',
]);

export type UniversalPlanId =
  | 'TRIAL'
  | 'INDIVIDUAL'
  | 'STANDARD'
  | 'COMPLEX_CASE'
  | 'PROFESSIONAL'
  // Legacy aliases (backward compatible)
  | 'FREE'
  | 'STARTER'
  | 'PROFESSIONAL_LEGACY'
  | 'ADVANCED_INVESTIGATOR'
  | 'LITIGATION_INTELLIGENCE_PRO'
  | 'ENTERPRISE_FIRM';

export interface UniversalPlan {
  id: UniversalPlanId;
  name: string;
  priceCentsMonthly: number;
  priceCentsAnnual: number;
  storageLabel: string;
  monthlyAiCredits: number;
  description: string;
  stripePlanKey: string;
}

export const UNIVERSAL_PLANS: readonly UniversalPlan[] = Object.freeze([
  {
    id: 'TRIAL',
    name: 'Free Trial',
    priceCentsMonthly: 0,
    priceCentsAnnual: 0,
    storageLabel: '250 MB',
    monthlyAiCredits: 50,
    description: '30-day full platform trial, no credit card required',
    stripePlanKey: '',
  },
  {
    id: 'INDIVIDUAL',
    name: 'Individual',
    priceCentsMonthly: 2900,
    priceCentsAnnual: 29000,
    storageLabel: '5 GB',
    monthlyAiCredits: 50,
    description: 'Full platform access for individual cases',
    stripePlanKey: 'individual',
  },
  {
    id: 'STANDARD',
    name: 'Standard',
    priceCentsMonthly: 7900,
    priceCentsAnnual: 79000,
    storageLabel: '25 GB',
    monthlyAiCredits: 250,
    description: 'Full platform access with expanded storage',
    stripePlanKey: 'standard',
  },
  {
    id: 'COMPLEX_CASE',
    name: 'Complex Case',
    priceCentsMonthly: 14900,
    priceCentsAnnual: 149000,
    storageLabel: '100 GB',
    monthlyAiCredits: 1000,
    description: 'Full platform access for complex litigation',
    stripePlanKey: 'complex_case',
  },
  {
    id: 'PROFESSIONAL',
    name: 'Professional',
    priceCentsMonthly: 39900,
    priceCentsAnnual: 399000,
    storageLabel: '1 TB',
    monthlyAiCredits: 5000,
    description: 'Full platform access, multi-case support',
    stripePlanKey: 'professional',
  },
]);

const LEGACY_PLAN_MAP: Record<string, UniversalPlanId> = {
  FREE: 'TRIAL',
  STARTER: 'INDIVIDUAL',
  PROFESSIONAL: 'STANDARD',
  PROFESSIONAL_LEGACY: 'STANDARD',
  ADVANCED_INVESTIGATOR: 'COMPLEX_CASE',
  LITIGATION_INTELLIGENCE_PRO: 'PROFESSIONAL',
  ENTERPRISE_FIRM: 'PROFESSIONAL',
};

export function normalizePlanId(planId: string): UniversalPlanId {
  const upper = planId.toUpperCase().replace(/-/g, '_') as UniversalPlanId;
  return LEGACY_PLAN_MAP[upper] ?? upper;
}

export function getUniversalPlan(planId: string): UniversalPlan | null {
  const normalized = normalizePlanId(planId);
  return UNIVERSAL_PLANS.find((p) => p.id === normalized) ?? null;
}

export function mapPlanToTier(planId: string): string {
  const normalized = normalizePlanId(planId);
  const tiers: Record<string, string> = {
    TRIAL: 'trial',
    INDIVIDUAL: 'individual',
    STANDARD: 'standard',
    COMPLEX_CASE: 'complex',
    PROFESSIONAL: 'professional',
  };
  return tiers[normalized] ?? 'trial';
}

/** Map subscription status from DB to frontend-friendly value. */
export function mapSubscriptionStatusForClient(status: string): string {
  if (status === 'trialing') return 'trial';
  return status;
}

export const PERMISSION_LEVELS = [
  'none',
  'view',
  'comment',
  'upload',
  'edit',
  'approve',
  'admin',
] as const;

export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export const RESOURCE_SCOPES = [
  'organization',
  'office',
  'case',
  'charge',
  'document',
  'ocr',
  'evidence',
  'timeline',
  'witness',
  'lead',
  'report',
  'authority',
  'calcrim',
  'notes',
  'communications',
  'billing',
  'dashboard',
] as const;

export type ResourceScope = (typeof RESOURCE_SCOPES)[number];

const LEVEL_RANK: Record<PermissionLevel, number> = {
  none: 0,
  view: 1,
  comment: 2,
  upload: 3,
  edit: 4,
  approve: 5,
  admin: 6,
};

export { LEVEL_RANK };

export function permissionSatisfies(granted: string, required: PermissionLevel): boolean {
  const g = granted as PermissionLevel;
  return (LEVEL_RANK[g] ?? 0) >= (LEVEL_RANK[required] ?? 0);
}
