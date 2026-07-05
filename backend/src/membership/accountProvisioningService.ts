// ============================================================================
// Program 1 — Automatic Account Provisioning
// Runs after registration and successful subscription checkout.
// ============================================================================

import prisma from '../lib/prisma.js';
import { TRIAL_PERIOD_DAYS } from './universalMembership.js';

export async function provisionNewAccount(userId: string, tenantId: string): Promise<void> {
  const now = new Date();
  const trialEnd = new Date(now.getTime() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.userAccountSettings.upsert({
      where: { userId },
      create: {
        userId,
        notifyEmail: true,
        notifyCaseUpdates: true,
        notifyBilling: true,
        notifyInvitations: true,
        aiInsightsEnabled: true,
        autoDocumentAnalysis: true,
      },
      update: {},
    });

    await tx.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planId: 'TRIAL',
        activatedAt: now,
        billingPeriodStart: now,
        billingPeriodEnd: trialEnd,
        subscriptionStatus: 'trialing',
        subscriptionTier: 'trial',
        trialEndsAt: trialEnd,
        billingInterval: 'month',
      },
      update: {
        trialEndsAt: trialEnd,
      },
    });

    await tx.organization.updateMany({
      where: { id: tenantId },
      data: { onboardingStep: 'provisioned' },
    });
  });
}

export async function provisionAfterPaidSubscription(userId: string, planId: string): Promise<void> {
  await prisma.userAccountSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  await prisma.organization.updateMany({
    where: {
      members: { some: { userId, role: { in: ['attorney', 'admin', 'owner'] } } },
    },
    data: { onboardingStep: 'active_subscription' },
  });

  console.log(`[Provisioning] Paid subscription active for user ${userId} plan ${planId}`);
}
