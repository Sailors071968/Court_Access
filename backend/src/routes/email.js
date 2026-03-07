// ============================================
// Court Access — Phases 63-69: Email System Routes
// Verified email registry, sandbox compliance, email logging
// ============================================

import express from 'express';
import prisma from '../services/prismaClient.js';
import {
  requestVerification,
  confirmVerification,
  getSandboxStatus,
  isRecipientVerified,
} from '../services/emailService.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Phase 63: POST /api/email/verify — Request email verification
// ---------------------------------------------------------------------------

router.post('/verify', authenticate, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Valid email address required' });
    }

    const result = await requestVerification(email);
    res.json(result);
  } catch (err) {
    console.error('[Email] Verification request error:', err.message);
    res.status(500).json({ error: 'Failed to request verification' });
  }
});

// ---------------------------------------------------------------------------
// Phase 63: GET /api/email/verify/:token — Confirm email verification
// ---------------------------------------------------------------------------

router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await confirmVerification(token);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({ verified: true });
  } catch (err) {
    console.error('[Email] Verification confirm error:', err.message);
    res.status(500).json({ error: 'Failed to confirm verification' });
  }
});

// ---------------------------------------------------------------------------
// Phase 63: GET /api/email/verified — List verified emails
// ---------------------------------------------------------------------------

router.get('/verified', authenticate, requireRole('admin', 'staff'), async (_req, res) => {
  try {
    const emails = await prisma.verifiedEmail.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ emails });
  } catch (err) {
    console.error('[Email] List verified error:', err.message);
    res.status(500).json({ error: 'Failed to list verified emails' });
  }
});

// ---------------------------------------------------------------------------
// Phase 66: GET /api/email/check/:email — Check if email is verified
// ---------------------------------------------------------------------------

router.get('/check/:email', authenticate, async (req, res) => {
  try {
    const { email } = req.params;
    const verified = await isRecipientVerified(email);
    res.json({ email, verified });
  } catch (err) {
    console.error('[Email] Check error:', err.message);
    res.status(500).json({ error: 'Failed to check email status' });
  }
});

// ---------------------------------------------------------------------------
// Phase 66: GET /api/email/sandbox-status — Get sandbox mode status
// ---------------------------------------------------------------------------

router.get('/sandbox-status', authenticate, requireRole('admin', 'staff'), async (_req, res) => {
  try {
    const status = getSandboxStatus();
    const verifiedCount = await prisma.verifiedEmail.count({
      where: { verificationStatus: 'verified' },
    });
    const pendingCount = await prisma.verifiedEmail.count({
      where: { verificationStatus: 'pending' },
    });

    res.json({
      ...status,
      verifiedCount,
      pendingCount,
    });
  } catch (err) {
    console.error('[Email] Sandbox status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch sandbox status' });
  }
});

// ---------------------------------------------------------------------------
// Phase 67: GET /api/email/logs — Email activity log (admin)
// ---------------------------------------------------------------------------

router.get('/logs', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const { page = '1', limit = '50', emailType, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (emailType) where.emailType = emailType;
    if (status) where.deliveryStatus = status;

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip,
      }),
      prisma.emailLog.count({ where }),
    ]);

    res.json({
      logs,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('[Email] Logs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch email logs' });
  }
});

// ---------------------------------------------------------------------------
// Phase 65: GET /api/email/queue — Email queue status
// ---------------------------------------------------------------------------

router.get('/queue', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};

    const [jobs, stats] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.emailJob.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    res.json({
      jobs,
      stats: stats.reduce((acc, s) => {
        acc[s.status] = s._count.id;
        return acc;
      }, {}),
    });
  } catch (err) {
    console.error('[Email] Queue error:', err.message);
    res.status(500).json({ error: 'Failed to fetch email queue' });
  }
});

export default router;
