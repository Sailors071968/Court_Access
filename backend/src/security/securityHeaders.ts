// ============================================================================
// Phase 194 — Security Headers
// Content-Security-Policy, Strict-Transport-Security, X-Frame-Options,
// X-Content-Type-Options, Referrer-Policy, Permissions-Policy
// ============================================================================

import type { FastifyRequest, FastifyReply } from 'fastify';

// ---------------------------------------------------------------------------
// Security Header Configuration
// ---------------------------------------------------------------------------

const SECURITY_HEADERS: Record<string, string> = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',

  // Prevent MIME-type sniffing
  'X-Content-Type-Options': 'nosniff',

  // XSS protection (legacy browsers)
  'X-XSS-Protection': '1; mode=block',

  // Referrer policy — send origin only on cross-origin requests
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // HSTS — enforce HTTPS for 1 year, include subdomains, allow preload
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline for React dev; tighten in production
    "style-src 'self' 'unsafe-inline'", // Allow inline styles for CSS-in-JS
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' http://localhost:* ws://localhost:*",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; '),

  // Permissions Policy — restrict browser features
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
  ].join(', '),

  // Prevent information leakage
  'X-Permitted-Cross-Domain-Policies': 'none',

  // Remove server identification
  'X-Powered-By': '',
};

// Production-specific overrides
const PRODUCTION_OVERRIDES: Partial<Record<string, string>> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.courtaccess.net wss://*.courtaccess.net https://*.courtaccess.com wss://*.courtaccess.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; '),
};

// ---------------------------------------------------------------------------
// Security Headers Hook
// ---------------------------------------------------------------------------

export async function securityHeadersHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const headers = { ...SECURITY_HEADERS };

  // Apply production overrides
  if (isProduction) {
    Object.assign(headers, PRODUCTION_OVERRIDES);
  }

  // Set all security headers
  for (const [name, value] of Object.entries(headers)) {
    if (name === 'X-Powered-By') {
      // Remove X-Powered-By instead of setting it
      reply.removeHeader('X-Powered-By');
    } else {
      reply.header(name, value);
    }
  }

  // Add cache control for API responses
  const path = request.url.split('?')[0];
  if (path.startsWith('/api/')) {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
  }
}

// ---------------------------------------------------------------------------
// Exported configuration for reports
// ---------------------------------------------------------------------------

export const SECURITY_HEADERS_CONFIG = {
  headers: Object.entries(SECURITY_HEADERS).map(([name, value]) => ({
    name,
    value: name === 'X-Powered-By' ? '(removed)' : value,
    purpose: getHeaderPurpose(name),
  })),
  productionOverrides: Object.keys(PRODUCTION_OVERRIDES),
  apiCacheControl: 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

function getHeaderPurpose(name: string): string {
  const purposes: Record<string, string> = {
    'X-Frame-Options': 'Prevent clickjacking by denying iframe embedding',
    'X-Content-Type-Options': 'Prevent MIME-type sniffing attacks',
    'X-XSS-Protection': 'Enable XSS filter in legacy browsers',
    'Referrer-Policy': 'Control referrer information sent with requests',
    'Strict-Transport-Security': 'Enforce HTTPS for all connections (1 year)',
    'Content-Security-Policy': 'Restrict resource loading sources to prevent XSS',
    'Permissions-Policy': 'Disable unnecessary browser features (camera, mic, etc.)',
    'X-Permitted-Cross-Domain-Policies': 'Prevent Flash/PDF cross-domain data loading',
    'X-Powered-By': 'Remove server technology identification',
  };
  return purposes[name] || 'Security header';
}
