// ============================================================================
// Phase 192 — Rate Limiting
// Prevent abuse and protect infrastructure.
// Limits: 100 req/min general, 10 uploads/min, 5 compliance analyses/min
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

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

// ---------------------------------------------------------------------------
// Default key generator (IP + userId if available)
// ---------------------------------------------------------------------------

function defaultKeyGenerator(request: FastifyRequest): string {
  const user = (request as Record<string, unknown>).user as { userId?: string } | undefined;
  if (user?.userId) {
    return `user:${user.userId}`;
  }
  return `ip:${request.ip}`;
}

// ---------------------------------------------------------------------------
// Rate limit configurations
// ---------------------------------------------------------------------------

const RATE_LIMIT_CONFIGS = {
  // General API: 100 requests per minute
  general: {
    windowMs: 60_000,
    maxRequests: 100,
    message: 'Too many requests. Please try again in a moment.',
    keyGenerator: defaultKeyGenerator,
  } satisfies RateLimitConfig,

  // File uploads: 10 per minute
  upload: {
    windowMs: 60_000,
    maxRequests: 10,
    message: 'Upload rate limit exceeded. Maximum 10 uploads per minute.',
    keyGenerator: defaultKeyGenerator,
  } satisfies RateLimitConfig,

  // Compliance analyses: 5 per minute
  compliance: {
    windowMs: 60_000,
    maxRequests: 5,
    message: 'Compliance analysis rate limit exceeded. Maximum 5 analyses per minute.',
    keyGenerator: defaultKeyGenerator,
  } satisfies RateLimitConfig,

  // Login attempts: 5 per minute (brute force protection)
  login: {
    windowMs: 60_000,
    maxRequests: 5,
    message: 'Too many login attempts. Please wait before trying again.',
    keyGenerator: (request: FastifyRequest) => `login:${request.ip}`,
  } satisfies RateLimitConfig,

  // CPRA email sending: 5 per minute, 50 per day (Phase 6 production hardening)
  cpraEmail: {
    windowMs: 60_000,
    maxRequests: parseInt(process.env.CPRA_MAX_EMAILS_PER_MINUTE || '5', 10),
    message: 'CPRA email rate limit exceeded. Maximum 5 emails per minute.',
    keyGenerator: defaultKeyGenerator,
  } satisfies RateLimitConfig,

  // Registration: 3 per minute per IP (spam protection)
  register: {
    windowMs: 60_000,
    maxRequests: 3,
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

  // CPRA email sending routes (Phase 6 hardening)
  if (
    (path.startsWith('/api/admin/cpra/send') || path.startsWith('/api/admin/cpra/follow-up')) &&
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
  general: { windowMs: 60_000, maxRequests: 100, description: '100 requests per minute per user/IP' },
  upload: { windowMs: 60_000, maxRequests: 10, description: '10 uploads per minute per user/IP' },
  compliance: { windowMs: 60_000, maxRequests: 5, description: '5 compliance analyses per minute per user/IP' },
  login: { windowMs: 60_000, maxRequests: 5, description: '5 login attempts per minute per IP' },
  cpraEmail: { windowMs: 60_000, maxRequests: 5, description: '5 CPRA emails per minute (configurable via env)' },
  register: { windowMs: 60_000, maxRequests: 3, description: '3 registrations per minute per IP' },
};
