// ============================================================================
// CourtAccess — Usage Enforcement Service
// Enforces page limits and AI credit limits before uploads and analyses.
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import { getUserSubscription, getPlanById } from './subscriptionService.js';
import { getAvailableCredits, hasEnoughCredits, getCreditBalance } from './aiCreditService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsageTrackingRecord {
  id: string;
  userId: string;
  organizationId: string | null;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  pagesUploadedTotal: number;
  videoMinutesProcessed: number;
  createdAt: string;
  updatedAt: string;
}

export interface UsageLimitCheck {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  warningLevel: 'none' | 'approaching' | 'exceeded';
  message: string;
}

export interface CreditLimitCheck {
  allowed: boolean;
  availableCredits: number;
  requiredCredits: number;
  remaining: number;
  message: string;
}

export interface UsageDashboard {
  plan: {
    id: string;
    name: string;
    priceCents: number;
  };
  pages: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
    warningLevel: 'none' | 'approaching' | 'exceeded';
  };
  credits: {
    used: number;
    limit: number;
    available: number;
    percentUsed: number;
    warningLevel: 'none' | 'approaching' | 'exceeded';
  };
  billingPeriod: {
    start: string;
    end: string;
  };
}

// ---------------------------------------------------------------------------
// In-Memory Usage Store (production uses Prisma UsageTracking model)
// ---------------------------------------------------------------------------

const usageStore = new Map<string, UsageTrackingRecord>();

function usageKey(userId: string, periodStart: string): string {
  return `${userId}:${periodStart}`;
}

function getCurrentBillingPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Usage Tracking
// ---------------------------------------------------------------------------

export function getUserUsageRecord(userId: string): UsageTrackingRecord {
  const period = getCurrentBillingPeriod();
  const key = usageKey(userId, period.start);
  const existing = usageStore.get(key);
  if (existing) return existing;

  const record: UsageTrackingRecord = {
    id: uuidv4(),
    userId,
    organizationId: null,
    billingPeriodStart: period.start,
    billingPeriodEnd: period.end,
    pagesUploadedTotal: 0,
    videoMinutesProcessed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  usageStore.set(key, record);
  return record;
}

/**
 * Record pages uploaded by a user. Called after successful upload.
 */
export function recordPageUpload(userId: string, pageCount: number): UsageTrackingRecord {
  if (pageCount <= 0) {
    throw new Error('pageCount must be a positive number');
  }
  const record = getUserUsageRecord(userId);
  record.pagesUploadedTotal += pageCount;
  record.updatedAt = new Date().toISOString();
  const period = getCurrentBillingPeriod();
  usageStore.set(usageKey(userId, period.start), record);
  return record;
}

/**
 * Record video minutes processed by a user.
 */
export function recordVideoProcessing(userId: string, minutes: number): UsageTrackingRecord {
  if (minutes <= 0) {
    throw new Error('minutes must be a positive number');
  }
  const record = getUserUsageRecord(userId);
  record.videoMinutesProcessed += minutes;
  record.updatedAt = new Date().toISOString();
  const period = getCurrentBillingPeriod();
  usageStore.set(usageKey(userId, period.start), record);
  return record;
}

// ---------------------------------------------------------------------------
// Limit Enforcement
// ---------------------------------------------------------------------------

function getWarningLevel(percentUsed: number): 'none' | 'approaching' | 'exceeded' {
  if (percentUsed >= 100) return 'exceeded';
  if (percentUsed >= 80) return 'approaching';
  return 'none';
}

/**
 * Check if a user can upload more pages.
 * Page limits are cumulative across all cases.
 */
export function checkPageLimit(userId: string, additionalPages: number): UsageLimitCheck {
  const sub = getUserSubscription(userId);
  const plan = getPlanById(sub.planId);
  const limit = plan?.monthlyPageLimit ?? 10;
  const record = getUserUsageRecord(userId);
  const currentUsage = record.pagesUploadedTotal;
  const afterUpload = currentUsage + additionalPages;
  const percentUsed = limit > 0 ? Math.round((afterUpload / limit) * 100) : 100;
  const warningLevel = getWarningLevel(percentUsed);

  if (afterUpload > limit) {
    return {
      allowed: false,
      currentUsage,
      limit,
      remaining: Math.max(0, limit - currentUsage),
      percentUsed: Math.min(percentUsed, 100),
      warningLevel: 'exceeded',
      message: `Upload would exceed your ${plan?.name ?? 'Free'} plan limit of ${limit.toLocaleString()} pages. You have used ${currentUsage.toLocaleString()} of ${limit.toLocaleString()} pages this period.`,
    };
  }

  return {
    allowed: true,
    currentUsage,
    limit,
    remaining: limit - afterUpload,
    percentUsed,
    warningLevel,
    message: warningLevel === 'approaching'
      ? `You are approaching your page limit (${percentUsed}% used).`
      : `${limit - afterUpload} pages remaining this period.`,
  };
}

/**
 * Check if a user has enough AI credits for an analysis.
 */
export function checkCreditLimit(userId: string, requiredCredits: number): CreditLimitCheck {
  const availableCredits = getAvailableCredits(userId);

  if (!hasEnoughCredits(userId, requiredCredits)) {
    return {
      allowed: false,
      availableCredits,
      requiredCredits,
      remaining: Math.max(0, availableCredits),
      message: `Insufficient AI credits. This analysis requires ${requiredCredits} credits, but you have ${availableCredits} available. Purchase additional credits or upgrade your plan.`,
    };
  }

  return {
    allowed: true,
    availableCredits,
    requiredCredits,
    remaining: availableCredits - requiredCredits,
    message: `${availableCredits - requiredCredits} credits remaining after this analysis.`,
  };
}

// ---------------------------------------------------------------------------
// Usage Dashboard
// ---------------------------------------------------------------------------

/**
 * Get a complete usage dashboard for a user.
 */
export function getUserUsageDashboard(userId: string): UsageDashboard {
  const sub = getUserSubscription(userId);
  const plan = getPlanById(sub.planId);
  const record = getUserUsageRecord(userId);
  const availableCredits = getAvailableCredits(userId);
  const period = getCurrentBillingPeriod();

  const pageLimit = plan?.monthlyPageLimit ?? 10;
  const creditLimit = plan?.monthlyAiCredits ?? 0;
  // Use the actual creditsUsed from balance, not derived from available
  // (available = monthly + purchased - used, so deriving from creditLimit - available breaks with purchased credits)
  const balance = getCreditBalance(userId);
  const creditsUsed = balance.creditsUsed;
  const pagePercent = pageLimit > 0 ? Math.round((record.pagesUploadedTotal / pageLimit) * 100) : 0;
  const creditPercent = creditLimit > 0 ? Math.round((creditsUsed / creditLimit) * 100) : 0;

  return {
    plan: {
      id: plan?.id ?? 'FREE',
      name: plan?.name ?? 'Free',
      priceCents: plan?.priceCents ?? 0,
    },
    pages: {
      used: record.pagesUploadedTotal,
      limit: pageLimit,
      remaining: Math.max(0, pageLimit - record.pagesUploadedTotal),
      percentUsed: Math.min(pagePercent, 100),
      warningLevel: getWarningLevel(pagePercent),
    },
    credits: {
      used: creditsUsed,
      limit: creditLimit,
      available: availableCredits,
      percentUsed: Math.min(creditPercent, 100),
      warningLevel: getWarningLevel(creditPercent),
    },
    billingPeriod: {
      start: period.start,
      end: period.end,
    },
  };
}
