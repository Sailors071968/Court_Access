// ============================================
// Court Access — Subscription Service (Phase 23)
// Manages Stripe subscription lifecycle.
// In-memory mock for frontend scaffolding.
// ============================================

import type {
  SubscriptionRecord,
  SubscriptionPlan,
  InvoiceRecord,
} from '../models/SubscriptionModel';

// ---------------------------------------------------------------------------
// In-Memory Store (mock — replaced by API calls in production)
// ---------------------------------------------------------------------------

let currentSubscription: SubscriptionRecord | null = {
  subscriptionId: 'sub_demo_001',
  userId: '5',
  stripeCustomerId: 'cus_demo_001',
  stripeSubscriptionId: 'sub_1234567890',
  plan: 'professional',
  status: 'active',
  currentPeriodStart: '2026-02-05T00:00:00Z',
  currentPeriodEnd: '2026-03-05T00:00:00Z',
  renewalDate: '2026-03-05T00:00:00Z',
  cancelAtPeriodEnd: false,
  createdAt: '2026-01-05T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
};

const invoiceHistory: InvoiceRecord[] = [
  {
    invoiceId: 'inv_001',
    stripeInvoiceId: 'in_abc123',
    amount: 9900,
    currency: 'usd',
    status: 'paid',
    periodStart: '2026-02-05T00:00:00Z',
    periodEnd: '2026-03-05T00:00:00Z',
    paidAt: '2026-02-05T00:00:00Z',
    invoiceUrl: null,
  },
  {
    invoiceId: 'inv_002',
    stripeInvoiceId: 'in_def456',
    amount: 9900,
    currency: 'usd',
    status: 'paid',
    periodStart: '2026-01-05T00:00:00Z',
    periodEnd: '2026-02-05T00:00:00Z',
    paidAt: '2026-01-05T00:00:00Z',
    invoiceUrl: null,
  },
];

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

export function getCurrentSubscription(): SubscriptionRecord | null {
  return currentSubscription;
}

export function getInvoiceHistory(): InvoiceRecord[] {
  return [...invoiceHistory];
}

export async function cancelSubscription(): Promise<{ success: boolean; error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  if (currentSubscription) {
    currentSubscription = {
      ...currentSubscription,
      cancelAtPeriodEnd: true,
      updatedAt: new Date().toISOString(),
    };
    return { success: true, error: null };
  }
  return { success: false, error: 'No active subscription found.' };
}

export async function reactivateSubscription(): Promise<{ success: boolean; error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  if (currentSubscription && currentSubscription.cancelAtPeriodEnd) {
    currentSubscription = {
      ...currentSubscription,
      cancelAtPeriodEnd: false,
      updatedAt: new Date().toISOString(),
    };
    return { success: true, error: null };
  }
  return { success: false, error: 'No subscription to reactivate.' };
}

export async function changePlan(
  newPlan: SubscriptionPlan
): Promise<{ success: boolean; error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (!currentSubscription) {
    return { success: false, error: 'No active subscription.' };
  }
  if (newPlan === 'free') {
    return { success: false, error: 'Cannot downgrade to free via plan change. Cancel instead.' };
  }
  currentSubscription = {
    ...currentSubscription,
    plan: newPlan,
    updatedAt: new Date().toISOString(),
  };
  return { success: true, error: null };
}

export function formatAmount(cents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}
