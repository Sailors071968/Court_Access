// ============================================
// Court Access — Beta Feedback Routes
// Phase 120: Feedback Collection System
//
// Beta users can report:
// - Bugs
// - Analysis errors
// - UI issues
// - Performance problems
// - Feature requests
// ============================================

import { Router } from 'express';
import prisma from '../services/prismaClient.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// All feedback routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// POST /api/feedback — Submit feedback (any authenticated user)
// ---------------------------------------------------------------------------

router.post('/', async (req, res) => {
  try {
    const { feedbackType, title, description, severity, pageUrl, screenshotUrl } = req.body;

    if (!feedbackType || !title || !description) {
      return res.status(400).json({ error: 'feedbackType, title, and description are required' });
    }

    const validTypes = ['bug', 'analysis_error', 'ui_issue', 'performance', 'feature_request', 'other'];
    if (!validTypes.includes(feedbackType)) {
      return res.status(400).json({ error: `Invalid feedbackType. Must be one of: ${validTypes.join(', ')}` });
    }

    const feedback = await prisma.betaFeedback.create({
      data: {
        userId: req.user.id,
        feedbackType,
        title,
        description,
        severity: severity || 'medium',
        pageUrl: pageUrl || '',
        userAgent: req.headers['user-agent'] || '',
        screenshotUrl: screenshotUrl || null,
      },
    });

    res.status(201).json({ feedback });
  } catch (err) {
    console.error('[Feedback] Submit error:', err.message);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/feedback — List user's own feedback
// ---------------------------------------------------------------------------

router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { userId: req.user.id };
    if (status) where.status = status;

    const [feedbacks, total] = await Promise.all([
      prisma.betaFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.betaFeedback.count({ where }),
    ]);

    res.json({ feedbacks, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error('[Feedback] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// ---------------------------------------------------------------------------
// Admin Routes — Manage all feedback
// ---------------------------------------------------------------------------

// GET /api/feedback/admin/all — List all feedback (admin only)
router.get('/admin/all', requireRole('admin'), async (req, res) => {
  try {
    const { status, feedbackType, severity, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (status) where.status = status;
    if (feedbackType) where.feedbackType = feedbackType;
    if (severity) where.severity = severity;

    const [feedbacks, total] = await Promise.all([
      prisma.betaFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      prisma.betaFeedback.count({ where }),
    ]);

    res.json({ feedbacks, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error('[Feedback] Admin list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// GET /api/feedback/admin/stats — Feedback statistics (admin only)
router.get('/admin/stats', requireRole('admin'), async (_req, res) => {
  try {
    const [total, open, inReview, resolved, byType, bySeverity] = await Promise.all([
      prisma.betaFeedback.count(),
      prisma.betaFeedback.count({ where: { status: 'open' } }),
      prisma.betaFeedback.count({ where: { status: 'in_review' } }),
      prisma.betaFeedback.count({ where: { status: { in: ['resolved', 'closed'] } } }),
      prisma.betaFeedback.groupBy({ by: ['feedbackType'], _count: true }),
      prisma.betaFeedback.groupBy({ by: ['severity'], _count: true }),
    ]);

    res.json({
      total,
      open,
      inReview,
      resolved,
      byType: byType.map(g => ({ type: g.feedbackType, count: g._count })),
      bySeverity: bySeverity.map(g => ({ severity: g.severity, count: g._count })),
    });
  } catch (err) {
    console.error('[Feedback] Stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch feedback stats' });
  }
});

// PATCH /api/feedback/admin/:id — Update feedback status (admin only)
router.patch('/admin/:id', requireRole('admin'), async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const data = {};

    if (status) {
      const validStatuses = ['open', 'in_review', 'acknowledged', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }
      data.status = status;
      if (status === 'resolved' || status === 'closed') {
        data.resolvedAt = new Date();
      }
    }

    if (adminNotes !== undefined) data.adminNotes = adminNotes;

    const feedback = await prisma.betaFeedback.update({
      where: { id: req.params.id },
      data,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    res.json({ feedback });
  } catch (err) {
    console.error('[Feedback] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

export default router;
