// ============================================
// Court Access — Rate Limiting Middleware
// Phase 27/33: Production Hardening
//
// In-memory rate limiter with per-IP and per-tenant limits.
// In production, use Redis-backed rate limiting for multi-instance support.
// ============================================

const requestCounts = new Map();

/**
 * Create a rate limiter middleware.
 *
 * @param options - { windowMs, maxRequests, keyFn, message }
 * @returns Express middleware
 */
export function rateLimiter(options = {}) {
  const {
    windowMs = 60000,       // 1 minute window
    maxRequests = 100,       // Max requests per window
    keyFn = (req) => req.ip, // Key function (default: by IP)
    message = 'Too many requests, please try again later.',
  } = options;

  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounts) {
      if (now - data.windowStart > windowMs * 2) {
        requestCounts.delete(key);
      }
    }
  }, windowMs);

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();

    let data = requestCounts.get(key);

    if (!data || now - data.windowStart > windowMs) {
      data = { count: 0, windowStart: now };
    }

    data.count++;
    requestCounts.set(key, data);

    // Set rate limit headers
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - data.count)));
    res.set('X-RateLimit-Reset', String(Math.ceil((data.windowStart + windowMs) / 1000)));

    if (data.count > maxRequests) {
      return res.status(429).json({ error: message });
    }

    next();
  };
}

/**
 * Pre-configured rate limiters for different route types.
 */
export const apiLimiter = rateLimiter({
  windowMs: 60000,
  maxRequests: 100,
  message: 'API rate limit exceeded.',
});

export const uploadLimiter = rateLimiter({
  windowMs: 60000,
  maxRequests: 20,
  keyFn: (req) => req.headers['x-tenant-id'] || req.ip,
  message: 'Upload rate limit exceeded. Maximum 20 uploads per minute.',
});

export const authLimiter = rateLimiter({
  windowMs: 900000, // 15 minutes
  maxRequests: 10,
  message: 'Too many authentication attempts.',
});

export const webhookLimiter = rateLimiter({
  windowMs: 60000,
  maxRequests: 200,
  message: 'Webhook rate limit exceeded.',
});
