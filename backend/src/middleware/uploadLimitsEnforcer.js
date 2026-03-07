// ============================================
// Court Access — Upload Limits Enforcement Middleware
// Phase 115: Hybrid Pricing — 10 free pages
//
// Logic:
// - First 10 pages free (configurable per user)
// - Uploads beyond limit require active Stripe subscription
// - Returns subscription_required error when limit exceeded
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Middleware: enforceUploadLimits()
 *
 * Checks if the authenticated user has remaining free pages.
 * If exceeded, requires an active Stripe subscription.
 *
 * Must be used AFTER authenticate middleware (req.user must exist).
 */
export function enforceUploadLimits() {
  return async (req, res, next) => {
    // Skip if no authenticated user (auth middleware will catch this)
    if (!req.user || !req.user.id) {
      return next();
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          pageUsageTotal: true,
          freePageLimit: true,
          subscriptionStatus: true,
          plan: true,
        },
      });

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Admin and staff bypass upload limits
      if (req.user.role === 'admin' || req.user.role === 'staff') {
        return next();
      }

      // Check if user is within free tier
      if (user.pageUsageTotal < user.freePageLimit) {
        // Still within free limit — allow upload
        return next();
      }

      // User has exceeded free page limit — check for active subscription
      if (user.subscriptionStatus === 'active' && user.plan !== 'free') {
        // Has active paid subscription — allow upload
        return next();
      }

      // No active subscription and over free limit — block upload
      return res.status(402).json({
        error: 'subscription_required',
        message: 'You have used all your free pages. Please upgrade to continue uploading documents.',
        pageUsageTotal: user.pageUsageTotal,
        freePageLimit: user.freePageLimit,
        upgradeUrl: '/billing',
      });
    } catch (err) {
      console.error(`[UploadLimits] Error checking limits: ${err.message}`);
      // On error, allow the upload (fail open to avoid blocking legitimate users)
      return next();
    }
  };
}

/**
 * Increment page usage for a user after successful page counting.
 *
 * @param {string} userId - The user ID
 * @param {number} pageCount - Number of pages to add
 * @returns {Promise<{ pageUsageTotal: number, freePageLimit: number }>}
 */
export async function incrementPageUsage(userId, pageCount) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      pageUsageTotal: { increment: pageCount },
    },
    select: {
      pageUsageTotal: true,
      freePageLimit: true,
      subscriptionStatus: true,
    },
  });

  return user;
}

/**
 * Get page usage summary for a user.
 *
 * @param {string} userId - The user ID
 * @returns {Promise<{ pageUsageTotal: number, freePageLimit: number, remaining: number, requiresSubscription: boolean }>}
 */
export async function getPageUsageSummary(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      pageUsageTotal: true,
      freePageLimit: true,
      subscriptionStatus: true,
      plan: true,
    },
  });

  if (!user) {
    return { pageUsageTotal: 0, freePageLimit: 10, remaining: 10, requiresSubscription: false };
  }

  const remaining = Math.max(0, user.freePageLimit - user.pageUsageTotal);
  const hasActiveSubscription = user.subscriptionStatus === 'active' && user.plan !== 'free';

  return {
    pageUsageTotal: user.pageUsageTotal,
    freePageLimit: user.freePageLimit,
    remaining,
    requiresSubscription: remaining === 0 && !hasActiveSubscription,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
  };
}
