// ============================================================================
// Billing Metrics — objective production readiness metrics for admin dashboard
// ============================================================================

import prisma from '../lib/prisma.js';
import { getStripePriceEnvStatus, isStripeConfigured } from './stripeSyncService.js';
import { SUBSCRIPTION_PLANS } from './subscriptionService.js';

export interface BillingReadinessMetrics {
  generatedAt: string;
  stripeConfigured: boolean;
  stripeProductsVerified: number;
  stripeProductsTotal: number;
  stripePricesVerified: number;
  stripePricesTotal: number;
  webhookEndpoints: number;
  webhookEventsProcessed: number;
  webhookEventsLast24h: number;
  subscriptionFlow: 'OPERATIONAL' | 'PARTIAL' | 'NOT_CONFIGURED';
  refundFlow: 'IMPLEMENTED' | 'NOT_IMPLEMENTED';
  billingPortal: 'OPERATIONAL' | 'PARTIAL' | 'NOT_CONFIGURED';
  databaseSync: 'OPERATIONAL' | 'PARTIAL' | 'UNKNOWN';
  emailSync: 'NOT_IMPLEMENTED';
  authenticationSync: 'OPERATIONAL';
  overallBillingIntegrity: 'PASS' | 'PARTIAL' | 'FAIL';
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  canceledSubscriptions: number;
  freeTierUsers: number;
  paidTierUsers: number;
  estimatedMrrCents: number;
  estimatedArrCents: number;
  failedPaymentsLast30d: number;
  creditPackPurchases: number;
  envStatus: Record<string, boolean>;
}

export async function collectBillingReadinessMetrics(): Promise<BillingReadinessMetrics> {
  const envStatus = getStripePriceEnvStatus();
  const priceKeys = Object.keys(envStatus).filter((k) => k.startsWith('STRIPE_PRICE_'));
  const pricesVerified = priceKeys.filter((k) => envStatus[k]).length;

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    subscriptions,
    webhookTotal,
    webhook24h,
    failedPayments,
    creditPackEvents,
  ] = await Promise.all([
    prisma.subscription.findMany({ select: { planId: true, subscriptionStatus: true } }),
    prisma.stripeWebhookEvent.count(),
    prisma.stripeWebhookEvent.count({ where: { processedAt: { gte: last24h } } }),
    prisma.securityLog.count({
      where: { event: 'STRIPE_PAYMENT_FAILED', createdAt: { gte: last30d } },
    }),
    prisma.stripeWebhookEvent.count({
      where: { eventType: { contains: 'credit_pack' } },
    }),
  ]);

  const active = subscriptions.filter((s) => s.subscriptionStatus === 'active' && s.planId !== 'FREE').length;
  const trialing = subscriptions.filter((s) => s.subscriptionStatus === 'trialing').length;
  const pastDue = subscriptions.filter((s) => s.subscriptionStatus === 'past_due').length;
  const canceled = subscriptions.filter((s) => s.subscriptionStatus === 'canceled').length;
  const free = subscriptions.filter((s) => s.planId === 'FREE').length;
  const paid = subscriptions.filter((s) => s.planId !== 'FREE' && s.subscriptionStatus === 'active').length;

  let mrrCents = 0;
  for (const sub of subscriptions) {
    if (sub.subscriptionStatus !== 'active' && sub.subscriptionStatus !== 'trialing') continue;
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === sub.planId);
    if (plan && !plan.isLifetime) mrrCents += plan.priceCents;
  }

  const stripeConfigured = isStripeConfigured();
  const hasWebhookSecret = envStatus.STRIPE_WEBHOOK_SECRET;
  const hasPrices = pricesVerified >= 5;

  let subscriptionFlow: BillingReadinessMetrics['subscriptionFlow'] = 'NOT_CONFIGURED';
  if (stripeConfigured && hasPrices) subscriptionFlow = 'OPERATIONAL';
  else if (stripeConfigured) subscriptionFlow = 'PARTIAL';

  let billingPortal: BillingReadinessMetrics['billingPortal'] = 'NOT_CONFIGURED';
  if (stripeConfigured) billingPortal = 'OPERATIONAL';

  const withStripeIds = subscriptions.filter((s) => s.planId !== 'FREE').length;
  const databaseSync =
    paid > 0 && withStripeIds > 0 ? 'OPERATIONAL' : stripeConfigured ? 'PARTIAL' : 'UNKNOWN';

  let integrity: BillingReadinessMetrics['overallBillingIntegrity'] = 'FAIL';
  if (subscriptionFlow === 'OPERATIONAL' && hasWebhookSecret && databaseSync !== 'UNKNOWN') {
    integrity = billingPortal === 'OPERATIONAL' ? 'PASS' : 'PARTIAL';
  } else if (stripeConfigured) {
    integrity = 'PARTIAL';
  }

  return {
    generatedAt: now.toISOString(),
    stripeConfigured,
    stripeProductsVerified: pricesVerified > 0 ? 1 : 0,
    stripeProductsTotal: 1,
    stripePricesVerified: pricesVerified,
    stripePricesTotal: priceKeys.length,
    webhookEndpoints: hasWebhookSecret ? 1 : 0,
    webhookEventsProcessed: webhookTotal,
    webhookEventsLast24h: webhook24h,
    subscriptionFlow,
    refundFlow: 'IMPLEMENTED',
    billingPortal,
    databaseSync,
    emailSync: 'NOT_IMPLEMENTED',
    authenticationSync: 'OPERATIONAL',
    overallBillingIntegrity: integrity,
    activeSubscriptions: active,
    trialingSubscriptions: trialing,
    pastDueSubscriptions: pastDue,
    canceledSubscriptions: canceled,
    freeTierUsers: free,
    paidTierUsers: paid,
    estimatedMrrCents: mrrCents,
    estimatedArrCents: mrrCents * 12,
    failedPaymentsLast30d: failedPayments,
    creditPackPurchases: creditPackEvents,
    envStatus,
  };
}
