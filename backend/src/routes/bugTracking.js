// ============================================
// Court Access — Bug Tracking Routes
// Phase 121: Internal Bug Tracking System
//
// Each issue includes:
// - Reproduction steps
// - Screenshots (via URL)
// - Severity level
// - Component assignment
// ============================================

import { Router } from 'express';
import prisma from '../services/prismaClient.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// All bug tracking routes require admin role
router.use(authenticate);
router.use(requireRole('admin'));

// ---------------------------------------------------------------------------
// POST /api/admin/bugs — Create a bug report
// ---------------------------------------------------------------------------

router.post('/', async (req, res) => {
  try {
    const {
      feedbackId,
      title,
      description,
      reproductionSteps,
      severity,
      component,
      assignedTo,
      reportedBy,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }

    const bug = await prisma.bugReport.create({
      data: {
        feedbackId: feedbackId || null,
        title,
        description,
        reproductionSteps: reproductionSteps || '',
        severity: severity || 'medium',
        component: component || '',
        assignedTo: assignedTo || null,
        reportedBy: reportedBy || req.user.email || 'admin',
      },
    });

    res.status(201).json({ bug });
  } catch (err) {
    console.error('[BugTracking] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create bug report' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/bugs — List bug reports
// ---------------------------------------------------------------------------

router.get('/', async (req, res) => {
  try {
    const { status, severity, component, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (component) where.component = component;

    const [bugs, total] = await Promise.all([
      prisma.bugReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.bugReport.count({ where }),
    ]);

    res.json({ bugs, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error('[BugTracking] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch bug reports' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/bugs/stats — Bug report statistics
// ---------------------------------------------------------------------------

router.get('/stats', async (_req, res) => {
  try {
    const [total, open, inProgress, fixed, byComponent, bySeverity] = await Promise.all([
      prisma.bugReport.count(),
      prisma.bugReport.count({ where: { status: 'open' } }),
      prisma.bugReport.count({ where: { status: 'in_progress' } }),
      prisma.bugReport.count({ where: { status: { in: ['fixed', 'verified', 'closed'] } } }),
      prisma.bugReport.groupBy({ by: ['component'], _count: true }),
      prisma.bugReport.groupBy({ by: ['severity'], _count: true }),
    ]);

    res.json({
      total,
      open,
      inProgress,
      fixed,
      byComponent: byComponent.map(g => ({ component: g.component || 'unassigned', count: g._count })),
      bySeverity: bySeverity.map(g => ({ severity: g.severity, count: g._count })),
    });
  } catch (err) {
    console.error('[BugTracking] Stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch bug stats' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/bugs/:id — Get single bug report
// ---------------------------------------------------------------------------

router.get('/:id', async (req, res) => {
  try {
    const bug = await prisma.bugReport.findUnique({
      where: { id: req.params.id },
    });

    if (!bug) {
      return res.status(404).json({ error: 'Bug report not found' });
    }

    res.json({ bug });
  } catch (err) {
    console.error('[BugTracking] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch bug report' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/bugs/:id — Update bug report
// ---------------------------------------------------------------------------

router.patch('/:id', async (req, res) => {
  try {
    const {
      title,
      description,
      reproductionSteps,
      severity,
      status,
      component,
      assignedTo,
      fixCommit,
      fixVersion,
    } = req.body;

    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (reproductionSteps !== undefined) data.reproductionSteps = reproductionSteps;
    if (severity !== undefined) data.severity = severity;
    if (status !== undefined) {
      const validStatuses = ['open', 'in_progress', 'fixed', 'verified', 'closed', 'wont_fix'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }
      data.status = status;
    }
    if (component !== undefined) data.component = component;
    if (assignedTo !== undefined) data.assignedTo = assignedTo;
    if (fixCommit !== undefined) data.fixCommit = fixCommit;
    if (fixVersion !== undefined) data.fixVersion = fixVersion;

    const bug = await prisma.bugReport.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ bug });
  } catch (err) {
    console.error('[BugTracking] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update bug report' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/bugs/:id — Delete bug report
// ---------------------------------------------------------------------------

router.delete('/:id', async (req, res) => {
  try {
    await prisma.bugReport.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[BugTracking] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete bug report' });
  }
});

export default router;
