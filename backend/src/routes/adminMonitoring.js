// ============================================
// Court Access — Admin Monitoring Routes
// Phase 42: Real backend monitoring endpoints
// ============================================

import { Router } from 'express';
import prisma from '../services/prismaClient.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getQueueStats } from '../workers/evidenceProcessor.js';

const router = Router();

// All admin monitoring routes require admin role
router.use(authenticate);
router.use(requireRole('admin'));

// ---------------------------------------------------------------------------
// GET /api/admin/monitoring/overview — System health overview
// ---------------------------------------------------------------------------

router.get('/overview', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalCases,
      totalEvidence,
      pendingEvidence,
      processingEvidence,
      errorEvidence,
      recentErrors,
      queueStats,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.case.count(),
      prisma.evidenceRecord.count(),
      prisma.evidenceRecord.count({ where: { status: 'pending' } }),
      prisma.evidenceRecord.count({ where: { status: 'processing' } }),
      prisma.evidenceRecord.count({ where: { status: 'error' } }),
      prisma.systemErrorLog.count({ where: { resolved: false } }),
      getQueueStats().catch(() => ({ waiting: 0, active: 0, completed: 0, failed: 0 })),
    ]);

    const services = [
      { name: 'API Server', status: 'healthy', uptime: process.uptime() },
      { name: 'Database', status: 'healthy', details: `${totalUsers} users, ${totalCases} cases` },
      { name: 'Evidence Processor', status: queueStats.active > 0 ? 'busy' : 'idle', details: `${queueStats.waiting} queued, ${queueStats.active} active` },
      { name: 'Error Monitor', status: recentErrors > 0 ? 'warning' : 'healthy', details: `${recentErrors} unresolved errors` },
    ];

    res.json({
      services,
      stats: {
        totalUsers,
        activeUsers,
        totalCases,
        totalEvidence,
        pendingEvidence,
        processingEvidence,
        errorEvidence,
        unresolvedErrors: recentErrors,
        queue: queueStats,
      },
      serverUptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Admin Monitoring] Overview error:', err.message);
    res.status(500).json({ error: 'Failed to fetch monitoring overview' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/monitoring/errors — List system errors
// ---------------------------------------------------------------------------

router.get('/errors', async (req, res) => {
  try {
    const { service, resolved, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (service) where.service = service;
    if (resolved !== undefined) where.resolved = resolved === 'true';

    const [errors, total] = await Promise.all([
      prisma.systemErrorLog.findMany({
        where,
        orderBy: { lastSeen: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.systemErrorLog.count({ where }),
    ]);

    res.json({ errors, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error('[Admin Monitoring] Errors list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch errors' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/monitoring/errors/:id/resolve — Mark error as resolved
// ---------------------------------------------------------------------------

router.post('/errors/:id/resolve', async (req, res) => {
  try {
    const updated = await prisma.systemErrorLog.update({
      where: { id: req.params.id },
      data: { resolved: true },
    });
    res.json({ errorLog: updated });
  } catch (err) {
    console.error('[Admin Monitoring] Resolve error:', err.message);
    res.status(500).json({ error: 'Failed to resolve error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/monitoring/jobs — Queue job status
// ---------------------------------------------------------------------------

router.get('/jobs', async (req, res) => {
  try {
    const stats = await getQueueStats().catch(() => ({
      waiting: 0, active: 0, completed: 0, failed: 0,
    }));

    // Get recent failed evidence records as proxy for failed jobs
    const failedJobs = await prisma.evidenceRecord.findMany({
      where: { status: 'error' },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        filename: true,
        evidenceType: true,
        status: true,
        jobId: true,
        processingResult: true,
        updatedAt: true,
      },
    });

    res.json({ stats, failedJobs });
  } catch (err) {
    console.error('[Admin Monitoring] Jobs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/monitoring/audit-log — User audit trail
// ---------------------------------------------------------------------------

router.get('/audit-log', async (req, res) => {
  try {
    const { userId, action, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.userAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      prisma.userAuditLog.count({ where }),
    ]);

    res.json({ logs, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error('[Admin Monitoring] Audit log error:', err.message);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/monitoring/log-error — Record a system error
// ---------------------------------------------------------------------------

router.post('/log-error', async (req, res) => {
  try {
    const { service, level, message, stackTrace, metadata } = req.body;

    if (!service || !message) {
      return res.status(400).json({ error: 'Service and message are required' });
    }

    // Deduplicate: if same service+message exists unresolved, increment count
    const existing = await prisma.systemErrorLog.findFirst({
      where: { service, message, resolved: false },
    });

    let errorLog;
    if (existing) {
      errorLog = await prisma.systemErrorLog.update({
        where: { id: existing.id },
        data: { count: existing.count + 1, lastSeen: new Date() },
      });
    } else {
      errorLog = await prisma.systemErrorLog.create({
        data: {
          service,
          level: level || 'error',
          message,
          stackTrace: stackTrace || null,
          metadata: metadata || {},
        },
      });
    }

    res.status(201).json({ errorLog });
  } catch (err) {
    console.error('[Admin Monitoring] Log error:', err.message);
    res.status(500).json({ error: 'Failed to log error' });
  }
});

export default router;
