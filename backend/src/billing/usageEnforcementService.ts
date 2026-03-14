// ============================================================================
// CourtAccess — Usage Enforcement Service
// Enforces page limits and AI credit limits before uploads and analyses.
// Now persisted to PostgreSQL via Prisma (replaces in-memory Map).
// ============================================================================

import prisma from '../lib/prisma.js';
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
// Usage Store — persisted to PostgreSQL via Prisma UsageTracking model
// ---------------------------------------------------------------------------

function getCurrentBillingPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

function toUsageTrackingRecord(row: {
  id: string;
  userId: string;
  organizationId: string | null;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  pagesUploadedTotal: number;
  videoMinutesProcessed: number;
  createdAt: Date;
  updatedAt: Date;
}): UsageTrackingRecord {
  return {
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    billingPeriodStart: row.billingPeriodStart.toISOString(),
    billingPeriodEnd: row.billingPeriodEnd.toISOString(),
    pagesUploadedTotal: row.pagesUploadedTotal,
    videoMinutesProcessed: row.videoMinutesProcessed,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Usage Tracking
// ---------------------------------------------------------------------------

export async function getUserUsageRecord(userId: string): Promise<UsageTrackingRecord> {
  const period = getCurrentBillingPeriod();
  const record = await prisma.usageTracking.upsert({
    where: { userId_billingPeriodStart: { userId, billingPeriodStart: period.start } },
    update: {},
    create: {
      userId,
      organizationId: null,
      billingPeriodStart: period.start,
      billingPeriodEnd: period.end,
      pagesUploadedTotal: 0,
      videoMinutesProcessed: 0,
    },
  });
  return toUsageTrackingRecord(record);
}

/**
 * Record pages uploaded by a user. Called after successful upload.
 */
export async function recordPageUpload(userId: string, pageCount: number): Promise<UsageTrackingRecord> {
  if (typeof pageCount !== 'number' || !Number.isFinite(pageCount) || pageCount <= 0) {
    throw new Error('pageCount must be a positive finite number');
  }
  const period = getCurrentBillingPeriod();
  // Ensure record exists first
  await getUserUsageRecord(userId);
  const updated = await prisma.usageTracking.update({
    where: { userId_billingPeriodStart: { userId, billingPeriodStart: period.start } },
    data: { pagesUploadedTotal: { increment: pageCount } },
  });
  return toUsageTrackingRecord(updated);
}

/**
 * Record video minutes processed by a user.
 */
export async function recordVideoProcessing(userId: string, minutes: number): Promise<UsageTrackingRecord> {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    throw new Error('minutes must be a positive finite number');
  }
  const period = getCurrentBillingPeriod();
  await getUserUsageRecord(userId);
  const updated = await prisma.usageTracking.update({
    where: { userId_billingPeriodStart: { userId, billingPeriodStart: period.start } },
    data: { videoMinutesProcessed: { increment: minutes } },
  });
  return toUsageTrackingRecord(updated);
}

// ---------------------------------------------------------------------------
// Limit Enforcement
// ---------------------------------------------------------------------------

function getWarningLevel(percentUsed: number): 'none' | 'approaching' | 'exceeded' {
  if (percentUsed > 100) return 'exceeded';
  if (percentUsed >= 80) return 'approaching';
  return 'none';
}

/**
 * Check if a user can upload more pages.
 * Page limits are cumulative across all cases.
 */
export async function checkPageLimit(userId: string, additionalPages: number): Promise<UsageLimitCheck> {
  const sub = await getUserSubscription(userId);
  const plan = getPlanById(sub.planId);
  const limit = plan?.monthlyPageLimit ?? 10;
  const record = await getUserUsageRecord(userId);
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
export async function checkCreditLimit(userId: string, requiredCredits: number): Promise<CreditLimitCheck> {
  const availableCredits = await getAvailableCredits(userId);

  if (!(await hasEnoughCredits(userId, requiredCredits))) {
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
export async function getUserUsageDashboard(userId: string): Promise<UsageDashboard> {
  const sub = await getUserSubscription(userId);
  const plan = getPlanById(sub.planId);
  const record = await getUserUsageRecord(userId);
  const availableCredits = await getAvailableCredits(userId);
  const period = getCurrentBillingPeriod();

  const pageLimit = plan?.monthlyPageLimit ?? 10;
  const creditLimit = plan?.monthlyAiCredits ?? 0;
  // Use the actual creditsUsed from balance, not derived from available
  // (available = monthly + purchased - used, so deriving from creditLimit - available breaks with purchased credits)
  const balance = await getCreditBalance(userId);
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
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    },
  };
}
