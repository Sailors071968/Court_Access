// ============================================================================
// Stripe Sync Service — keeps Subscription + AiCreditBalance in sync with Stripe
// ============================================================================

import prisma from '../lib/prisma.js';
import { getPlanById, type SubscriptionPlanId } from './subscriptionService.js';
import { setMonthlyCredits, resetMonthlyCredits } from './aiCreditService.js';

export async function findUserIdByStripeCustomer(customerId: string): Promise<string | null> {
  const sub = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  });
  return sub?.userId ?? null;
}

/**
 * Sync monthly AI credits and optionally reset usage on plan change or renewal.
 */
export async function syncPlanCredits(
  userId: string,
  planId: SubscriptionPlanId,
  options?: { resetUsage?: boolean },
): Promise<void> {
  const plan = getPlanById(planId);
  if (!plan) return;

  await setMonthlyCredits(userId, plan.monthlyAiCredits);
  if (options?.resetUsage) {
    await resetMonthlyCredits(userId);
  }
}

export const CREDIT_PACK_STRIPE_IDS: Record<string, string> = {
  pack_50: 'CREDIT_PACK_50',
  pack_150: 'CREDIT_PACK_150',
  pack_500: 'CREDIT_PACK_500',
  pack_1500: 'CREDIT_PACK_1500',
};

export function mapPackIdToStripePlan(packId: string): string | null {
  return CREDIT_PACK_STRIPE_IDS[packId] ?? (packId.startsWith('CREDIT_PACK_') ? packId : null);
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripePriceEnvStatus(): Record<string, boolean> {
  return {
    STRIPE_SECRET_KEY: Boolean(process.env.STRIPE_SECRET_KEY),
    STRIPE_WEBHOOK_SECRET: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    STRIPE_PUBLISHABLE_KEY: Boolean(process.env.STRIPE_PUBLISHABLE_KEY),
    STRIPE_PRICE_STARTER: Boolean(process.env.STRIPE_PRICE_STARTER),
    STRIPE_PRICE_PROFESSIONAL: Boolean(process.env.STRIPE_PRICE_PROFESSIONAL),
    STRIPE_PRICE_ADVANCED: Boolean(process.env.STRIPE_PRICE_ADVANCED),
    STRIPE_PRICE_LITIGATION: Boolean(process.env.STRIPE_PRICE_LITIGATION),
    STRIPE_PRICE_ENTERPRISE: Boolean(process.env.STRIPE_PRICE_ENTERPRISE),
    STRIPE_PRICE_CREDIT_50: Boolean(process.env.STRIPE_PRICE_CREDIT_50),
    STRIPE_PRICE_CREDIT_150: Boolean(process.env.STRIPE_PRICE_CREDIT_150),
    STRIPE_PRICE_CREDIT_500: Boolean(process.env.STRIPE_PRICE_CREDIT_500),
    STRIPE_PRICE_CREDIT_1500: Boolean(process.env.STRIPE_PRICE_CREDIT_1500),
  };
}
