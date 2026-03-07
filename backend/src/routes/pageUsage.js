// ============================================
// Court Access — Page Usage API Routes
// Phase 115: Hybrid Pricing Enforcement
//
// Provides:
// - GET /api/page-usage — Current user's page usage summary
// - GET /api/page-usage/history — Page counting history for user
// ============================================

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getPageUsageSummary } from '../middleware/uploadLimitsEnforcer.js';
import prisma from '../services/prismaClient.js';

const router = Router();

// All page usage routes require authentication
router.use(authenticate);

/**
 * GET /api/page-usage
 * Returns the current user's page usage summary for the dashboard meter.
 *
 * Response:
 * {
 *   pagesUsed: 6,
 *   freeLimit: 10,
 *   pagesRemaining: 4,
 *   percentUsed: 60,
 *   subscriptionRequired: false,
 *   upgradeUrl: '/billing'
 * }
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const summary = await getPageUsageSummary(userId);
    res.json(summary);
  } catch (err) {
    console.error(`[PageUsage] Error fetching usage: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch page usage' });
  }
});

/**
 * GET /api/page-usage/history
 * Returns the page counting history for the current user.
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const pages = await prisma.documentPage.findMany({
      where: { userId },
      orderBy: { countedAt: 'desc' },
      take: 50,
    });

    res.json({
      history: pages,
      total: pages.length,
    });
  } catch (err) {
    console.error(`[PageUsage] Error fetching history: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch page history' });
  }
});

export default router;
