// ============================================================================
// Phase 191 — Authentication Middleware
// JWT authentication, refresh tokens, session expiration, role-based access control
// Roles: admin, attorney, investigator, staff, defendant
// ============================================================================

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

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

// In-memory refresh token store (production: use Redis or database)
const refreshTokenStore = new Map<string, RefreshTokenRecord>();

// Security event log (in-memory, production: use structured logging)
const securityLog: Array<{
  timestamp: string;
  event: string;
  userId?: string;
  ip?: string;
  details?: string;
}> = [];

// ---------------------------------------------------------------------------
// Token Generation
// ---------------------------------------------------------------------------

export function generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const token = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  const record: RefreshTokenRecord = {
    token,
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000),
    createdAt: new Date(),
    revoked: false,
  };
  refreshTokenStore.set(token, record);

  return token;
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  const payload = jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
  const record = refreshTokenStore.get(token);
  if (!record || record.revoked) {
    throw new Error('Refresh token has been revoked');
  }
  return payload;
}

export function revokeRefreshToken(token: string): boolean {
  const record = refreshTokenStore.get(token);
  if (record) {
    record.revoked = true;
    return true;
  }
  return false;
}

export function revokeAllUserTokens(userId: string): number {
  let count = 0;
  for (const [, record] of refreshTokenStore) {
    if (record.userId === userId && !record.revoked) {
      record.revoked = true;
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Security Event Logging
// ---------------------------------------------------------------------------

export function logSecurityEvent(event: string, userId?: string, ip?: string, details?: string): void {
  securityLog.push({
    timestamp: new Date().toISOString(),
    event,
    userId,
    ip,
    details,
  });
  // Keep last 10000 events in memory
  if (securityLog.length > 10000) {
    securityLog.splice(0, securityLog.length - 10000);
  }
}

export function getSecurityLog(): typeof securityLog {
  return [...securityLog];
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
  '/api/policy-intelligence': ['admin', 'attorney', 'staff'],
  '/api/policy-pipeline': ['admin', 'staff'],
  '/api/operations': ['admin', 'staff'],
  '/api/exhibits': ['admin', 'attorney'],
  '/api/cpra': ['admin', 'staff'],
  '/api/crawler': ['admin'],
  '/api/forensic': ['admin', 'attorney', 'investigator'],
  '/api/forensic/expert-package': ['admin', 'attorney'],
  '/api/forensic/jury-view': ['admin', 'attorney'],
  '/api/admin/discount-codes': ['admin', 'staff'],
  '/api/admin': ['admin'],
  '/api/security': ['admin'],
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
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/discount-codes/validate',
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
    logSecurityEvent('UNAUTHORIZED_ACCESS', undefined, request.ip, `No token provided for ${path}`);
    reply.code(401).send({
      error: 'Authentication required',
      message: 'Please provide a valid Bearer token in the Authorization header',
    });
    return;
  }

  // Verify token
  try {
    const payload = verifyAccessToken(token);
    request.user = payload;

    // Check role-based permissions
    const requiredRoles = getRequiredRoles(path);
    if (requiredRoles && !hasPermission(payload.role, requiredRoles)) {
      logSecurityEvent(
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

    logSecurityEvent('AUTHENTICATED_ACCESS', payload.userId, request.ip, path);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Invalid token';
    logSecurityEvent('INVALID_TOKEN', undefined, request.ip, `${errorMessage} for ${path}`);
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

// User store (in-memory; production should use database)
const userStore = new Map<string, { userId: string; tenantId: string; email: string; name: string; passwordHash: string; role: UserRole }>();

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/auth/login
  app.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      logSecurityEvent('LOGIN_FAILED', undefined, request.ip, 'Missing email or password');
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    const user = userStore.get(email);
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    if (!user || user.passwordHash !== passwordHash) {
      logSecurityEvent('LOGIN_FAILED', undefined, request.ip, `Failed login for ${email}`);
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const tokenPayload = { userId: user.userId, tenantId: user.tenantId, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    logSecurityEvent('LOGIN_SUCCESS', user.userId, request.ip, `Login for ${email}`);

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
      user: { userId: user.userId, tenantId: user.tenantId, email: user.email, name: user.name, role: user.role },
    };
  });

  // POST /api/auth/register
  app.post('/api/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, email, password, role } = request.body as { name?: string; email: string; password: string; role?: UserRole };

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    if (userStore.has(email)) {
      return reply.code(409).send({ error: 'User already exists' });
    }

    const userId = `user-${crypto.randomUUID()}`;
    const tenantId = `tenant-${crypto.randomUUID()}`;
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    const userRole = role || 'staff';
    const userName = name || email.split('@')[0];

    userStore.set(email, { userId, tenantId, email, name: userName, passwordHash, role: userRole });

    const tokenPayload = { userId, tenantId, email, role: userRole };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    logSecurityEvent('USER_REGISTERED', userId, request.ip, `Registered ${email} as ${userRole}`);

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      user: { userId, tenantId, email, name: userName, role: userRole },
    };
  });

  // POST /api/auth/refresh
  app.post('/api/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken: bodyToken } = (request.body || {}) as { refreshToken?: string };
    const cookieToken = (request.cookies as Record<string, string>)?.refreshToken;
    const token = bodyToken || cookieToken;

    if (!token) {
      return reply.code(400).send({ error: 'Refresh token is required' });
    }

    try {
      const payload = verifyRefreshToken(token);
      revokeRefreshToken(token); // Rotate: revoke old token

      const newPayload = { userId: payload.userId, tenantId: payload.tenantId, email: payload.email, role: payload.role };
      const newAccessToken = generateAccessToken(newPayload);
      const newRefreshToken = generateRefreshToken(newPayload);

      logSecurityEvent('TOKEN_REFRESHED', payload.userId, request.ip, 'Token rotated');

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
      logSecurityEvent('TOKEN_REFRESH_FAILED', undefined, request.ip, errorMessage);
      return reply.code(401).send({ error: 'Invalid or expired refresh token' });
    }
  });

  // POST /api/auth/logout
  app.post('/api/auth/logout', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { refreshToken: bodyToken } = (request.body || {}) as { refreshToken?: string };
    const cookieToken = (request.cookies as Record<string, string>)?.refreshToken;
    const token = bodyToken || cookieToken;

    if (token) {
      revokeRefreshToken(token);
    }

    // Revoke all tokens if user is authenticated
    const accessToken = extractBearerToken(request.headers.authorization);
    if (accessToken) {
      try {
        const payload = verifyAccessToken(accessToken);
        revokeAllUserTokens(payload.userId);
        logSecurityEvent('LOGOUT', payload.userId, request.ip, 'All tokens revoked');
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
      return { user: { userId: payload.userId, tenantId: payload.tenantId, email: payload.email, role: payload.role } };
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }
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
      const events = getSecurityLog().slice(-limit);
      return { events, total: getSecurityLog().length };
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
