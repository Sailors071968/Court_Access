// ============================================================================
// Phase 192 — Rate Limiting
// Prevent abuse and protect infrastructure.
// Limits: 100 req/min general, 10 uploads/min, 5 compliance analyses/min
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from './authMiddleware.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
  keyGenerator: (request: FastifyRequest) => string;
}

// ---------------------------------------------------------------------------
// In-memory rate limit store
// ---------------------------------------------------------------------------

const rateLimitStores: Map<string, Map<string, RateLimitEntry>> = new Map();

function getOrCreateStore(storeName: string): Map<string, RateLimitEntry> {
  let store = rateLimitStores.get(storeName);
  if (!store) {
    store = new Map();
    rateLimitStores.set(storeName, store);
  }
  return store;
}

// Cleanup expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [, store] of rateLimitStores) {
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }
}, 60_000);

// ---------------------------------------------------------------------------
// Rate limit checker
// ---------------------------------------------------------------------------

function checkRateLimit(storeName: string, key: string, config: RateLimitConfig): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
} {
  const store = getOrCreateStore(storeName);
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + config.windowMs };
    store.set(key, entry);
  }

  entry.count++;

  return {
    allowed: entry.count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
    limit: config.maxRequests,
  };
}

/**
 * Peek at a rate limit without incrementing the counter.
 * Used to check daily limits before committing to increment.
 */
function peekRateLimit(storeName: string, key: string, config: RateLimitConfig): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
} {
  const store = getOrCreateStore(storeName);
  const now = Date.now();

  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    // No entry or expired — would be allowed
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: now + config.windowMs,
      limit: config.maxRequests,
    };
  }

  // Check without incrementing
  const nextCount = entry.count + 1;
  return {
    allowed: nextCount <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
    limit: config.maxRequests,
  };
}

// ---------------------------------------------------------------------------
// Default key generator (IP + userId if available)
// ---------------------------------------------------------------------------

function defaultKeyGenerator(request: FastifyRequest): string {
  const userId = resolveUserId(request);
  if (userId) {
    return `user:${userId}`;
  }
  return `ip:${request.ip}`;
}

/**
 * Identify the caller for rate-limit bucketing.
 *
 * This hook runs on `onRequest`, which is before any authentication has had a
 * chance to populate `request.user`, so the bearer token has to be read here
 * directly. Without this every authenticated request falls back to the source
 * IP, which means a firm behind one office NAT address shares a single bucket.
 */
function resolveUserId(request: FastifyRequest): string | null {
  const preset = (request as unknown as Record<string, unknown>).user as { userId?: string } | undefined;
  if (preset?.userId) return preset.userId;

  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const payload = verifyAccessToken(header.slice(7).trim());
    return payload.userId ?? null;
  } catch {
    // Invalid/expired tokens fall back to IP bucketing so that a stream of bad
    // tokens cannot be used to bypass the limit.
    return null;
  }
}

/** Reads a positive integer from the environment, falling back to `fallback`. */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// ---------------------------------------------------------------------------
// Rate limit configurations
// ---------------------------------------------------------------------------

const GENERAL_MAX = envInt('RATE_LIMIT_GENERAL_PER_MINUTE', 100);
const UPLOAD_MAX = envInt('RATE_LIMIT_UPLOAD_PER_MINUTE', 10);
const COMPLIANCE_MAX = envInt('RATE_LIMIT_COMPLIANCE_PER_MINUTE', 5);
const LOGIN_MAX = envInt('RATE_LIMIT_LOGIN_PER_MINUTE', 5);
const REGISTER_MAX = envInt('RATE_LIMIT_REGISTER_PER_MINUTE', 3);

const RATE_LIMIT_CONFIGS = {
  // General API: 100 requests per minute
  general: {
    windowMs: 60_000,
    maxRequests: GENERAL_MAX,
    message: 'Too many requests. Please try again in a moment.',
    keyGenerator: defaultKeyGenerator,
  } satisfies RateLimitConfig,

  // File uploads: 10 per minute
  upload: {
    windowMs: 60_000,
    maxRequests: UPLOAD_MAX,
    message: `Upload rate limit exceeded. Maximum ${UPLOAD_MAX} uploads per minute.`,
    keyGenerator: defaultKeyGenerator,
  } satisfies RateLimitConfig,

  // Compliance analyses: 5 per minute
  compliance: {
    windowMs: 60_000,
    maxRequests: COMPLIANCE_MAX,
    message: `Compliance analysis rate limit exceeded. Maximum ${COMPLIANCE_MAX} analyses per minute.`,
    keyGenerator: defaultKeyGenerator,
  } satisfies RateLimitConfig,

  // Login attempts: 5 per minute (brute force protection)
  login: {
    windowMs: 60_000,
    maxRequests: LOGIN_MAX,
    message: 'Too many login attempts. Please wait before trying again.',
    keyGenerator: (request: FastifyRequest) => `login:${request.ip}`,
  } satisfies RateLimitConfig,

  // CPRA email sending: 5 per minute (Phase 6 production hardening)
  cpraEmail: {
    windowMs: 60_000,
    maxRequests: parseInt(process.env.CPRA_MAX_EMAILS_PER_MINUTE || '5', 10),
    message: 'CPRA email rate limit exceeded. Maximum 5 emails per minute.',
    keyGenerator: defaultKeyGenerator,
  } satisfies RateLimitConfig,

  // CPRA email sending: 50 per day (Phase 6 production hardening — daily safety cap)
  cpraEmailDaily: {
    windowMs: 86_400_000, // 24 hours
    maxRequests: parseInt(process.env.CPRA_MAX_EMAILS_PER_DAY || '50', 10),
    message: 'CPRA daily email limit exceeded. Maximum 50 emails per day.',
    keyGenerator: defaultKeyGenerator,
  } satisfies RateLimitConfig,

  // Registration: 3 per minute per IP (spam protection)
  register: {
    windowMs: 60_000,
    maxRequests: REGISTER_MAX,
    message: 'Too many registration attempts. Please wait before trying again.',
    keyGenerator: (request: FastifyRequest) => `register:${request.ip}`,
  } satisfies RateLimitConfig,
};

// ---------------------------------------------------------------------------
// Route classification
// ---------------------------------------------------------------------------

function getRouteCategory(path: string, method: string): keyof typeof RATE_LIMIT_CONFIGS {
  // Login routes
  if (path === '/api/auth/login' && method === 'POST') {
    return 'login';
  }

  // Registration routes (Phase 6 hardening)
  if (path === '/api/auth/register' && method === 'POST') {
    return 'register';
  }

  // CPRA email sending routes (Phase 6 hardening) — returns per-minute category;
  // daily limit is checked separately in rateLimitHook.
  // Exclude worker control endpoints (/worker/start, /worker/stop, /check)
  if (
    (path.startsWith('/api/admin/cpra/send') ||
     (path.startsWith('/api/admin/cpra/follow-up') && !path.includes('/worker/') && !path.endsWith('/check'))) &&
    method === 'POST'
  ) {
    return 'cpraEmail';
  }

  // Upload routes
  if (
    (path.includes('/upload') || path.includes('/ingest') || path.includes('/import')) &&
    method === 'POST'
  ) {
    return 'upload';
  }

  // Compliance analysis routes
  if (
    (path.startsWith('/api/compliance/analyze') || path.startsWith('/api/compliance/run')) &&
    method === 'POST'
  ) {
    return 'compliance';
  }

  // Everything else: general limit
  return 'general';
}

// ---------------------------------------------------------------------------
// Fastify Rate Limit Hook
// ---------------------------------------------------------------------------

export async function rateLimitHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const path = request.url.split('?')[0];

  // Skip rate limiting for health checks
  if (path === '/api/health') {
    return;
  }

  // Skip for non-API routes
  if (!path.startsWith('/api/')) {
    return;
  }

  const category = getRouteCategory(path, request.method);
  const config = RATE_LIMIT_CONFIGS[category];
  const key = config.keyGenerator(request);

  // For CPRA email routes, enforce both per-minute and daily limits.
  // We peek at both limits first, then only increment when both allow.
  if (category === 'cpraEmail') {
    const dailyConfig = RATE_LIMIT_CONFIGS.cpraEmailDaily;
    const dailyKey = dailyConfig.keyGenerator(request);

    // Peek at per-minute limit first (don't increment yet)
    const minutePeek = peekRateLimit(category, key, config);
    // Peek at daily limit (don't increment yet)
    const dailyPeek = peekRateLimit('cpraEmailDaily', dailyKey, dailyConfig);

    reply.header('X-RateLimit-Daily-Limit', dailyPeek.limit);
    reply.header('X-RateLimit-Daily-Remaining', dailyPeek.remaining);

    // Check daily limit first
    if (!dailyPeek.allowed) {
      const retryAfter = Math.ceil((dailyPeek.resetAt - Date.now()) / 1000);
      reply.header('Retry-After', retryAfter);
      reply.code(429).send({
        error: 'Too Many Requests',
        message: dailyConfig.message,
        retryAfter,
      });
      return;
    }

    // Check per-minute limit
    if (!minutePeek.allowed) {
      reply.header('X-RateLimit-Limit', minutePeek.limit);
      reply.header('X-RateLimit-Remaining', minutePeek.remaining);
      reply.header('X-RateLimit-Reset', Math.ceil(minutePeek.resetAt / 1000));
      const retryAfter = Math.ceil((minutePeek.resetAt - Date.now()) / 1000);
      reply.header('Retry-After', retryAfter);
      reply.code(429).send({
        error: 'Too Many Requests',
        message: config.message,
        retryAfter,
      });
      return;
    }

    // Both limits allow — now increment both counters
    const result = checkRateLimit(category, key, config);
    const dailyResult = checkRateLimit('cpraEmailDaily', dailyKey, dailyConfig);

    reply.header('X-RateLimit-Limit', result.limit);
    reply.header('X-RateLimit-Remaining', result.remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
    reply.header('X-RateLimit-Daily-Remaining', dailyResult.remaining);
    return;
  }

  const result = checkRateLimit(category, key, config);

  // Set rate limit headers
  reply.header('X-RateLimit-Limit', result.limit);
  reply.header('X-RateLimit-Remaining', result.remaining);
  reply.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    reply.header('Retry-After', retryAfter);

    reply.code(429).send({
      error: 'Too Many Requests',
      message: config.message,
      retryAfter,
    });
    return;
  }
}

// ---------------------------------------------------------------------------
// Register rate limit routes (admin monitoring)
// ---------------------------------------------------------------------------

export async function registerRateLimitRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/admin/rate-limits — current rate limit stats
  app.get('/api/admin/rate-limits', async () => {
    const stats: Record<string, { activeEntries: number; config: RateLimitConfig }> = {};
    for (const [name, store] of rateLimitStores) {
      const config = RATE_LIMIT_CONFIGS[name as keyof typeof RATE_LIMIT_CONFIGS];
      stats[name] = {
        activeEntries: store.size,
        config: config || { windowMs: 0, maxRequests: 0, message: '', keyGenerator: defaultKeyGenerator },
      };
    }
    return { rateLimits: stats, timestamp: new Date().toISOString() };
  });
}

// ---------------------------------------------------------------------------
// Exported configuration for reports
// ---------------------------------------------------------------------------

export const RATE_LIMIT_CONFIG = {
  general: {
    windowMs: 60_000,
    maxRequests: GENERAL_MAX,
    description: `${GENERAL_MAX} requests per minute per user/IP (RATE_LIMIT_GENERAL_PER_MINUTE)`,
  },
  upload: {
    windowMs: 60_000,
    maxRequests: UPLOAD_MAX,
    description: `${UPLOAD_MAX} uploads per minute per user/IP (RATE_LIMIT_UPLOAD_PER_MINUTE)`,
  },
  compliance: {
    windowMs: 60_000,
    maxRequests: COMPLIANCE_MAX,
    description: `${COMPLIANCE_MAX} compliance analyses per minute per user/IP (RATE_LIMIT_COMPLIANCE_PER_MINUTE)`,
  },
  login: {
    windowMs: 60_000,
    maxRequests: LOGIN_MAX,
    description: `${LOGIN_MAX} login attempts per minute per IP (RATE_LIMIT_LOGIN_PER_MINUTE)`,
  },
  cpraEmail: { windowMs: 60_000, maxRequests: 5, description: '5 CPRA emails per minute (configurable via env)' },
  cpraEmailDaily: { windowMs: 86_400_000, maxRequests: 50, description: '50 CPRA emails per day (configurable via env)' },
  register: {
    windowMs: 60_000,
    maxRequests: REGISTER_MAX,
    description: `${REGISTER_MAX} registrations per minute per IP (RATE_LIMIT_REGISTER_PER_MINUTE)`,
  },
};
