// ============================================================================
// Billing Notification Engine
// Requirement #4: Credit exhaustion warnings and subscription renewal alerts.
// Notifications appear on dashboard AND are queued for email delivery.
//
// Notification rules:
//   - Credit balance < 10% of monthly allotment → warning
//   - Subscription renewal within 7 days → reminder
//   - Successful credit purchase → confirmation
//   - Do not repeat same notification type within 24 hours
// ============================================================================

import { getSubscriptionTierById, type SubscriptionTierId } from '../models/SubscriptionTierModel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'credit_low'
  | 'credit_exhausted'
  | 'renewal_approaching'
  | 'renewal_today'
  | 'credits_purchased'
  | 'plan_upgraded'
  | 'plan_downgraded';

export type NotificationChannel = 'dashboard' | 'email' | 'both';

export interface BillingNotification {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  dismissed: boolean;
  tenantId: string;
  actionUrl?: string;
  actionLabel?: string;
}

export interface CreditStatus {
  currentBalance: number;
  monthlyAllotment: number;
  percentRemaining: number;
  isLow: boolean;
  isExhausted: boolean;
}

export interface SubscriptionStatus {
  tierId: SubscriptionTierId;
  renewalDate: string;        // ISO 8601
  daysUntilRenewal: number;
  isApproachingRenewal: boolean;
  isRenewalToday: boolean;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
}

export interface BillingOverview {
  creditStatus: CreditStatus;
  subscriptionStatus: SubscriptionStatus;
  notifications: BillingNotification[];
  lastChecked: string;
}

// ---------------------------------------------------------------------------
// Notification generation
// ---------------------------------------------------------------------------

const NOTIFICATION_SUPPRESSION_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory notification log (per session; production would persist to DB)
const notificationLog = new Map<string, number>(); // key: tenantId:type → timestamp

function shouldSendNotification(tenantId: string, type: NotificationType): boolean {
  const key = `${tenantId}:${type}`;
  const lastSent = notificationLog.get(key);
  if (lastSent && (Date.now() - lastSent) < NOTIFICATION_SUPPRESSION_MS) {
    return false;
  }
  return true;
}

function recordNotification(tenantId: string, type: NotificationType): void {
  const key = `${tenantId}:${type}`;
  notificationLog.set(key, Date.now());
}

let notifCounter = 0;

function createNotification(
  tenantId: string,
  type: NotificationType,
  title: string,
  message: string,
  severity: BillingNotification['severity'],
  channel: NotificationChannel = 'both',
  actionUrl?: string,
  actionLabel?: string,
): BillingNotification | null {
  if (!shouldSendNotification(tenantId, type)) {
    return null;
  }

  recordNotification(tenantId, type);
  notifCounter++;

  return {
    id: `notif-${notifCounter}-${Date.now()}`,
    type,
    channel,
    title,
    message,
    severity,
    timestamp: new Date().toISOString(),
    dismissed: false,
    tenantId,
    actionUrl,
    actionLabel,
  };
}

// ---------------------------------------------------------------------------
// Credit status calculation
// ---------------------------------------------------------------------------

export function calculateCreditStatus(
  currentBalance: number,
  tierId: SubscriptionTierId,
): CreditStatus {
  const tier = getSubscriptionTierById(tierId);
  const monthlyAllotment = tier?.monthlyAiCredits ?? 0;
  const percentRemaining = monthlyAllotment > 0
    ? Math.round((currentBalance / monthlyAllotment) * 100)
    : currentBalance > 0 ? 100 : 0;

  return {
    currentBalance,
    monthlyAllotment,
    percentRemaining,
    isLow: monthlyAllotment > 0 && percentRemaining <= 10,
    isExhausted: currentBalance <= 0,
  };
}

// ---------------------------------------------------------------------------
// Subscription status calculation
// ---------------------------------------------------------------------------

export function calculateSubscriptionStatus(
  tierId: SubscriptionTierId,
  renewalDateISO: string,
  status: SubscriptionStatus['status'] = 'active',
): SubscriptionStatus {
  const renewalDate = new Date(renewalDateISO);
  const now = new Date();
  const diffMs = renewalDate.getTime() - now.getTime();
  const daysUntilRenewal = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    tierId,
    renewalDate: renewalDateISO,
    daysUntilRenewal: Math.max(0, daysUntilRenewal),
    isApproachingRenewal: daysUntilRenewal <= 7 && daysUntilRenewal > 0,
    isRenewalToday: daysUntilRenewal === 0,
    status,
  };
}

// ---------------------------------------------------------------------------
// Generate all applicable notifications
// ---------------------------------------------------------------------------

export function generateBillingNotifications(
  tenantId: string,
  creditStatus: CreditStatus,
  subscriptionStatus: SubscriptionStatus,
): BillingNotification[] {
  const notifications: BillingNotification[] = [];

  // Credit exhausted
  if (creditStatus.isExhausted) {
    const n = createNotification(
      tenantId,
      'credit_exhausted',
      'AI Credits Exhausted',
      `Your AI credit balance has reached zero. Purchase additional credits or wait for your monthly replenishment on ${subscriptionStatus.renewalDate.split('T')[0]} to continue using analysis features.`,
      'critical',
      'both',
      '/billing/credits',
      'Purchase Credits',
    );
    if (n) notifications.push(n);
  }
  // Credit low warning
  else if (creditStatus.isLow) {
    const n = createNotification(
      tenantId,
      'credit_low',
      'AI Credits Running Low',
      `You have ${creditStatus.currentBalance} AI credits remaining (${creditStatus.percentRemaining}% of your monthly ${creditStatus.monthlyAllotment} credit allotment). Consider purchasing additional credits to avoid service interruption.`,
      'warning',
      'both',
      '/billing/credits',
      'Purchase Credits',
    );
    if (n) notifications.push(n);
  }

  // Renewal today
  if (subscriptionStatus.isRenewalToday) {
    const n = createNotification(
      tenantId,
      'renewal_today',
      'Subscription Renews Today',
      'Your subscription renews today. Your monthly AI credits and page limits will be replenished upon successful payment.',
      'info',
      'both',
    );
    if (n) notifications.push(n);
  }
  // Renewal approaching
  else if (subscriptionStatus.isApproachingRenewal) {
    const n = createNotification(
      tenantId,
      'renewal_approaching',
      'Subscription Renewal Approaching',
      `Your subscription renews in ${subscriptionStatus.daysUntilRenewal} day${subscriptionStatus.daysUntilRenewal !== 1 ? 's' : ''} on ${subscriptionStatus.renewalDate.split('T')[0]}. Ensure your payment method is up to date.`,
      'info',
      'both',
      '/billing',
      'Manage Subscription',
    );
    if (n) notifications.push(n);
  }

  return notifications;
}

// ---------------------------------------------------------------------------
// Full billing overview
// ---------------------------------------------------------------------------

export function getBillingOverview(
  tenantId: string,
  currentCreditBalance: number,
  tierId: SubscriptionTierId,
  renewalDateISO: string,
  subStatus: SubscriptionStatus['status'] = 'active',
): BillingOverview {
  const creditStatus = calculateCreditStatus(currentCreditBalance, tierId);
  const subscriptionStatus = calculateSubscriptionStatus(tierId, renewalDateISO, subStatus);
  const notifications = generateBillingNotifications(tenantId, creditStatus, subscriptionStatus);

  return {
    creditStatus,
    subscriptionStatus,
    notifications,
    lastChecked: new Date().toISOString(),
  };
}
