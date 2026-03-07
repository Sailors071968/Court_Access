// ============================================
// Court Access — Tenant Isolation Middleware
// Phase 40: Ensure users can only access their own data
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Verify that the authenticated user owns the case specified by :caseId.
 * Must be used after authenticate middleware.
 */
export function verifyCaseOwnership(req, res, next) {
  const { caseId } = req.params;
  if (!caseId) return next();

  prisma.case.findFirst({
    where: { id: caseId, userId: req.user.id },
    select: { id: true },
  }).then((found) => {
    if (!found) {
      return res.status(404).json({ error: 'Case not found' });
    }
    next();
  }).catch((err) => {
    console.error('[TenantIsolation] Case ownership check failed:', err.message);
    res.status(500).json({ error: 'Access check failed' });
  });
}

/**
 * Verify that the authenticated user owns the evidence record specified by :evidenceId.
 */
export function verifyEvidenceOwnership(req, res, next) {
  const { evidenceId } = req.params;
  if (!evidenceId) return next();

  prisma.evidenceRecord.findFirst({
    where: { id: evidenceId, userId: req.user.id },
    select: { id: true },
  }).then((found) => {
    if (!found) {
      return res.status(404).json({ error: 'Evidence not found' });
    }
    next();
  }).catch((err) => {
    console.error('[TenantIsolation] Evidence ownership check failed:', err.message);
    res.status(500).json({ error: 'Access check failed' });
  });
}

/**
 * Rate limiter for beta users — enforces usage limits.
 */
export function enforceBetaLimits(resourceType) {
  const LIMITS = {
    cases: 10,
    evidence: 25,
    storage: 5 * 1024 * 1024 * 1024, // 5 GB
  };

  return async (req, res, next) => {
    try {
      if (resourceType === 'cases') {
        const count = await prisma.case.count({ where: { userId: req.user.id } });
        if (count >= LIMITS.cases) {
          return res.status(429).json({
            error: `Beta limit: maximum ${LIMITS.cases} cases per user`,
            limit: LIMITS.cases,
            current: count,
          });
        }
      }

      if (resourceType === 'evidence') {
        const { caseId } = req.params;
        if (caseId) {
          const count = await prisma.evidenceRecord.count({ where: { caseId } });
          if (count >= LIMITS.evidence) {
            return res.status(429).json({
              error: `Beta limit: maximum ${LIMITS.evidence} evidence items per case`,
              limit: LIMITS.evidence,
              current: count,
            });
          }
        }
      }

      if (resourceType === 'storage') {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { storageUsedBytes: true },
        });
        if (user && Number(user.storageUsedBytes) >= LIMITS.storage) {
          return res.status(429).json({
            error: 'Beta limit: storage quota exceeded',
            limit: LIMITS.storage,
            current: Number(user.storageUsedBytes),
          });
        }
      }

      next();
    } catch (err) {
      console.error('[TenantIsolation] Beta limit check failed:', err.message);
      next(); // Don't block on limit check failure
    }
  };
}
