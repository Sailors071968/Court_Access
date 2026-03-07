// ============================================
// Court Access — Beta Stability Period Policy
// Phase 123: 30-day stability period management
//
// During the closed beta period:
// - No major feature additions
// - Only bug fixes and stability improvements
// - Monitoring and metrics collection
// ============================================

import { Router } from 'express';
import prisma from '../services/prismaClient.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('admin'));

// ---------------------------------------------------------------------------
// Stability period constants
// ---------------------------------------------------------------------------

const BETA_DURATION_DAYS = 30;

// ---------------------------------------------------------------------------
// GET /api/admin/beta-stability/status — Current stability period status
// ---------------------------------------------------------------------------

router.get('/status', async (_req, res) => {
  try {
    // Find the first health report as proxy for beta start
    const firstReport = await prisma.betaHealthReport.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    const betaStartDate = firstReport?.createdAt || new Date();
    const betaEndDate = new Date(betaStartDate.getTime() + BETA_DURATION_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysElapsed = Math.floor((now.getTime() - betaStartDate.getTime()) / (24 * 60 * 60 * 1000));
    const daysRemaining = Math.max(0, BETA_DURATION_DAYS - daysElapsed);
    const isActive = daysRemaining > 0;

    // Gather stability metrics
    const [
      totalUsers,
      activeUsers,
      totalCases,
      totalEvidence,
      unresolvedErrors,
      openBugs,
      openFeedback,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.case.count(),
      prisma.evidenceRecord.count(),
      prisma.systemErrorLog.count({ where: { resolved: false } }),
      prisma.bugReport.count({ where: { status: { in: ['open', 'in_progress'] } } }).catch(() => 0),
      prisma.betaFeedback.count({ where: { status: 'open' } }).catch(() => 0),
    ]);

    res.json({
      policy: {
        name: 'Court Access Closed Beta — Stability Period',
        durationDays: BETA_DURATION_DAYS,
        startDate: betaStartDate.toISOString(),
        endDate: betaEndDate.toISOString(),
        daysElapsed,
        daysRemaining,
        isActive,
        rules: [
          'No major feature additions during beta period',
          'Only bug fixes and stability improvements are permitted',
          'All changes must go through PR review process',
          'System monitoring must be active at all times',
          'Weekly health reports must be generated',
          'All critical bugs must be resolved within 48 hours',
          'High severity bugs must be resolved within 1 week',
          'User feedback must be triaged within 24 hours',
          'Feature freeze: beta-v1 tag marks the feature cutoff',
          'Post-beta: full system audit required before public launch',
        ],
        allowedChanges: [
          'Bug fixes (severity: critical, high, medium)',
          'Performance optimizations',
          'Security patches',
          'Documentation updates',
          'Monitoring and alerting improvements',
          'Error message improvements',
          'UI polish (no new components)',
        ],
        prohibitedChanges: [
          'New feature development',
          'Database schema additions (except bug fix migrations)',
          'New API endpoints (except monitoring/stability)',
          'Third-party service integrations',
          'UI redesigns or major layout changes',
          'Dependency version upgrades (unless security-critical)',
        ],
      },
      metrics: {
        totalUsers,
        activeUsers,
        totalCases,
        totalEvidence,
        unresolvedErrors,
        openBugs,
        openFeedback,
        stabilityScore: calculateStabilityScore({
          unresolvedErrors,
          openBugs,
          openFeedback,
          activeUsers,
        }),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[BetaStability] Status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stability status' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/beta-stability/checklist — Pre-launch readiness checklist
// ---------------------------------------------------------------------------

router.get('/checklist', async (_req, res) => {
  try {
    const [
      unresolvedErrors,
      openBugs,
      criticalBugs,
      openFeedback,
      totalReports,
      alertRulesEnabled,
    ] = await Promise.all([
      prisma.systemErrorLog.count({ where: { resolved: false } }),
      prisma.bugReport.count({ where: { status: { in: ['open', 'in_progress'] } } }).catch(() => 0),
      prisma.bugReport.count({ where: { status: { in: ['open', 'in_progress'] }, severity: 'critical' } }).catch(() => 0),
      prisma.betaFeedback.count({ where: { status: 'open' } }).catch(() => 0),
      prisma.betaHealthReport.count().catch(() => 0),
      prisma.alertRule.count({ where: { enabled: true } }).catch(() => 0),
    ]);

    const checklist = [
      { item: 'All critical bugs resolved', passed: criticalBugs === 0, details: `${criticalBugs} critical bugs open` },
      { item: 'Open bugs under threshold (< 5)', passed: openBugs < 5, details: `${openBugs} bugs open` },
      { item: 'Unresolved system errors under threshold (< 3)', passed: unresolvedErrors < 3, details: `${unresolvedErrors} unresolved errors` },
      { item: 'All feedback triaged', passed: openFeedback === 0, details: `${openFeedback} feedback items open` },
      { item: 'Minimum 4 weekly health reports generated', passed: totalReports >= 4, details: `${totalReports} reports generated` },
      { item: 'Alert rules configured and enabled', passed: alertRulesEnabled >= 3, details: `${alertRulesEnabled} alert rules enabled` },
      { item: 'SSL/HTTPS configured', passed: false, details: 'Requires production deployment (Phase 115)' },
      { item: '30-day stability period completed', passed: false, details: 'Beta period in progress' },
    ];

    const passedCount = checklist.filter(c => c.passed).length;

    res.json({
      checklist,
      summary: {
        total: checklist.length,
        passed: passedCount,
        failed: checklist.length - passedCount,
        readyForLaunch: passedCount === checklist.length,
      },
    });
  } catch (err) {
    console.error('[BetaStability] Checklist error:', err.message);
    res.status(500).json({ error: 'Failed to generate checklist' });
  }
});

// ---------------------------------------------------------------------------
// Stability score calculation
// ---------------------------------------------------------------------------

function calculateStabilityScore({ unresolvedErrors, openBugs, openFeedback, activeUsers }) {
  // Score from 0–100 (higher = more stable)
  let score = 100;

  // Deductions
  score -= unresolvedErrors * 5;  // -5 per unresolved error
  score -= openBugs * 3;          // -3 per open bug
  score -= openFeedback * 1;      // -1 per open feedback
  if (activeUsers === 0) score -= 10; // -10 if no active users

  return Math.max(0, Math.min(100, score));
}

export default router;
