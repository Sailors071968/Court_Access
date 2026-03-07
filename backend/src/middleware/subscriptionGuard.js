// ============================================
// Court Access — Subscription Guard Middleware
// Phase 32: Subscription-based access control
//
// Restricts API access based on subscription plan.
// Free tier gets limited access; Professional and Team get full access.
// ============================================

// Plan limits configuration
const PLAN_LIMITS = {
  free: {
    maxDocuments: 1,
    maxPagesPerDocument: 10,
    maxStorageBytes: 100 * 1024 * 1024, // 100MB
    maxTeamMembers: 1,
    features: ['basic_analysis'],
  },
  professional: {
    maxDocuments: Infinity,
    maxPagesPerDocument: 500,
    maxStorageBytes: 50 * 1024 * 1024 * 1024, // 50GB
    maxTeamMembers: 1,
    features: ['basic_analysis', 'full_analysis', 'case_analytics', 'export'],
  },
  team: {
    maxDocuments: Infinity,
    maxPagesPerDocument: 500,
    maxStorageBytes: 200 * 1024 * 1024 * 1024, // 200GB
    maxTeamMembers: 10,
    features: ['basic_analysis', 'full_analysis', 'case_analytics', 'export', 'collaboration', 'cross_case_indexing'],
  },
};

/**
 * Middleware to check if the user's subscription allows a specific action.
 *
 * @param requiredFeature - The feature required for this route
 * @returns Express middleware
 */
export function requireFeature(requiredFeature) {
  return (req, res, next) => {
    // Get user's plan from request (set by auth middleware)
    const plan = req.user?.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    if (!limits.features.includes(requiredFeature)) {
      return res.status(403).json({
        error: 'Feature not available on your current plan',
        requiredFeature,
        currentPlan: plan,
        upgradeTo: getRequiredPlan(requiredFeature),
      });
    }

    // Attach limits to request for downstream use
    req.planLimits = limits;
    req.plan = plan;
    next();
  };
}

/**
 * Middleware to check document upload limits.
 */
export function checkUploadLimit(getCurrentDocCount) {
  return async (req, res, next) => {
    const plan = req.user?.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    const tenantId = req.headers['x-tenant-id'] || 'default';

    try {
      const currentCount = await getCurrentDocCount(tenantId);

      if (currentCount >= limits.maxDocuments) {
        return res.status(403).json({
          error: 'Document limit reached for your current plan',
          currentCount,
          maxDocuments: limits.maxDocuments,
          currentPlan: plan,
          upgradeTo: plan === 'free' ? 'professional' : 'team',
        });
      }

      next();
    } catch (err) {
      // Don't block uploads if limit check fails
      console.warn(`[SubscriptionGuard] Limit check failed: ${err.message}`);
      next();
    }
  };
}

/**
 * Middleware to check storage limits.
 */
export function checkStorageLimit(getCurrentStorageBytes) {
  return async (req, res, next) => {
    const plan = req.user?.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    const tenantId = req.headers['x-tenant-id'] || 'default';

    try {
      const currentBytes = await getCurrentStorageBytes(tenantId);

      if (currentBytes >= limits.maxStorageBytes) {
        return res.status(403).json({
          error: 'Storage limit reached for your current plan',
          currentBytes,
          maxStorageBytes: limits.maxStorageBytes,
          currentPlan: plan,
        });
      }

      next();
    } catch (err) {
      console.warn(`[SubscriptionGuard] Storage check failed: ${err.message}`);
      next();
    }
  };
}

/**
 * Get the minimum paid plan required for a feature.
 * Skips 'free' tier so the upgrade suggestion is always a paid plan.
 */
function getRequiredPlan(feature) {
  const paidPlans = Object.entries(PLAN_LIMITS).filter(([plan]) => plan !== 'free');
  for (const [plan, limits] of paidPlans) {
    if (limits.features.includes(feature)) return plan;
  }
  return 'professional';
}

/**
 * Get plan limits for a given plan.
 */
export function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}
