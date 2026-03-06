// ============================================
// Court Access — Beta Access Control
// Phase 104: Invite-only closed beta program
//
// Requirements:
// - Invite codes expire after 7 days
// - Maximum beta accounts: 50
// - Admin-only invite generation
// ============================================

import { Router } from 'express';
import crypto from 'crypto';
import { authenticate, requireRole } from '../middleware/auth.js';
import prisma from '../services/prismaClient.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('admin'));

const DEFAULT_MAX_BETA_ACCOUNTS = 50;
const DEFAULT_INVITE_EXPIRE_DAYS = 7;

/**
 * GET /api/admin/beta-access/config
 * Get current beta access configuration.
 */
router.get('/config', async (_req, res) => {
  try {
    let config = await prisma.betaAccessConfig.findFirst();
    if (!config) {
      config = await prisma.betaAccessConfig.create({
        data: {
          maxBetaAccounts: DEFAULT_MAX_BETA_ACCOUNTS,
          inviteExpireDays: DEFAULT_INVITE_EXPIRE_DAYS,
          registrationOpen: false,
        },
      });
    }

    const activeInvites = await prisma.betaInvite.count({
      where: { status: 'pending' },
    });
    const acceptedInvites = await prisma.betaInvite.count({
      where: { status: 'accepted' },
    });
    const totalUsers = await prisma.user.count({
      where: { status: 'active' },
    });

    res.json({
      config,
      stats: {
        activeInvites,
        acceptedInvites,
        totalActiveUsers: totalUsers,
        remainingSlots: Math.max(0, config.maxBetaAccounts - totalUsers),
      },
    });
  } catch (err) {
    console.error('[BetaAccess] Config error:', err.message);
    res.status(500).json({ error: 'Failed to fetch beta config' });
  }
});

/**
 * PUT /api/admin/beta-access/config
 * Update beta access configuration.
 */
router.put('/config', async (req, res) => {
  try {
    const { maxBetaAccounts, inviteExpireDays, registrationOpen } = req.body;

    let config = await prisma.betaAccessConfig.findFirst();
    if (!config) {
      config = await prisma.betaAccessConfig.create({
        data: {
          maxBetaAccounts: maxBetaAccounts || DEFAULT_MAX_BETA_ACCOUNTS,
          inviteExpireDays: inviteExpireDays || DEFAULT_INVITE_EXPIRE_DAYS,
          registrationOpen: registrationOpen || false,
        },
      });
    } else {
      config = await prisma.betaAccessConfig.update({
        where: { id: config.id },
        data: {
          ...(maxBetaAccounts !== undefined && { maxBetaAccounts }),
          ...(inviteExpireDays !== undefined && { inviteExpireDays }),
          ...(registrationOpen !== undefined && { registrationOpen }),
        },
      });
    }

    res.json({ config });
  } catch (err) {
    console.error('[BetaAccess] Config update error:', err.message);
    res.status(500).json({ error: 'Failed to update beta config' });
  }
});

/**
 * POST /api/admin/beta-access/invite
 * Generate a new beta invite code.
 */
router.post('/invite', async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check beta capacity
    let config = await prisma.betaAccessConfig.findFirst();
    const maxAccounts = config?.maxBetaAccounts || DEFAULT_MAX_BETA_ACCOUNTS;
    const expireDays = config?.inviteExpireDays || DEFAULT_INVITE_EXPIRE_DAYS;

    const totalUsers = await prisma.user.count({ where: { status: 'active' } });
    if (totalUsers >= maxAccounts) {
      return res.status(400).json({
        error: `Beta capacity reached (${maxAccounts} accounts). Increase limit or wait for slots.`,
      });
    }

    // Check for existing pending invite
    const existing = await prisma.betaInvite.findFirst({
      where: { email: email.toLowerCase(), status: 'pending' },
    });
    if (existing) {
      return res.status(409).json({
        error: 'A pending invite already exists for this email',
        inviteCode: existing.inviteCode,
      });
    }

    // Generate invite
    const inviteCode = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expireDays);

    const invite = await prisma.betaInvite.create({
      data: {
        email: email.toLowerCase(),
        role: role || 'attorney',
        inviteCode,
        status: 'pending',
        expiresAt,
      },
    });

    res.status(201).json({
      invite: {
        id: invite.id,
        email: invite.email,
        inviteCode: invite.inviteCode,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
      signupUrl: `/signup?invite=${invite.inviteCode}`,
    });
  } catch (err) {
    console.error('[BetaAccess] Invite error:', err.message);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

/**
 * GET /api/admin/beta-access/invites
 * List all beta invites.
 */
router.get('/invites', async (req, res) => {
  try {
    const { status } = req.query;

    const where = status ? { status } : {};
    const invites = await prisma.betaInvite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Auto-expire overdue invites
    const now = new Date();
    const expired = invites.filter(
      i => i.status === 'pending' && new Date(i.expiresAt) < now
    );
    if (expired.length > 0) {
      await prisma.betaInvite.updateMany({
        where: { id: { in: expired.map(i => i.id) } },
        data: { status: 'expired' },
      });
    }

    res.json({
      invites: invites.map(i => ({
        ...i,
        status: expired.find(e => e.id === i.id) ? 'expired' : i.status,
      })),
      total: invites.length,
    });
  } catch (err) {
    console.error('[BetaAccess] List invites error:', err.message);
    res.status(500).json({ error: 'Failed to list invites' });
  }
});

/**
 * DELETE /api/admin/beta-access/invite/:inviteId
 * Revoke a beta invite.
 */
router.delete('/invite/:inviteId', async (req, res) => {
  try {
    const { inviteId } = req.params;

    await prisma.betaInvite.update({
      where: { id: inviteId },
      data: { status: 'revoked' },
    });

    res.json({ success: true, inviteId });
  } catch (err) {
    console.error('[BetaAccess] Revoke error:', err.message);
    res.status(500).json({ error: 'Failed to revoke invite' });
  }
});

export default router;
