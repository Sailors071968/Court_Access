// ============================================================================
// Program 1 — Identity Routes
// Email verification, MFA, device/session management
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import {
  buildOtpAuthUri,
  createEmailVerificationToken,
  createMfaSessionToken,
  decryptMfaSecret,
  encryptMfaSecret,
  extractDeviceContext,
  generateMfaSecret,
  listUserSessions,
  revokeUserSession,
  sendVerificationEmail,
  verifyEmailToken,
  verifyMfaSessionToken,
  verifyTotpCode,
} from './identityService.js';
import {
  type AuthenticatedRequest,
  extractBearerToken,
  generateAccessToken,
  generateRefreshToken,
  logSecurityEvent,
  verifyAccessToken,
  type UserRole,
} from './authMiddleware.js';

// Re-export for authMiddleware integration
export { extractDeviceContext, createMfaSessionToken, sendVerificationEmail, createEmailVerificationToken };

const REFRESH_TOKEN_EXPIRY_SECONDS_EXPORT = 7 * 24 * 60 * 60;

export async function registerIdentityRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/auth/verify-email
  app.post('/api/auth/verify-email', async (request, reply: FastifyReply) => {
    const body = request.body as { token?: string };
    if (!body?.token) return reply.code(400).send({ error: 'Verification token is required' });

    const result = await verifyEmailToken(body.token);
    if (!result) return reply.code(400).send({ error: 'Invalid or expired verification token' });

    void logSecurityEvent('EMAIL_VERIFIED', result.userId, request.ip, result.email);
    return { message: 'Email verified successfully', email: result.email };
  });

  // POST /api/auth/resend-verification
  app.post('/api/auth/resend-verification', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: 'Authentication required' });

    let userId: string;
    try {
      userId = verifyAccessToken(token).userId;
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.emailVerifiedAt) return { message: 'Email already verified' };

    const rawToken = await createEmailVerificationToken(userId);
    await sendVerificationEmail(user.email, rawToken, request.ip);
    return { message: 'Verification email sent' };
  });

  // POST /api/auth/mfa/setup — generate TOTP secret (requires auth)
  app.post('/api/auth/mfa/setup', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: 'Authentication required' });

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }

    const secret = generateMfaSecret();
    await prisma.user.update({
      where: { id: payload.userId },
      data: { mfaSecretEncrypted: encryptMfaSecret(secret), mfaEnabled: false },
    });

    return {
      secret,
      otpauthUri: buildOtpAuthUri(payload.email, secret),
      message: 'Scan the URI in an authenticator app, then confirm with POST /api/auth/mfa/confirm',
    };
  });

  // POST /api/auth/mfa/confirm — enable MFA after verifying code
  app.post('/api/auth/mfa/confirm', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const token = extractBearerToken(request.headers.authorization);
    const body = request.body as { code?: string };
    if (!token) return reply.code(401).send({ error: 'Authentication required' });
    if (!body?.code) return reply.code(400).send({ error: 'TOTP code is required' });

    let userId: string;
    try {
      userId = verifyAccessToken(token).userId;
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecretEncrypted) return reply.code(400).send({ error: 'MFA setup not initiated' });

    const secret = decryptMfaSecret(user.mfaSecretEncrypted);
    if (!verifyTotpCode(secret, body.code)) {
      return reply.code(400).send({ error: 'Invalid verification code' });
    }

    await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    void logSecurityEvent('MFA_ENABLED', userId, request.ip);
    return { message: 'MFA enabled successfully' };
  });

  // POST /api/auth/mfa/challenge — complete login after password + MFA
  app.post('/api/auth/mfa/challenge', async (request, reply: FastifyReply) => {
    const body = request.body as { mfaSessionToken?: string; code?: string };
    if (!body?.mfaSessionToken || !body?.code) {
      return reply.code(400).send({ error: 'MFA session token and code are required' });
    }

    let userId: string;
    try {
      userId = verifyMfaSessionToken(body.mfaSessionToken).userId;
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired MFA session' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecretEncrypted) {
      return reply.code(400).send({ error: 'MFA not enabled for this account' });
    }

    const secret = decryptMfaSecret(user.mfaSecretEncrypted);
    if (!verifyTotpCode(secret, body.code)) {
      void logSecurityEvent('MFA_CHALLENGE_FAILED', userId, request.ip);
      return reply.code(401).send({ error: 'Invalid MFA code' });
    }

    const tokenPayload = { userId: user.id, tenantId: user.tenantId, email: user.email, role: user.role as UserRole };
    const device = extractDeviceContext(request);
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = await generateRefreshToken(tokenPayload);
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { userAgent: device.userAgent, ipAddress: device.ipAddress, deviceLabel: device.deviceLabel, lastSeenAt: new Date() },
    });

    const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
    void logSecurityEvent('MFA_CHALLENGE_SUCCESS', userId, request.ip);

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: REFRESH_TOKEN_EXPIRY_SECONDS_EXPORT,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
      user: {
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: Boolean(user.emailVerifiedAt),
        subscriptionStatus: sub?.subscriptionStatus ?? 'none',
        subscriptionTier: sub?.subscriptionTier ?? 'free',
      },
    };
  });

  // POST /api/auth/mfa/disable
  app.post('/api/auth/mfa/disable', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const token = extractBearerToken(request.headers.authorization);
    const body = request.body as { code?: string };
    if (!token) return reply.code(401).send({ error: 'Authentication required' });
    if (!body?.code) return reply.code(400).send({ error: 'TOTP code is required' });

    let userId: string;
    try {
      userId = verifyAccessToken(token).userId;
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecretEncrypted) {
      return reply.code(400).send({ error: 'MFA is not enabled' });
    }

    const secret = decryptMfaSecret(user.mfaSecretEncrypted);
    if (!verifyTotpCode(secret, body.code)) {
      return reply.code(400).send({ error: 'Invalid verification code' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecretEncrypted: null },
    });
    void logSecurityEvent('MFA_DISABLED', userId, request.ip);
    return { message: 'MFA disabled' };
  });

  // GET /api/auth/sessions
  app.get('/api/auth/sessions', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: 'Authentication required' });

    let userId: string;
    try {
      userId = verifyAccessToken(token).userId;
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }

    const sessions = await listUserSessions(userId);
    return { sessions };
  });

  // DELETE /api/auth/sessions/:sessionId
  app.delete('/api/auth/sessions/:sessionId', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: 'Authentication required' });

    let userId: string;
    try {
      userId = verifyAccessToken(token).userId;
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }

    const { sessionId } = request.params as { sessionId: string };
    const revoked = await revokeUserSession(userId, sessionId);
    if (!revoked) return reply.code(404).send({ error: 'Session not found' });

    void logSecurityEvent('SESSION_REVOKED', userId, request.ip, sessionId);
    return { message: 'Session revoked' };
  });
}
