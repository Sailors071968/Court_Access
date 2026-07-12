// ============================================================================
// Phase 191 — Authentication Middleware
// JWT authentication, refresh tokens, session expiration, role-based access control
// Roles: admin, attorney, investigator, staff, defendant
// Now persisted to PostgreSQL via Prisma (replaces in-memory Maps).
// ============================================================================

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { mapSubscriptionStatusForClient } from '../membership/universalMembership.js';
import {
  validateDefaultRole,
  resolveRoleOnboarding,
} from '../membership/roleOnboarding.js';

const BCRYPT_SALT_ROUNDS = 12;

// Pre-computed dummy hash for timing-safe user-not-found responses.
// Without this, bcrypt.compare (~100ms) only runs when a user exists,
// creating a measurable timing oracle for user enumeration.
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('dummy-timing-safe', BCRYPT_SALT_ROUNDS);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = 'admin' | 'attorney' | 'investigator' | 'staff' | 'defendant';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenRecord {
  token: string;
  userId: string;
  email: string;
  role: UserRole;
  expiresAt: Date;
  createdAt: Date;
  revoked: boolean;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user?: JwtPayload;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60;
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

// Refresh tokens and security logs are now persisted to PostgreSQL via Prisma.
// See models: RefreshToken, SecurityLog in schema.prisma.

// ---------------------------------------------------------------------------
// Token Generation
// ---------------------------------------------------------------------------

export function generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export async function generateRefreshToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  device?: { userAgent?: string; ipAddress?: string; deviceLabel?: string },
): Promise<string> {
  const token = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  await prisma.refreshToken.create({
    data: {
      token,
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000),
      userAgent: device?.userAgent,
      ipAddress: device?.ipAddress,
      deviceLabel: device?.deviceLabel,
      lastSeenAt: new Date(),
    },
  });

  return token;
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function verifyRefreshToken(token: string): Promise<JwtPayload> {
  const payload = jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
  const record = await prisma.refreshToken.findUnique({ where: { token } });
  if (!record || record.revoked) {
    throw new Error('Refresh token has been revoked');
  }
  return payload;
}

export async function revokeRefreshToken(token: string): Promise<boolean> {
  try {
    await prisma.refreshToken.update({
      where: { token },
      data: { revoked: true },
    });
    return true;
  } catch {
    return false;
  }
}

export async function revokeAllUserTokens(userId: string): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });
  return result.count;
}

// ---------------------------------------------------------------------------
// Security Event Logging
// ---------------------------------------------------------------------------

export async function logSecurityEvent(event: string, userId?: string, ip?: string, details?: string): Promise<void> {
  try {
    await prisma.securityLog.create({
      data: {
        event,
        userId: userId ?? null,
        ip: ip ?? null,
        details: details ?? null,
      },
    });
  } catch {
    // Fallback: log without userId FK if user doesn't exist yet
    try {
      await prisma.securityLog.create({
        data: {
          event,
          userId: null,
          ip: ip ?? null,
          details: details ? `[uid:${userId}] ${details}` : `[uid:${userId}]`,
        },
      });
    } catch {
      // Last resort: console log if DB is unavailable
      console.error(`[SecurityLog] ${event} userId=${userId} ip=${ip} ${details}`);
    }
  }
}

export async function getSecurityLog(limit = 100): Promise<Array<{
  timestamp: string;
  event: string;
  userId?: string | null;
  ip?: string | null;
  details?: string | null;
}>> {
  const logs = await prisma.securityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return logs.map((l) => ({
    timestamp: l.createdAt.toISOString(),
    event: l.event,
    userId: l.userId,
    ip: l.ip,
    details: l.details,
  }));
}

// ---------------------------------------------------------------------------
// Role-Based Access Control
// ---------------------------------------------------------------------------

const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 4,
  attorney: 3,
  investigator: 2,
  staff: 1,
  defendant: 0,
};

// Route permission map: route prefix → minimum required roles
const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/api/compliance': ['admin', 'attorney', 'investigator'],
  '/api/clients': ['admin', 'attorney', 'investigator', 'staff'],
  '/api/organizations': ['admin', 'attorney', 'investigator', 'staff'],
  '/api/firm': ['admin', 'attorney', 'investigator', 'staff'],
  '/api/policy-intelligence': ['admin', 'attorney', 'staff'],
  '/api/policy-pipeline': ['admin', 'staff'],
  '/api/operations': ['admin', 'staff'],
  '/api/exhibits': ['admin', 'attorney'],
  '/api/cpra': ['admin', 'staff'],
  '/api/crawler': ['admin'],
  '/api/forensic': ['admin', 'attorney', 'investigator'],
  '/api/forensic/expert-package': ['admin', 'attorney'],
  '/api/forensic/jury-view': ['admin', 'attorney'],
  '/api/admin/billing/metrics': ['admin', 'staff'],
  '/api/admin/production-gates': ['admin', 'staff'],
  '/api/admin/operations': ['admin', 'staff'],
  '/api/admin/audit': ['admin', 'staff'],
  '/api/admin/alerts': ['admin', 'staff'],
  '/api/admin/changes': ['admin', 'staff'],
  '/api/admin/backup': ['admin'],
  '/api/admin/engineering-dashboard': ['admin', 'staff'],
  '/api/admin/deployment-checks': ['admin', 'staff'],
  '/api/admin/discount-codes': ['admin', 'staff'],
  '/api/admin/stats': ['admin', 'staff'],
  '/api/admin/users': ['admin', 'staff'],
  '/api/admin/cases': ['admin', 'staff'],
  '/api/admin/evidence': ['admin', 'staff'],
  '/api/admin': ['admin'],
  '/api/security': ['admin'],
  '/api/corpus': ['admin'],
  '/api/legislative/audit': ['admin'],
  '/api/legislative': ['admin', 'attorney', 'staff'],
};

export function hasPermission(role: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(role);
}

export function getRequiredRoles(path: string): UserRole[] | null {
  // Check most specific paths first (longer prefixes)
  const sortedPrefixes = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length);
  for (const prefix of sortedPrefixes) {
    if (path.startsWith(prefix)) {
      return ROUTE_PERMISSIONS[prefix];
    }
  }
  return null; // No permission requirement found
}

// ---------------------------------------------------------------------------
// Fastify Authentication Hook
// ---------------------------------------------------------------------------

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/metrics',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/debug-check',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/mfa/challenge',
  '/api/auth/accept-invitation',
  '/api/organizations/invitations/preview',
  '/api/discount-codes/validate',
  '/api/contact',
  '/api/billing/webhook',
];

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(route => path === route || path.startsWith(route + '/'));
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Optional authentication: if a valid Bearer token is present, populate
 * `request.user`; otherwise leave it unset and continue. Never rejects, so
 * public/token-less routes are unaffected. Individual routes retain their own
 * `if (!user) 401` guards, so this only fixes the plumbing that lets
 * authenticated data routes see the caller identity.
 */
export async function optionalAuthHook(
  request: AuthenticatedRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);
  if (!token) return;
  try {
    request.user = verifyAccessToken(token);
  } catch {
    // Invalid/expired token: leave request.user unset; route guards handle it.
  }
}

export async function authenticationHook(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  const path = request.url.split('?')[0]; // Strip query params

  // Skip auth for public routes
  if (isPublicRoute(path)) {
    return;
  }

  // Skip auth for non-API routes
  if (!path.startsWith('/api/')) {
    return;
  }

  // Extract token
  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    void logSecurityEvent('UNAUTHORIZED_ACCESS', undefined, request.ip, `No token provided for ${path}`);
  return reply.code(401).send({
  error: 'Authentication required',
  message: 'Please provide a valid Bearer token in the Authorization header',
});
  }

  // Verify token
  try {
    const payload = verifyAccessToken(token);
    request.user = payload;

    // Check role-based permissions
    const requiredRoles = getRequiredRoles(path);
    if (requiredRoles && !hasPermission(payload.role, requiredRoles)) {
      void logSecurityEvent(
        'FORBIDDEN_ACCESS',
        payload.userId,
        request.ip,
        `Role ${payload.role} attempted to access ${path} (requires: ${requiredRoles.join(', ')})`,
      );
      reply.code(403).send({
        error: 'Forbidden',
        message: `Your role (${payload.role}) does not have permission to access this resource`,
        requiredRoles,
      });
      return;
    }

    void logSecurityEvent('AUTHENTICATED_ACCESS', payload.userId, request.ip, path);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Invalid token';
    void logSecurityEvent('INVALID_TOKEN', undefined, request.ip, `${errorMessage} for ${path}`);
    reply.code(401).send({
      error: 'Invalid or expired token',
      message: errorMessage,
    });
    return;
  }
}

// ---------------------------------------------------------------------------
// Auth Routes (login, register, refresh, logout)
// ---------------------------------------------------------------------------

// User accounts are now persisted to PostgreSQL via Prisma User model.

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/auth/debug-check — deployment verification (no auth required)
  // Returns which code version is running so you can confirm PR #74 is deployed.
  // REMOVE THIS ENDPOINT once auth is confirmed working in production.
  app.get('/api/auth/debug-check', async (_request: FastifyRequest, _reply: FastifyReply) => {
    let bcryptLoaded = false;
    try {
      // Verify bcrypt native module actually loads
      const testHash = await bcrypt.hash('test', 4);
      bcryptLoaded = testHash.startsWith('$2');
    } catch {
      bcryptLoaded = false;
    }

    // No user-lookup on unauthenticated endpoint — only return version/bcrypt info.
    // Use PM2 logs or admin endpoints for user-level debugging.
    return {
      authVersion: 'PR74-bcrypt',
      bcryptLoaded,
      hashMethod: 'bcrypt',
      timestamp: new Date().toISOString(),
    };
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { email: string; password: string };

    if (!body?.email || !body?.password) {
      console.log(`[Auth:Login] REJECTED: missing email or password. body keys=${Object.keys(body || {})}`);
      void logSecurityEvent('LOGIN_FAILED', undefined, request.ip, 'Missing email or password');
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    // Normalize email: trim whitespace + lowercase (PostgreSQL is case-sensitive)
    const email = body.email.trim().toLowerCase();
    const password = body.password;

    console.log(`[Auth:Login] Attempt email="${email}"`);

    console.log("AUTH HEADER:", request.headers.authorization);

    let user;
    try {
      user = await prisma.user.findUnique({ where: { email } });
    } catch (dbErr) {
      console.error(`[Auth:Login] DB ERROR during user lookup:`, dbErr);
      return reply.code(500).send({ error: 'Internal server error during authentication' });
    }

    // Debug logging (temporary — remove after production is confirmed working)
    console.log(`[Auth:Login] Lookup email="${email}" found=${!!user}${user ? ` isBcrypt=${user.passwordHash.startsWith('$2')}` : ''}`);

    if (!user) {
      // Try case-insensitive lookup as a fallback diagnostic
      try {
        const ciUser = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });
        if (ciUser) {
          console.log(`[Auth:Login] CASE MISMATCH: input="${email}" dbEmail="${ciUser.email}" — using DB email for lookup`);
          user = ciUser;
        }
      } catch {
        // findFirst with mode:'insensitive' might not be supported — ignore
      }
    }

    if (!user) {
      // Perform dummy bcrypt compare to equalize response time with the
      // "user found" path, preventing user-enumeration timing attacks.
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      console.log(`[Auth:Login] FAILED: user not found for email="${email}"`);
      void logSecurityEvent('LOGIN_FAILED', undefined, request.ip, `Failed login for ${email} — user not found`);
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    // Support both bcrypt hashes ($2b$...) and legacy SHA-256 hashes.
    // If password matches via legacy SHA-256, auto-migrate to bcrypt.
    let passwordValid = false;
    const isBcryptHash = user.passwordHash.startsWith('$2');

    console.log(`[Auth:Login] email="${email}" hashType=${isBcryptHash ? 'bcrypt' : 'sha256'}`);

    if (isBcryptHash) {
      try {
        passwordValid = await bcrypt.compare(password, user.passwordHash);
      } catch (bcryptErr) {
        console.error(`[Auth:Login] bcrypt.compare THREW for email="${email}":`, bcryptErr);
        return reply.code(500).send({ error: 'Internal server error during authentication' });
      }
    } else {
      // Legacy SHA-256 comparison
      const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
      passwordValid = user.passwordHash === sha256Hash;

      // Auto-migrate to bcrypt on successful legacy login
      if (passwordValid) {
        try {
          const bcryptHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
          await prisma.user.update({ where: { id: user.id }, data: { passwordHash: bcryptHash } });
          console.log(`[Auth:Login] Auto-migrated ${email} from SHA-256 to bcrypt`);
        } catch (migrationErr) {
          console.error(`[Auth:Login] Failed to auto-migrate ${email} to bcrypt:`, migrationErr);
        }
      } else {
        // Run a dummy bcrypt compare to equalize response time with the bcrypt
        // and "user not found" paths, preventing timing-based user enumeration.
        await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      }
    }

    // Auth result logged only to security event log (not stdout) to avoid auth oracle leak
    // PM2 logs above already show hash type + lookup result for debugging

    if (!passwordValid) {
      void logSecurityEvent('LOGIN_FAILED', undefined, request.ip, `Failed login for ${email} — password mismatch`);
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    // MFA challenge required
    if (user.mfaEnabled) {
      const { createMfaSessionToken } = await import('./identityService.js');
      void logSecurityEvent('MFA_CHALLENGE_REQUIRED', user.id, request.ip);
      return {
        mfaRequired: true,
        mfaSessionToken: createMfaSessionToken(user.id),
        message: 'MFA verification required',
      };
    }

    const device = {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
      deviceLabel: (await import('./identityService.js')).parseDeviceLabel(request.headers['user-agent']),
    };
    const tokenPayload = { userId: user.id, tenantId: user.tenantId, email: user.email, role: user.role as UserRole };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = await generateRefreshToken(tokenPayload, device);

    void logSecurityEvent('LOGIN_SUCCESS', user.id, request.ip, `Login for ${email}`);

    // Get subscription info from DB
    const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });

    // Set refresh token as httpOnly cookie
    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: REFRESH_TOKEN_EXPIRY_SECONDS,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      user: {
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionStatus: mapSubscriptionStatusForClient(sub?.subscriptionStatus ?? 'none'),
        subscriptionTier: sub?.subscriptionTier ?? 'free',
        emailVerified: Boolean(user.emailVerifiedAt),
        mfaEnabled: user.mfaEnabled,
      },
    };
  });

  // POST /api/auth/register
  app.post('/api/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name?: string;
      email: string;
      password: string;
      role?: UserRole;
      defaultRole?: string;
      termsAccepted?: boolean;
      privacyAccepted?: boolean;
    };

    if (!body?.email || !body?.password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }
    if (!body.termsAccepted || !body.privacyAccepted) {
      return reply.code(400).send({ error: 'You must accept the Terms of Service and Privacy Policy' });
    }

    // Normalize email: trim whitespace + lowercase
    const email = body.email.trim().toLowerCase();
    const password = body.password;
    const name = body.name;

    // Check for existing user — also check case-insensitive to prevent duplicates
    // with legacy mixed-case emails (e.g. Admin@Company.com vs admin@company.com)
    let existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      try {
        existing = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });
      } catch {
        // mode:'insensitive' may not be supported — ignore
      }
    }
    if (existing) {
      return reply.code(409).send({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const defaultRoleInput = body.defaultRole ?? body.role ?? 'other';
    const onboarding = validateDefaultRole(defaultRoleInput)
      ? resolveRoleOnboarding(defaultRoleInput)
      : resolveRoleOnboarding('other');
    const userRole = onboarding.platformRole as UserRole;
    const userName = name || email.split('@')[0];
    const tenantId = `tenant-${crypto.randomUUID()}`;
    const memberOrgRole =
      userRole === 'defendant' || userRole === 'staff' ? 'staff' : userRole === 'admin' ? 'admin' : userRole;

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Atomic transaction: create user + trial subscription + org
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name: userName,
          passwordHash,
          role: userRole,
          defaultRole: onboarding.defaultRole,
          tenantId,
          termsAcceptedAt: now,
          privacyAcceptedAt: now,
        },
      });

      let clientId: string | null = null;
      if (onboarding.defaultRole === 'criminal_defendant' || onboarding.defaultRole === 'self_represented_litigant') {
        const client = await tx.client.create({
          data: {
            tenantId,
            ownerId: created.id,
            firstName: userName.split(' ')[0] ?? userName,
            lastName: userName.split(' ').slice(1).join(' ') || 'Defendant',
            email,
            status: 'active',
          },
        });
        clientId = client.clientId;
        await tx.user.update({
          where: { id: created.id },
          data: { clientId: client.clientId },
        });
      }

      await tx.subscription.create({
        data: {
          userId: created.id,
          planId: 'TRIAL',
          activatedAt: now,
          billingPeriodStart: now,
          billingPeriodEnd: trialEnd,
          subscriptionStatus: 'trialing',
          subscriptionTier: 'trial',
          trialEndsAt: trialEnd,
          billingInterval: 'month',
        },
      });

      await tx.aiCreditBalance.create({
        data: {
          userId: created.id,
          monthlyCredits: 50,
          purchasedCredits: 0,
          creditsUsed: 0,
          billingPeriodStart: now,
          billingPeriodEnd: trialEnd,
        },
      });

      await tx.userAccountSettings.create({
        data: { userId: created.id },
      });

      await tx.organization.create({
        data: {
          id: tenantId,
          name: `${userName}'s Organization`,
          orgType: onboarding.orgType,
          onboardingStep: 'created',
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: tenantId,
          userId: created.id,
          role: memberOrgRole,
          personnelType: onboarding.personnelType,
          status: 'active',
        },
      });

      return { ...created, clientId };
    });

    const { createEmailVerificationToken, sendVerificationEmail } = await import('./identityService.js');
    const verifyToken = await createEmailVerificationToken(user.id);
    await sendVerificationEmail(email, verifyToken, request.ip);

    const device = {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
      deviceLabel: (await import('./identityService.js')).parseDeviceLabel(request.headers['user-agent']),
    };
    const tokenPayload = { userId: user.id, tenantId, email, role: userRole };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = await generateRefreshToken(tokenPayload, device);

    void logSecurityEvent('USER_REGISTERED', user.id, request.ip, `Registered ${email} as ${userRole}`);

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      user: {
        userId: user.id,
        tenantId,
        email,
        name: userName,
        role: userRole,
        defaultRole: onboarding.defaultRole,
        subscriptionStatus: mapSubscriptionStatusForClient('trialing'),
        subscriptionTier: 'trial',
        emailVerified: false,
        mfaEnabled: false,
      },
      onboarding: {
        defaultRole: onboarding.defaultRole,
        label: onboarding.label,
        postRegistrationRoute: onboarding.postRegistrationRoute,
        defaultDashboard: onboarding.defaultDashboard,
        onboardingSteps: onboarding.onboardingSteps,
        recommendedWorkflows: onboarding.recommendedWorkflows,
        navigationHighlights: onboarding.navigationHighlights,
      },
      message: 'Registration successful. Please verify your email.',
    };
  });

  // POST /api/auth/refresh — duplicate block removed below
  app.post('/api/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken: bodyToken } = (request.body || {}) as { refreshToken?: string };
    const cookieToken = (request.cookies as Record<string, string>)?.refreshToken;
    const token = bodyToken || cookieToken;

    if (!token) {
      return reply.code(400).send({ error: 'Refresh token is required' });
    }

    try {
      const payload = await verifyRefreshToken(token);
      await revokeRefreshToken(token); // Rotate: revoke old token

      const newPayload = { userId: payload.userId, tenantId: payload.tenantId, email: payload.email, role: payload.role };
      const newAccessToken = generateAccessToken(newPayload);
      const newRefreshToken = await generateRefreshToken(newPayload);

      void logSecurityEvent('TOKEN_REFRESHED', payload.userId, request.ip, 'Token rotated');

      reply.setCookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth/refresh',
        maxAge: REFRESH_TOKEN_EXPIRY_SECONDS,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid refresh token';
      void logSecurityEvent('TOKEN_REFRESH_FAILED', undefined, request.ip, errorMessage);
      return reply.code(401).send({ error: 'Invalid or expired refresh token' });
    }
  });

  // POST /api/auth/logout
  app.post('/api/auth/logout', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { refreshToken: bodyToken } = (request.body || {}) as { refreshToken?: string };
    const cookieToken = (request.cookies as Record<string, string>)?.refreshToken;
    const token = bodyToken || cookieToken;

    if (token) {
      await revokeRefreshToken(token);
    }

    // Revoke all tokens if user is authenticated
    const accessToken = extractBearerToken(request.headers.authorization);
    if (accessToken) {
      try {
        const payload = verifyAccessToken(accessToken);
        await revokeAllUserTokens(payload.userId);
        void logSecurityEvent('LOGOUT', payload.userId, request.ip, 'All tokens revoked');
      } catch {
        // Token may already be expired, still clear cookies
      }
    }

    reply.clearCookie('refreshToken', { path: '/api/auth/refresh' });

    return { message: 'Logged out successfully' };
  });

  // GET /api/auth/me — current user info
  app.get('/api/auth/me', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    try {
      const payload = verifyAccessToken(token);
      const sub = await prisma.subscription.findUnique({ where: { userId: payload.userId } });
      return {
        user: {
          userId: payload.userId,
          tenantId: payload.tenantId,
          email: payload.email,
          role: payload.role,
          subscriptionStatus: mapSubscriptionStatusForClient(sub?.subscriptionStatus ?? 'none'),
          subscriptionTier: sub?.subscriptionTier ?? 'free',
        },
      };
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }
  });

  // POST /api/auth/forgot-password — request a password reset email (public)
  app.post('/api/auth/forgot-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { email?: string };

    if (!body?.email) {
      return reply.code(400).send({ error: 'Email is required' });
    }

    const email = body.email.trim().toLowerCase();

    // Always return success to prevent user enumeration
    const successResponse = {
      message: 'If an account with that email exists, a password reset link has been sent.',
    };

    let user;
    try {
      user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });
      }
    } catch {
      // DB error — still return success to prevent enumeration
    }

    if (!user) {
      // Wait to equalize response time, preventing timing-based enumeration
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
      return successResponse;
    }

    // Wrap all DB/email operations in try/catch to prevent user enumeration via 500 errors
    try {
      // Invalidate any existing reset tokens for this user
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      // Generate a secure random token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      // Build the reset URL
      const frontendUrl = process.env.FRONTEND_URL || 'https://courtaccess.net';
      const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

      // Attempt to send email via SES; fall back to console log if not configured
      try {
        const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
        const ses = new SESClient({
          region: process.env.AWS_REGION ?? 'us-west-2',
          credentials: process.env.AWS_ACCESS_KEY_ID
            ? {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
              }
            : undefined,
        });

        const senderEmail = process.env.PASSWORD_RESET_FROM_EMAIL || process.env.CPRA_SENDER_EMAIL || 'noreply@courtaccess.net';

        await ses.send(new SendEmailCommand({
          Source: senderEmail,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: 'Court Access — Password Reset', Charset: 'UTF-8' },
            Body: {
              Html: {
                Data: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1e293b;">Reset your password</h2>
                    <p>You requested a password reset for your Court Access account.</p>
                    <p>Click the button below to set a new password. This link expires in 1 hour.</p>
                    <a href="${resetUrl}" style="display: inline-block; background: #1e293b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">Reset Password</a>
                    <p style="color: #64748b; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                    <p style="color: #94a3b8; font-size: 12px;">Court Access — Legal Intelligence Platform</p>
                  </div>
                `,
                Charset: 'UTF-8',
              },
            },
          },
        }));

        console.log(`[Auth:ForgotPassword] Reset email sent to ${email}`);
      } catch (_sesError) {
        // SES not configured — log info but only expose raw token in development
        console.log(`[Auth:ForgotPassword] SES not available for ${email}`);
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Auth:ForgotPassword] RESET URL: ${resetUrl}`);
        }
      }

      void logSecurityEvent('PASSWORD_RESET_REQUESTED', user.id, request.ip, `Password reset requested for ${email}`);
    } catch (dbError) {
      // DB or other error — log but always return success to prevent enumeration
      console.error('[Auth:ForgotPassword] Error processing reset request:', dbError);
    }

    return successResponse;
  });

  // POST /api/auth/reset-password — set new password using a reset token (public)
  app.post('/api/auth/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { token?: string; newPassword?: string };

    if (!body?.token || !body?.newPassword) {
      return reply.code(400).send({ error: 'Token and new password are required' });
    }

    if (body.newPassword.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(body.token).digest('hex');

    // Hash password before transaction (pure computation, no DB needed)
    const newHash = await bcrypt.hash(body.newPassword, BCRYPT_SALT_ROUNDS);

    // Use Prisma transaction for atomic token consumption + password update
    const result = await prisma.$transaction(async (tx) => {
      // Atomically claim the token: update usedAt WHERE usedAt IS NULL
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (claimed.count === 0) {
        return null; // Token already used or expired
      }

      // Fetch the token record to get userId and user email
      const resetRecord = await tx.passwordResetToken.findFirst({
        where: { tokenHash },
        include: { user: true },
      });

      if (!resetRecord) {
        return null;
      }

      // Update the password
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newHash },
      });

      // Revoke all existing sessions so user must re-login
      await tx.refreshToken.deleteMany({
        where: { userId: resetRecord.userId },
      });

      return resetRecord;
    });

    if (!result) {
      void logSecurityEvent('PASSWORD_RESET_FAILED', undefined, request.ip, 'Invalid or expired reset token');
      return reply.code(400).send({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    void logSecurityEvent('PASSWORD_RESET', result.userId, request.ip, `Password reset via email link for ${result.user.email}`);

    return { message: 'Password reset successfully. Please sign in with your new password.' };
  });

  // POST /api/admin/reset-password — reset any user's password (admin only)
  app.post('/api/admin/reset-password', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    try {
      const payload = verifyAccessToken(token);
      if (payload.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }

    const body = request.body as { email: string; newPassword: string };

    if (!body?.email || !body?.newPassword) {
      return reply.code(400).send({ error: 'Email and newPassword are required' });
    }

    // Normalize email
    const email = body.email.trim().toLowerCase();
    const newPassword = body.newPassword;

    if (newPassword.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });
    }

    // Check case-insensitive to find legacy mixed-case emails
    let targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      try {
        targetUser = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });
      } catch {
        // mode:'insensitive' may not be supported — ignore
      }
    }
    if (!targetUser) {
      return reply.code(404).send({ error: `No user found with email: ${email}` });
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await prisma.user.update({ where: { id: targetUser.id }, data: { passwordHash: newHash } });

    // Revoke all existing tokens so the user must re-login with the new password
    await revokeAllUserTokens(targetUser.id);

    void logSecurityEvent('PASSWORD_RESET', targetUser.id, request.ip, `Admin ${(request as AuthenticatedRequest).user?.userId} reset password for ${email}`);

    return { message: `Password reset successfully for ${email}` };
  });

  // GET /api/security/log — security event log (admin only)
  app.get('/api/security/log', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      return reply.code(401).send({ error: 'Authentication required' });
    }
    try {
      const payload = verifyAccessToken(token);
      if (payload.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }
      const limit = parseInt((request.query as Record<string, string>).limit || '100', 10);
      const events = await getSecurityLog(limit);
      const total = await prisma.securityLog.count();
      return { events, total };
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }
  });
}

// ---------------------------------------------------------------------------
// Exported configuration for reports
// ---------------------------------------------------------------------------

export const AUTH_CONFIG = {
  accessTokenExpiry: ACCESS_TOKEN_EXPIRY,
  refreshTokenExpiry: REFRESH_TOKEN_EXPIRY,
  accessTokenExpirySeconds: ACCESS_TOKEN_EXPIRY_SECONDS,
  refreshTokenExpirySeconds: REFRESH_TOKEN_EXPIRY_SECONDS,
  roles: ['admin', 'attorney', 'investigator', 'staff', 'defendant'] as UserRole[],
  roleHierarchy: ROLE_HIERARCHY,
  routePermissions: ROUTE_PERMISSIONS,
  publicRoutes: PUBLIC_ROUTES,
};
