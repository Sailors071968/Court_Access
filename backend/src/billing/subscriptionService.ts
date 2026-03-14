// ============================================================================
// CourtAccess — Subscription Plan Service
// Manages subscription tiers with page limits and AI credits.
// Now persisted to PostgreSQL via Prisma (replaces in-memory Map).
// ============================================================================

import prisma from '../lib/prisma.js';

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
// Tier Mapping — canonical short tier names
// ---------------------------------------------------------------------------

function planIdToTier(planId: SubscriptionPlanId): string {
  const mapping: Record<SubscriptionPlanId, string> = {
    FREE: 'free',
    STARTER: 'starter',
    PROFESSIONAL: 'professional',
    ADVANCED_INVESTIGATOR: 'advanced',
    LITIGATION_INTELLIGENCE_PRO: 'litigation',
    ENTERPRISE_FIRM: 'enterprise',
  };
  return mapping[planId] ?? 'free';
}

// ---------------------------------------------------------------------------
// User Subscription Store — persisted to PostgreSQL via Prisma
// ---------------------------------------------------------------------------

export async function getUserSubscription(userId: string): Promise<UserSubscription> {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing) {
    return {
      userId: existing.userId,
      planId: existing.planId as SubscriptionPlanId,
      activatedAt: existing.activatedAt.toISOString(),
      billingPeriodStart: existing.billingPeriodStart.toISOString(),
      billingPeriodEnd: existing.billingPeriodEnd.toISOString(),
      stripeSubscriptionId: existing.stripeSubscriptionId,
      stripeCustomerId: existing.stripeCustomerId,
    };
  }

  // Default to free tier — upsert to DB
  const now = new Date();
  const created = await prisma.subscription.create({
    data: {
      userId,
      planId: 'FREE',
      activatedAt: now,
      billingPeriodStart: now,
      billingPeriodEnd: new Date(now.getFullYear() + 100, 0, 1),
      subscriptionStatus: 'active',
      subscriptionTier: 'free',
    },
  });

  return {
    userId: created.userId,
    planId: created.planId as SubscriptionPlanId,
    activatedAt: created.activatedAt.toISOString(),
    billingPeriodStart: created.billingPeriodStart.toISOString(),
    billingPeriodEnd: created.billingPeriodEnd.toISOString(),
    stripeSubscriptionId: created.stripeSubscriptionId,
    stripeCustomerId: created.stripeCustomerId,
  };
}

export async function setUserSubscription(
  userId: string,
  planId: SubscriptionPlanId,
  stripeSubscriptionId?: string,
  stripeCustomerId?: string,
): Promise<UserSubscription> {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const plan = getPlanById(planId);

  const billingPeriodEnd = plan?.isLifetime
    ? new Date(now.getFullYear() + 100, 0, 1)
    : endOfMonth;

  const sub = await prisma.subscription.upsert({
    where: { userId },
    update: {
      planId,
      activatedAt: now,
      billingPeriodStart: now,
      billingPeriodEnd,
      stripeSubscriptionId: stripeSubscriptionId ?? null,
      stripeCustomerId: stripeCustomerId ?? null,
      subscriptionTier: planIdToTier(planId),
    },
    create: {
      userId,
      planId,
      activatedAt: now,
      billingPeriodStart: now,
      billingPeriodEnd,
      stripeSubscriptionId: stripeSubscriptionId ?? null,
      stripeCustomerId: stripeCustomerId ?? null,
      subscriptionStatus: 'active',
      subscriptionTier: planIdToTier(planId),
    },
  });

  return {
    userId: sub.userId,
    planId: sub.planId as SubscriptionPlanId,
    activatedAt: sub.activatedAt.toISOString(),
    billingPeriodStart: sub.billingPeriodStart.toISOString(),
    billingPeriodEnd: sub.billingPeriodEnd.toISOString(),
    stripeSubscriptionId: sub.stripeSubscriptionId,
    stripeCustomerId: sub.stripeCustomerId,
  };
}

/**
 * Get the effective page limit for a user's current plan.
 */
export async function getUserPageLimit(userId: string): Promise<number> {
  const sub = await getUserSubscription(userId);
  const plan = getPlanById(sub.planId);
  return plan?.monthlyPageLimit ?? 10;
}

/**
 * Get the effective AI credit limit for a user's current plan.
 */
export async function getUserCreditLimit(userId: string): Promise<number> {
  const sub = await getUserSubscription(userId);
  const plan = getPlanById(sub.planId);
  return plan?.monthlyAiCredits ?? 0;
}
