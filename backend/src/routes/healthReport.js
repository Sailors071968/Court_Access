// ============================================
// Court Access — Weekly Beta Health Report Routes
// Phase 122: Health reporting for beta period
//
// Reports include:
// - Active users
// - Cases created
// - Evidence files processed
// - Worker performance
// - System errors
// - Feedback & bug counts
// ============================================

import { Router } from 'express';
import prisma from '../services/prismaClient.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getWorkerStatuses } from '../services/workerMonitor.js';

const router = Router();

// All health report routes require admin role
router.use(authenticate);
router.use(requireRole('admin'));

// ---------------------------------------------------------------------------
// POST /api/admin/health-report/generate — Generate a new weekly report
// ---------------------------------------------------------------------------

router.post('/generate', async (req, res) => {
  try {
    const now = new Date();
    const periodEnd = now;
    const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    // Gather all metrics
    const [
      activeUsers,
      totalUsers,
      totalCases,
      casesThisWeek,
      totalEvidence,
      evidenceThisWeek,
      completedEvidence,
      errorEvidence,
      systemErrors,
      unresolvedErrors,
      feedbackCount,
      feedbackOpen,
      bugCount,
      bugsOpen,
      emailsSent,
      emailsFailed,
    ] = await Promise.all([
      prisma.user.count({ where: { status: 'active', lastLoginAt: { gte: periodStart } } }),
      prisma.user.count(),
      prisma.case.count(),
      prisma.case.count({ where: { createdAt: { gte: periodStart } } }),
      prisma.evidenceRecord.count(),
      prisma.evidenceRecord.count({ where: { createdAt: { gte: periodStart } } }),
      prisma.evidenceRecord.count({ where: { status: 'complete', updatedAt: { gte: periodStart } } }),
      prisma.evidenceRecord.count({ where: { status: 'error', updatedAt: { gte: periodStart } } }),
      prisma.systemErrorLog.count({ where: { lastSeen: { gte: periodStart } } }),
      prisma.systemErrorLog.count({ where: { resolved: false } }),
      prisma.betaFeedback.count({ where: { createdAt: { gte: periodStart } } }).catch(() => 0),
      prisma.betaFeedback.count({ where: { status: 'open' } }).catch(() => 0),
      prisma.bugReport.count({ where: { createdAt: { gte: periodStart } } }).catch(() => 0),
      prisma.bugReport.count({ where: { status: 'open' } }).catch(() => 0),
      prisma.emailLog.count({ where: { deliveryStatus: 'sent', createdAt: { gte: periodStart } } }).catch(() => 0),
      prisma.emailLog.count({ where: { deliveryStatus: { in: ['failed', 'bounced'] }, createdAt: { gte: periodStart } } }).catch(() => 0),
    ]);

    // Worker status
    const workerStatuses = getWorkerStatuses();
    const runningWorkers = workerStatuses.filter(w => w.status === 'running').length;
    const totalWorkers = workerStatuses.length;
    const workerUptime = totalWorkers > 0 ? (runningWorkers / totalWorkers) * 100 : 0;

    // Storage usage
    const storageResult = await prisma.user.aggregate({
      _sum: { storageUsedBytes: true },
    });
    const storageUsedBytes = storageResult._sum.storageUsedBytes || BigInt(0);

    // Build detailed report data
    const reportData = {
      users: {
        total: totalUsers,
        activeThisWeek: activeUsers,
      },
      cases: {
        total: totalCases,
        createdThisWeek: casesThisWeek,
      },
      evidence: {
        total: totalEvidence,
        uploadedThisWeek: evidenceThisWeek,
        processedThisWeek: completedEvidence,
        errorsThisWeek: errorEvidence,
        successRate: evidenceThisWeek > 0
          ? ((completedEvidence / evidenceThisWeek) * 100).toFixed(1)
          : '100.0',
      },
      workers: {
        statuses: workerStatuses,
        running: runningWorkers,
        total: totalWorkers,
        uptimePercent: workerUptime.toFixed(1),
      },
      errors: {
        newThisWeek: systemErrors,
        unresolved: unresolvedErrors,
      },
      feedback: {
        newThisWeek: feedbackCount,
        open: feedbackOpen,
      },
      bugs: {
        newThisWeek: bugCount,
        open: bugsOpen,
      },
      email: {
        sentThisWeek: emailsSent,
        failedThisWeek: emailsFailed,
      },
    };

    // Save report to database
    const report = await prisma.betaHealthReport.create({
      data: {
        reportDate: now,
        periodStart,
        periodEnd,
        activeUsers,
        totalCases,
        evidenceProcessed: completedEvidence,
        workerUptime,
        systemErrors,
        feedbackCount,
        bugCount,
        storageUsedBytes,
        reportData,
      },
    });

    report.storageUsedBytes = Number(report.storageUsedBytes);
    res.status(201).json({ report });
  } catch (err) {
    console.error('[HealthReport] Generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate health report' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/health-report — List all reports
// ---------------------------------------------------------------------------

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [reports, total] = await Promise.all([
      prisma.betaHealthReport.findMany({
        orderBy: { reportDate: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.betaHealthReport.count(),
    ]);

    const serialized = reports.map(r => ({ ...r, storageUsedBytes: Number(r.storageUsedBytes) }));
    res.json({ reports: serialized, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error('[HealthReport] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch health reports' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/health-report/latest — Get most recent report
// ---------------------------------------------------------------------------

router.get('/latest', async (_req, res) => {
  try {
    const report = await prisma.betaHealthReport.findFirst({
      orderBy: { reportDate: 'desc' },
    });

    if (!report) {
      return res.status(404).json({ error: 'No health reports found. Generate one first.' });
    }

    report.storageUsedBytes = Number(report.storageUsedBytes);
    res.json({ report });
  } catch (err) {
    console.error('[HealthReport] Latest error:', err.message);
    res.status(500).json({ error: 'Failed to fetch latest report' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/health-report/:id — Get specific report
// ---------------------------------------------------------------------------

router.get('/:id', async (req, res) => {
  try {
    const report = await prisma.betaHealthReport.findUnique({
      where: { id: req.params.id },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    report.storageUsedBytes = Number(report.storageUsedBytes);
    res.json({ report });
  } catch (err) {
    console.error('[HealthReport] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

export default router;
