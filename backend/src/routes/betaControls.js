// ============================================
// Court Access — Beta User Controls Routes
// Phase 43: Invite-only registration, admin enable/disable, usage limits
// ============================================

import { Router } from 'express';
import crypto from 'crypto';
import prisma from '../services/prismaClient.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// All beta control routes require admin role
router.use(authenticate);
router.use(requireRole('admin'));

// ---------------------------------------------------------------------------
// Beta Usage Limits (configurable per deployment)
// ---------------------------------------------------------------------------

const BETA_LIMITS = {
  maxUsers: 50,
  maxCasesPerUser: 10,
  maxEvidencePerCase: 25,
  maxStoragePerUserBytes: 5 * 1024 * 1024 * 1024, // 5 GB
  maxFileSizeBytes: 500 * 1024 * 1024, // 500 MB
};

// ---------------------------------------------------------------------------
// GET /api/admin/beta/invites — List all beta invites
// ---------------------------------------------------------------------------

router.get('/invites', async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (status) where.status = status;

    const [invites, total] = await Promise.all([
      prisma.betaInvite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.betaInvite.count({ where }),
    ]);

    res.json({ invites, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error('[Beta Controls] List invites error:', err.message);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/beta/invites — Send a beta invite
// ---------------------------------------------------------------------------

router.post('/invites', async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if invite already exists for this email
    const existing = await prisma.betaInvite.findFirst({
      where: { email: email.toLowerCase(), status: 'pending' },
    });
    if (existing) {
      return res.status(409).json({ error: 'Pending invite already exists for this email' });
    }

    // Check user limit
    const userCount = await prisma.user.count();
    if (userCount >= BETA_LIMITS.maxUsers) {
      return res.status(400).json({ error: `Beta user limit reached (${BETA_LIMITS.maxUsers})` });
    }

    const inviteCode = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await prisma.betaInvite.create({
      data: {
        email: email.toLowerCase(),
        role: role || 'attorney',
        inviteCode,
        expiresAt,
      },
    });

    res.status(201).json({
      invite,
      signupUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/signup?invite=${inviteCode}`,
    });
  } catch (err) {
    console.error('[Beta Controls] Create invite error:', err.message);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/beta/invites/:id — Revoke a beta invite
// ---------------------------------------------------------------------------

router.delete('/invites/:id', async (req, res) => {
  try {
    await prisma.betaInvite.update({
      where: { id: req.params.id },
      data: { status: 'revoked' },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[Beta Controls] Revoke invite error:', err.message);
    res.status(500).json({ error: 'Failed to revoke invite' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/beta/users — List all beta users with usage stats
// ---------------------------------------------------------------------------

router.get('/users', async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (status) where.status = status;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          plan: true,
          subscriptionStatus: true,
          onboardingComplete: true,
          storageUsedBytes: true,
          lastLoginAt: true,
          createdAt: true,
          _count: { select: { cases: true, evidenceRecords: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map((u) => ({
        ...u,
        caseCount: u._count.cases,
        evidenceCount: u._count.evidenceRecords,
        _count: undefined,
        limits: BETA_LIMITS,
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error('[Beta Controls] List users error:', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/beta/users/:id/status — Enable/disable a user
// ---------------------------------------------------------------------------

router.put('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['active', 'inactive', 'suspended', 'onboarding'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status },
      select: { id: true, email: true, name: true, status: true },
    });

    // Audit log
    await prisma.userAuditLog.create({
      data: {
        userId: req.user.id,
        action: 'admin_action',
        resource: req.params.id,
        metadata: { action: 'user_status_change', newStatus: status },
      },
    }).catch(() => {});

    res.json({ user });
  } catch (err) {
    console.error('[Beta Controls] Update user status error:', err.message);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/beta/users/:id/role — Change user role
// ---------------------------------------------------------------------------

router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'attorney', 'investigator', 'client', 'staff'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${validRoles.join(', ')}` });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    res.json({ user });
  } catch (err) {
    console.error('[Beta Controls] Update user role error:', err.message);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/beta/limits — Get current beta limits
// ---------------------------------------------------------------------------

router.get('/limits', (req, res) => {
  res.json({ limits: BETA_LIMITS });
});

// ---------------------------------------------------------------------------
// GET /api/admin/beta/stats — Beta program statistics
// ---------------------------------------------------------------------------

router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalInvites,
      pendingInvites,
      acceptedInvites,
      totalCases,
      totalEvidence,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.betaInvite.count(),
      prisma.betaInvite.count({ where: { status: 'pending' } }),
      prisma.betaInvite.count({ where: { status: 'accepted' } }),
      prisma.case.count(),
      prisma.evidenceRecord.count(),
    ]);

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        totalInvites,
        pendingInvites,
        acceptedInvites,
        totalCases,
        totalEvidence,
        limits: BETA_LIMITS,
        capacityUsed: {
          users: `${totalUsers}/${BETA_LIMITS.maxUsers}`,
          percentage: Math.round((totalUsers / BETA_LIMITS.maxUsers) * 100),
        },
      },
    });
  } catch (err) {
    console.error('[Beta Controls] Stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch beta stats' });
  }
});

export default router;
