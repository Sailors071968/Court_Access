// ============================================
// Court Access — Auth Routes
// Phase 36/43: User signup, login, invite-based registration
// ============================================

import { Router } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../services/prismaClient.js';
import { generateToken, authenticate } from '../middleware/auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/auth/login — Authenticate user and return JWT
// ---------------------------------------------------------------------------

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Audit log
    await prisma.userAuditLog.create({
      data: {
        userId: user.id,
        action: 'login',
        ipAddress: req.ip || '',
      },
    }).catch(() => {});

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        status: user.status,
        onboardingComplete: user.onboardingComplete,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/signup — Public signup (beta: requires invite code)
// ---------------------------------------------------------------------------

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, inviteCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Beta mode: validate invite code if provided
    let invite = null;
    if (inviteCode) {
      invite = await prisma.betaInvite.findUnique({ where: { inviteCode } });
      if (!invite) {
        return res.status(400).json({ error: 'Invalid invite code' });
      }
      if (invite.status !== 'pending') {
        return res.status(400).json({ error: `Invite code is ${invite.status}` });
      }
      if (new Date() > invite.expiresAt) {
        await prisma.betaInvite.update({
          where: { id: invite.id },
          data: { status: 'expired' },
        });
        return res.status(400).json({ error: 'Invite code has expired' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name || '',
        role: invite?.role || 'attorney',
        status: 'active',
        plan: 'free',
        betaInviteId: invite?.id || null,
        onboardingComplete: false,
      },
    });

    // Mark invite as accepted
    if (invite) {
      await prisma.betaInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      });
    }

    // Audit log
    await prisma.userAuditLog.create({
      data: {
        userId: user.id,
        action: 'signup',
        ipAddress: req.ip || '',
        metadata: { inviteCode: inviteCode || null },
      },
    }).catch(() => {});

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        status: user.status,
        onboardingComplete: user.onboardingComplete,
      },
    });
  } catch (err) {
    console.error('[Auth] Signup error:', err.message);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me — Get current user profile
// ---------------------------------------------------------------------------

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        status: true,
        subscriptionStatus: true,
        onboardingComplete: true,
        storageUsedBytes: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Convert BigInt fields to Number for JSON serialization
    const safeUser = {
      ...user,
      storageUsedBytes: Number(user.storageUsedBytes),
    };

    res.json({ user: safeUser });
  } catch (err) {
    console.error('[Auth] Profile error:', err.message);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/demo-login — Quick demo access (dev/beta only)
// ---------------------------------------------------------------------------

router.post('/demo-login', async (req, res) => {
  // Only allow demo login in development/staging
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const { role } = req.body;
    const demoEmails = {
      attorney: 'attorney@courtaccess.com',
      investigator: 'investigator@courtaccess.com',
      admin: 'admin@courtaccess.com',
      client: 'client@courtaccess.com',
    };

    // Validate role against known demo roles to prevent arbitrary role injection
    const validRole = demoEmails[role] ? role : 'attorney';
    const email = demoEmails[validRole];

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Create demo user on first access
      const passwordHash = await bcrypt.hash('password', 12);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: `Demo ${validRole.charAt(0).toUpperCase() + validRole.slice(1)}`,
          role: validRole,
          status: 'active',
          plan: 'professional',
          onboardingComplete: true,
        },
      });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        status: user.status,
        onboardingComplete: user.onboardingComplete,
      },
    });
  } catch (err) {
    console.error('[Auth] Demo login error:', err.message);
    res.status(500).json({ error: 'Demo login failed' });
  }
});

export default router;
