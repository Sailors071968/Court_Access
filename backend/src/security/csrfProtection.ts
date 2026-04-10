// ============================================================================
// Phase 193 — CSRF Protection
// Same-site cookies, CSRF tokens, origin validation
// ============================================================================

import crypto from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CsrfTokenRecord {
  token: string;
  createdAt: number;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CSRF_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_COOKIE_NAME = '_csrf';

// Allowed origins for CORS/origin validation
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://courtaccess.net',
  process.env.FRONTEND_URL || '',
  process.env.BACKEND_URL || '',
].filter(Boolean));

// Methods that require CSRF validation (state-changing)
const CSRF_PROTECTED_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

// Routes exempt from CSRF (API-only, no browser session)
const CSRF_EXEMPT_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/debug-check',
  '/api/health',
  '/api/billing/webhook',
];

// ---------------------------------------------------------------------------
// Token store (in-memory; production: tie to session store)
// ---------------------------------------------------------------------------

const csrfTokenStore = new Map<string, CsrfTokenRecord>();

// Cleanup expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of csrfTokenStore) {
    if (record.expiresAt <= now) {
      csrfTokenStore.delete(key);
    }
  }
}, 5 * 60_000);

// ---------------------------------------------------------------------------
// CSRF Token Generation & Validation
// ---------------------------------------------------------------------------

export function generateCsrfToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokenStore.set(sessionId, {
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + CSRF_TOKEN_EXPIRY_MS,
  });
  return token;
}

export function validateCsrfToken(sessionId: string, token: string): boolean {
  const record = csrfTokenStore.get(sessionId);
  if (!record) return false;
  if (record.expiresAt <= Date.now()) {
    csrfTokenStore.delete(sessionId);
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(record.token, 'hex'),
    Buffer.from(token, 'hex'),
  );
}

// ---------------------------------------------------------------------------
// Origin Validation
// ---------------------------------------------------------------------------

export function validateOrigin(origin: string | undefined, referer: string | undefined): boolean {
  // If no origin/referer, might be same-origin or non-browser client
  if (!origin && !referer) return true;

  if (origin) {
    // Check against allowed origins
    if (ALLOWED_ORIGINS.has(origin)) return true;
    // Check for production domain match
    const url = new URL(origin);
    if (url.protocol === 'https:' && (url.hostname === 'courtaccess.net' || url.hostname.endsWith('.courtaccess.net') || url.hostname.endsWith('.courtaccess.com'))) return true;
    return false;
  }

  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      return ALLOWED_ORIGINS.has(refererOrigin);
    } catch {
      return false;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// CSRF Protection Hook
// ---------------------------------------------------------------------------

function isCsrfExempt(path: string): boolean {
  return CSRF_EXEMPT_ROUTES.some(route => path === route || path.startsWith(route + '/'));
}

export async function csrfProtectionHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const path = request.url.split('?')[0];

  // Only protect state-changing methods
  if (!CSRF_PROTECTED_METHODS.has(request.method)) {
    return;
  }

  // Skip for non-API routes
  if (!path.startsWith('/api/')) {
    return;
  }

  // Skip exempt routes
  if (isCsrfExempt(path)) {
    return;
  }

  // Step 1: Bearer token bypass — CSRF is not needed for Bearer-authenticated
  // requests because the token is not automatically sent by the browser.
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return;
  }

  // Step 2: Origin validation
  const origin = request.headers.origin;
  const referer = request.headers.referer;

  if (!validateOrigin(origin, referer)) {
    reply.code(403).send({
      error: 'CSRF validation failed',
      message: 'Request origin is not allowed',
    });
    return;
  }

  // Step 3: CSRF token validation (for cookie-based sessions)

  // For cookie-based sessions, validate CSRF token
  const csrfToken = request.headers[CSRF_HEADER_NAME] as string | undefined;
  const cookies = request.cookies as Record<string, string> | undefined;
  const sessionId = cookies?._session;

  if (sessionId && csrfToken) {
    if (!validateCsrfToken(sessionId, csrfToken)) {
      reply.code(403).send({
        error: 'CSRF validation failed',
        message: 'Invalid or expired CSRF token',
      });
      return;
    }
  }
  // If no session cookie, this is likely an API-only request (no CSRF needed)
}

// ---------------------------------------------------------------------------
// CSRF Token Endpoint
// ---------------------------------------------------------------------------

export function getCsrfTokenRoute() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const cookies = request.cookies as Record<string, string> | undefined;
    let sessionId = cookies?._session;

    if (!sessionId) {
      sessionId = crypto.randomUUID();
      reply.setCookie('_session', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 24 * 60 * 60, // 24 hours
      });
    }

    const token = generateCsrfToken(sessionId);

    reply.setCookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // JS needs to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: CSRF_TOKEN_EXPIRY_MS / 1000,
    });

    return { csrfToken: token };
  };
}

// ---------------------------------------------------------------------------
// Cookie configuration for same-site protection
// ---------------------------------------------------------------------------

export const COOKIE_CONFIG = {
  sessionCookie: {
    name: '_session',
    httpOnly: true,
    secure: 'production-only',
    sameSite: 'strict',
    path: '/',
    maxAge: '24 hours',
  },
  csrfCookie: {
    name: '_csrf',
    httpOnly: false,
    secure: 'production-only',
    sameSite: 'strict',
    path: '/',
    maxAge: '1 hour',
  },
  refreshTokenCookie: {
    name: 'refreshToken',
    httpOnly: true,
    secure: 'production-only',
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: '7 days',
  },
};

// ---------------------------------------------------------------------------
// Exported configuration for reports
// ---------------------------------------------------------------------------

export const CSRF_CONFIG = {
  tokenExpiry: CSRF_TOKEN_EXPIRY_MS,
  headerName: CSRF_HEADER_NAME,
  cookieName: CSRF_COOKIE_NAME,
  protectedMethods: [...CSRF_PROTECTED_METHODS],
  exemptRoutes: CSRF_EXEMPT_ROUTES,
  allowedOrigins: [...ALLOWED_ORIGINS],
  cookieSettings: COOKIE_CONFIG,
};
