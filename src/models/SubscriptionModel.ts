// ============================================
// Court Access — Subscription Model (Phase 23)
// Stripe subscription lifecycle management.
// ============================================

// ---------------------------------------------------------------------------
// Subscription Status
// ---------------------------------------------------------------------------

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete' | 'unpaid';

export type SubscriptionPlan = 'free' | 'professional' | 'team';

// ---------------------------------------------------------------------------
// Subscription Record
// ---------------------------------------------------------------------------

export interface SubscriptionRecord {
  subscriptionId: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string;   // ISO 8601
  currentPeriodEnd: string;     // ISO 8601
  renewalDate: string;          // ISO 8601
  cancelAtPeriodEnd: boolean;
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
}

// ---------------------------------------------------------------------------
// Plan Configuration
// ---------------------------------------------------------------------------

export interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  price: number;          // Monthly price in dollars
  interval: 'month';
  features: string[];
  limits: {
    maxDocuments: number;
    maxStorageGB: number;
    maxTeamMembers: number;
    maxPagesPerDocument: number;
  };
}

export const PLAN_CONFIGS: Record<SubscriptionPlan, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: ['1 document analysis', 'Up to 10 pages per document', 'Basic structure mapping'],
    limits: {
      maxDocuments: 1,
      maxStorageGB: 0.1,
      maxTeamMembers: 1,
      maxPagesPerDocument: 10,
    },
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: 99,
    interval: 'month',
    features: [
      'Unlimited document analysis',
      'Up to 500 pages per document',
      'Full structure mapping',
      'Case analytics dashboard',
      'Evidence search',
      'Priority support',
    ],
    limits: {
      maxDocuments: -1,  // unlimited
      maxStorageGB: 50,
      maxTeamMembers: 1,
      maxPagesPerDocument: 500,
    },
  },
  team: {
    id: 'team',
    name: 'Team',
    price: 249,
    interval: 'month',
    features: [
      'Everything in Professional',
      'Up to 10 team members',
      'Role-based access control',
      'Cross-case indexing',
      'Collaboration tools',
      'Dedicated support',
    ],
    limits: {
      maxDocuments: -1,
      maxStorageGB: 200,
      maxTeamMembers: 10,
      maxPagesPerDocument: 500,
    },
  },
};

// ---------------------------------------------------------------------------
// Subscription Status Labels
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Active',
  past_due: 'Past Due',
  canceled: 'Canceled',
  trialing: 'Trial',
  incomplete: 'Incomplete',
  unpaid: 'Unpaid',
};

export const SUBSCRIPTION_STATUS_COLORS: Record<SubscriptionStatus, string> = {
  active: 'bg-green-100 text-green-700',
  past_due: 'bg-amber-100 text-amber-700',
  canceled: 'bg-gray-100 text-gray-500',
  trialing: 'bg-blue-100 text-blue-700',
  incomplete: 'bg-yellow-100 text-yellow-700',
  unpaid: 'bg-red-100 text-red-700',
};

// ---------------------------------------------------------------------------
// Invoice Record
// ---------------------------------------------------------------------------

export interface InvoiceRecord {
  invoiceId: string;
  stripeInvoiceId: string;
  amount: number;         // in cents
  currency: string;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  invoiceUrl: string | null;
}
