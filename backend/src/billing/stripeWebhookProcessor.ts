// ============================================================================
// Stripe Webhook Processor — testable event dispatch (Epic 1A certification)
// ============================================================================

import prisma from '../lib/prisma.js';
import { logSecurityEvent } from '../security/authMiddleware.js';
import { syncPlanCredits, findUserIdByStripeCustomer } from './stripeSyncService.js';
import type { SubscriptionPlanId } from './subscriptionService.js';
import { setMonthlyCredits } from './aiCreditService.js';
import { sendBillingEmail } from './billingEmailService.js';
import { getPlanById } from './subscriptionService.js';

export interface StripeSubscriptionObject {
  id: string;
  customer: string;
  status: string;
  items?: {
    data?: Array<{
      price?: { lookup_key?: string; product?: string; metadata?: Record<string, string> };
    }>;
  };
  current_period_start?: number;
  current_period_end?: number;
  metadata?: Record<string, string>;
}

export interface StripeCheckoutSession {
  id: string;
  customer: string;
  subscription: string;
  client_reference_id?: string;
  metadata?: Record<string, string>;
}

export interface StripeInvoice {
  id: string;
  customer: string;
  subscription?: string;
  status: string;
  amount_paid: number;
}

export interface StripeCharge {
  id: string;
  customer?: string;
  amount_refunded?: number;
  refunded?: boolean;
}

export interface StripePaymentIntent {
  id: string;
  customer?: string;
  status: string;
  metadata?: Record<string, string>;
}

export interface StripeEvent {
  id: string;
  type: string;
  data: {
    object:
      | StripeSubscriptionObject
      | StripeCheckoutSession
      | StripeInvoice
      | StripeCharge
      | StripePaymentIntent;
  };
}

function mapStripePriceToTier(priceKey?: string): { planId: string; tier: string } {
  const mapping: Record<string, { planId: string; tier: string }> = {
    starter_monthly: { planId: 'STARTER', tier: 'starter' },
    professional_monthly: { planId: 'PROFESSIONAL', tier: 'professional' },
    advanced_monthly: { planId: 'ADVANCED_INVESTIGATOR', tier: 'advanced' },
    litigation_monthly: { planId: 'LITIGATION_INTELLIGENCE_PRO', tier: 'litigation' },
    enterprise_monthly: { planId: 'ENTERPRISE_FIRM', tier: 'enterprise' },
  };
  return mapping[priceKey ?? ''] ?? { planId: 'FREE', tier: 'free' };
}

function mapPlanIdToTier(planId?: string): { planId: string; tier: string } {
  const mapping: Record<string, { planId: string; tier: string }> = {
    FREE: { planId: 'FREE', tier: 'free' },
    STARTER: { planId: 'STARTER', tier: 'starter' },
    PROFESSIONAL: { planId: 'PROFESSIONAL', tier: 'professional' },
    ADVANCED_INVESTIGATOR: { planId: 'ADVANCED_INVESTIGATOR', tier: 'advanced' },
    LITIGATION_INTELLIGENCE_PRO: { planId: 'LITIGATION_INTELLIGENCE_PRO', tier: 'litigation' },
    ENTERPRISE_FIRM: { planId: 'ENTERPRISE_FIRM', tier: 'enterprise' },
  };
  return mapping[planId ?? ''] ?? { planId: planId ?? 'FREE', tier: 'free' };
}

export async function isWebhookEventProcessed(eventId: string): Promise<boolean> {
  const existing = await prisma.stripeWebhookEvent.findUnique({ where: { eventId } });
  return Boolean(existing);
}

export async function markWebhookEventProcessed(eventId: string, eventType: string): Promise<void> {
  await prisma.stripeWebhookEvent.create({ data: { eventId, eventType } });
}

export async function handleSubscriptionCreated(sub: StripeSubscriptionObject): Promise<void> {
  const customerId = sub.customer;
  const subscriptionId = sub.id;
  const status = sub.status;
  const priceKey = sub.items?.data?.[0]?.price?.lookup_key;
  const mapped = mapStripePriceToTier(priceKey);
  const userId = sub.metadata?.userId ?? (await findUserIdByStripeCustomer(customerId));

  if (!userId) return;

  const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : new Date();
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const updateData: Record<string, unknown> = {
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    subscriptionStatus: status,
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
    activatedAt: new Date(),
  };
  if (priceKey) {
    updateData.planId = mapped.planId;
    updateData.subscriptionTier = mapped.tier;
  }

  await prisma.subscription.upsert({
    where: { userId },
    update: updateData,
    create: {
      userId,
      planId: mapped.planId,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      subscriptionStatus: status,
      subscriptionTier: mapped.tier,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      activatedAt: new Date(),
    },
  });

  if (priceKey && mapped.planId !== 'FREE') {
    await syncPlanCredits(userId, mapped.planId as SubscriptionPlanId);
  }

  void logSecurityEvent('STRIPE_SUBSCRIPTION_CREATED', userId, undefined, `Subscription ${subscriptionId}: ${mapped.tier}`);
  const plan = getPlanById(mapped.planId as SubscriptionPlanId);
  await sendBillingEmail(userId, 'subscription_created', { planName: plan?.name ?? mapped.tier, tier: mapped.tier });
}

export async function handleSubscriptionUpdated(sub: StripeSubscriptionObject): Promise<void> {
  const subscriptionId = sub.id;
  const status = sub.status;
  const priceKey = sub.items?.data?.[0]?.price?.lookup_key;
  const mapped = mapStripePriceToTier(priceKey);

  const existing = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: subscriptionId } });
  if (!existing) return;

  const planId = priceKey ? mapped.planId : existing.planId;
  const tier = priceKey ? mapped.tier : (existing.subscriptionTier ?? 'free');
  const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : existing.billingPeriodStart;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : existing.billingPeriodEnd;

  await prisma.subscription.update({
    where: { id: existing.id },
    data: { planId, subscriptionStatus: status, subscriptionTier: tier, billingPeriodStart: periodStart, billingPeriodEnd: periodEnd },
  });

  if (priceKey && planId !== 'FREE') {
    await syncPlanCredits(existing.userId, planId as SubscriptionPlanId);
  }

  void logSecurityEvent('STRIPE_SUBSCRIPTION_UPDATED', existing.userId, undefined, `${subscriptionId}: ${tier} (${status})`);
}

export async function handleSubscriptionDeleted(sub: StripeSubscriptionObject): Promise<void> {
  const existing = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: sub.id } });
  if (!existing) return;

  await prisma.subscription.update({
    where: { id: existing.id },
    data: { planId: 'FREE', subscriptionStatus: 'canceled', subscriptionTier: 'free', stripeSubscriptionId: null },
  });
  await setMonthlyCredits(existing.userId, 0);
  void logSecurityEvent('STRIPE_SUBSCRIPTION_CANCELED', existing.userId, undefined, `Subscription ${sub.id} canceled`);
  await sendBillingEmail(existing.userId, 'subscription_canceled', {});
}

export async function handleCheckoutCompleted(session: StripeCheckoutSession): Promise<void> {
  const userId = session.client_reference_id ?? session.metadata?.userId;
  if (!userId) return;

  const metaPlanId = session.metadata?.planId;

  if (metaPlanId?.startsWith('CREDIT_PACK_')) {
    const CREDIT_AMOUNTS: Record<string, number> = {
      CREDIT_PACK_50: 50,
      CREDIT_PACK_150: 150,
      CREDIT_PACK_500: 500,
      CREDIT_PACK_1500: 1500,
    };
    const credits = CREDIT_AMOUNTS[metaPlanId] || 0;
    if (credits <= 0) throw new Error(`Unrecognized credit pack: ${metaPlanId}`);

    try {
      await prisma.$transaction(async (tx) => {
        await tx.stripeWebhookEvent.create({
          data: { eventId: `credit_pack_${session.id}`, eventType: 'checkout.session.completed.credit_pack' },
        });
        await tx.aiCreditBalance.upsert({
          where: { userId },
          update: { purchasedCredits: { increment: credits } },
          create: {
            userId,
            purchasedCredits: credits,
            monthlyCredits: 0,
            creditsUsed: 0,
            billingPeriodStart: new Date(),
            billingPeriodEnd: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        });
      });
    } catch (err: unknown) {
      const isDuplicate = typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002';
      if (isDuplicate) return;
      throw err;
    }

    void logSecurityEvent('STRIPE_CREDIT_PACK_PURCHASED', userId, undefined, `${metaPlanId} (${credits} credits)`);
    return;
  }

  const mapped = metaPlanId ? mapPlanIdToTier(metaPlanId) : { planId: 'STARTER', tier: 'starter' };
  const updateData: Record<string, unknown> = {
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
    subscriptionStatus: 'active',
  };
  if (metaPlanId) {
    updateData.planId = mapped.planId;
    updateData.subscriptionTier = mapped.tier;
  }

  await prisma.subscription.upsert({
    where: { userId },
    update: updateData,
    create: {
      userId,
      planId: mapped.planId,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      subscriptionStatus: 'active',
      subscriptionTier: mapped.tier,
      billingPeriodStart: new Date(),
      billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  if (mapped.planId !== 'FREE') {
    await syncPlanCredits(userId, mapped.planId as SubscriptionPlanId);
  }

  void logSecurityEvent('STRIPE_CHECKOUT_COMPLETED', userId, undefined, `Session ${session.id}: ${mapped.tier}`);
  const plan = getPlanById(mapped.planId as SubscriptionPlanId);
  await sendBillingEmail(userId, 'checkout_completed', { planId: mapped.planId, planName: plan?.name ?? mapped.tier });
}

export async function handleInvoicePaid(invoice: StripeInvoice): Promise<void> {
  if (!invoice.subscription) return;
  const existing = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: invoice.subscription } });
  if (!existing) return;

  await prisma.subscription.update({ where: { id: existing.id }, data: { subscriptionStatus: 'active' } });
  await syncPlanCredits(existing.userId, existing.planId as SubscriptionPlanId, { resetUsage: true });
  await sendBillingEmail(existing.userId, 'subscription_renewed', {
    periodEnd: existing.billingPeriodEnd.toISOString(),
  });
}

export async function handleInvoicePaymentFailed(invoice: StripeInvoice): Promise<void> {
  if (!invoice.subscription) return;
  const existing = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: invoice.subscription } });
  if (!existing) return;

  await prisma.subscription.update({ where: { id: existing.id }, data: { subscriptionStatus: 'past_due' } });
  void logSecurityEvent('STRIPE_PAYMENT_FAILED', existing.userId, undefined, `Invoice ${invoice.id} failed`);
  await sendBillingEmail(existing.userId, 'payment_failed', {});
}

export async function handleChargeRefunded(charge: StripeCharge): Promise<void> {
  const userId = charge.customer ? await findUserIdByStripeCustomer(charge.customer) : null;
  void logSecurityEvent('STRIPE_CHARGE_REFUNDED', userId ?? undefined, undefined, `Charge ${charge.id} refunded`);
  if (userId) {
    await sendBillingEmail(userId, 'refund_processed', { amount: String(charge.amount_refunded ?? 0) });
  }
}

export async function handlePaymentIntentSucceeded(intent: StripePaymentIntent): Promise<void> {
  void logSecurityEvent('STRIPE_PAYMENT_INTENT_SUCCEEDED', intent.metadata?.userId, undefined, intent.id);
}

export async function handlePaymentIntentFailed(intent: StripePaymentIntent): Promise<void> {
  const userId = intent.metadata?.userId ?? (intent.customer ? await findUserIdByStripeCustomer(intent.customer) : null);
  void logSecurityEvent('STRIPE_PAYMENT_INTENT_FAILED', userId ?? undefined, undefined, intent.id);
}

/** Dispatch a Stripe event with idempotency — used by webhook route and certification harness */
export async function dispatchStripeWebhookEvent(event: StripeEvent): Promise<'processed' | 'duplicate'> {
  if (await isWebhookEventProcessed(event.id)) {
    return 'duplicate';
  }

  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object as StripeSubscriptionObject);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as StripeSubscriptionObject);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as StripeSubscriptionObject);
      break;
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as StripeCheckoutSession);
      break;
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as StripeInvoice);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as StripeInvoice);
      break;
    case 'charge.refunded':
      await handleChargeRefunded(event.data.object as StripeCharge);
      break;
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object as StripePaymentIntent);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object as StripePaymentIntent);
      break;
    default:
      break;
  }

  await markWebhookEventProcessed(event.id, event.type);
  return 'processed';
}
