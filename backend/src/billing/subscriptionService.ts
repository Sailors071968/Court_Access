// ============================================================================
// CourtAccess — Subscription Plan Service
// Manages subscription tiers with page limits and AI credits.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubscriptionPlanId =
  | 'FREE'
  | 'STARTER'
  | 'PROFESSIONAL'
  | 'ADVANCED_INVESTIGATOR'
  | 'LITIGATION_INTELLIGENCE_PRO'
  | 'ENTERPRISE_FIRM';

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  priceCents: number;              // Monthly price in cents (0 for free)
  monthlyPageLimit: number;        // Pages per month (cumulative across cases)
  monthlyAiCredits: number;        // AI credits per month
  isLifetime: boolean;             // True for free tier (lifetime limit, not monthly)
  multiUser: boolean;              // Multi-user accounts
  apiAccess: boolean;              // API access included
  description: string;
}

export interface UserSubscription {
  userId: string;
  planId: SubscriptionPlanId;
  activatedAt: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
}

// ---------------------------------------------------------------------------
// Static Plan Registry — immutable
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = Object.freeze([
  {
    id: 'FREE',
    name: 'Free',
    priceCents: 0,
    monthlyPageLimit: 10,
    monthlyAiCredits: 0,
    isLifetime: true,
    multiUser: false,
    apiAccess: false,
    description: '10 pages lifetime, no credit card required',
  },
  {
    id: 'STARTER',
    name: 'Starter',
    priceCents: 3900,
    monthlyPageLimit: 300,
    monthlyAiCredits: 20,
    isLifetime: false,
    multiUser: false,
    apiAccess: false,
    description: '300 pages/month, 20 AI credits/month',
  },
  {
    id: 'PROFESSIONAL',
    name: 'Professional',
    priceCents: 12900,
    monthlyPageLimit: 2000,
    monthlyAiCredits: 100,
    isLifetime: false,
    multiUser: false,
    apiAccess: false,
    description: '2,000 pages/month, 100 AI credits/month',
  },
  {
    id: 'ADVANCED_INVESTIGATOR',
    name: 'Advanced Investigator',
    priceCents: 24900,
    monthlyPageLimit: 6000,
    monthlyAiCredits: 250,
    isLifetime: false,
    multiUser: false,
    apiAccess: false,
    description: '6,000 pages/month, 250 AI credits/month',
  },
  {
    id: 'LITIGATION_INTELLIGENCE_PRO',
    name: 'Litigation Pro',
    priceCents: 39900,
    monthlyPageLimit: 12000,
    monthlyAiCredits: 500,
    isLifetime: false,
    multiUser: false,
    apiAccess: false,
    description: '12,000 pages/month, 500 AI credits/month',
  },
  {
    id: 'ENTERPRISE_FIRM',
    name: 'Enterprise Firm',
    priceCents: 69900,
    monthlyPageLimit: 25000,
    monthlyAiCredits: 1500,
    isLifetime: false,
    multiUser: true,
    apiAccess: true,
    description: '25,000 pages/month, 1,500 AI credits/month, multi-user, API access',
  },
] as SubscriptionPlan[]);

// ---------------------------------------------------------------------------
// Plan Lookup
// ---------------------------------------------------------------------------

export function getPlanById(planId: SubscriptionPlanId): SubscriptionPlan | null {
  for (const plan of SUBSCRIPTION_PLANS) {
    if (plan.id === planId) return plan;
  }
  return null;
}

export function getAllPlans(): readonly SubscriptionPlan[] {
  return SUBSCRIPTION_PLANS;
}

// ---------------------------------------------------------------------------
// User Subscription Store (in-memory, production uses DB)
// ---------------------------------------------------------------------------

const userSubscriptions = new Map<string, UserSubscription>();

export function getUserSubscription(userId: string): UserSubscription {
  const existing = userSubscriptions.get(userId);
  if (existing) return existing;

  // Default to free tier
  const now = new Date();
  const defaultSub: UserSubscription = {
    userId,
    planId: 'FREE',
    activatedAt: now.toISOString(),
    billingPeriodStart: now.toISOString(),
    billingPeriodEnd: new Date(now.getFullYear() + 100, 0, 1).toISOString(), // lifetime for free
    stripeSubscriptionId: null,
    stripeCustomerId: null,
  };
  userSubscriptions.set(userId, defaultSub);
  return defaultSub;
}

export function setUserSubscription(
  userId: string,
  planId: SubscriptionPlanId,
  stripeSubscriptionId?: string,
  stripeCustomerId?: string,
): UserSubscription {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const plan = getPlanById(planId);

  const sub: UserSubscription = {
    userId,
    planId,
    activatedAt: now.toISOString(),
    billingPeriodStart: now.toISOString(),
    billingPeriodEnd: plan?.isLifetime
      ? new Date(now.getFullYear() + 100, 0, 1).toISOString()
      : endOfMonth.toISOString(),
    stripeSubscriptionId: stripeSubscriptionId ?? null,
    stripeCustomerId: stripeCustomerId ?? null,
  };
  userSubscriptions.set(userId, sub);
  return sub;
}

/**
 * Get the effective page limit for a user's current plan.
 */
export function getUserPageLimit(userId: string): number {
  const sub = getUserSubscription(userId);
  const plan = getPlanById(sub.planId);
  return plan?.monthlyPageLimit ?? 10;
}

/**
 * Get the effective AI credit limit for a user's current plan.
 */
export function getUserCreditLimit(userId: string): number {
  const sub = getUserSubscription(userId);
  const plan = getPlanById(sub.planId);
  return plan?.monthlyAiCredits ?? 0;
}
