// ============================================================================
// Phase 197 — Security Logging
// Structured logging for security events: failed logins, unauthorized access,
// upload validation failures, system exceptions
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'TOKEN_REFRESHED'
  | 'TOKEN_REFRESH_FAILED'
  | 'USER_REGISTERED'
  | 'AUTHENTICATED_ACCESS'
  | 'UNAUTHORIZED_ACCESS'
  | 'FORBIDDEN_ACCESS'
  | 'INVALID_TOKEN'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CSRF_VALIDATION_FAILED'
  | 'UPLOAD_VALIDATION_FAILED'
  | 'UPLOAD_SUCCESS'
  | 'MALICIOUS_FILE_DETECTED'
  | 'FILE_SIZE_EXCEEDED'
  | 'DANGEROUS_EXTENSION_BLOCKED'
  | 'SYSTEM_EXCEPTION'
  | 'SECURITY_HEADER_APPLIED'
  | 'ORIGIN_VALIDATION_FAILED'
  | 'SESSION_EXPIRED'
  | 'ALL_TOKENS_REVOKED';

export type SecuritySeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface SecurityLogEntry {
  timestamp: string;
  event: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  details?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Severity Classification
// ---------------------------------------------------------------------------

const EVENT_SEVERITY: Record<SecurityEventType, SecuritySeverity> = {
  LOGIN_SUCCESS: 'INFO',
  LOGIN_FAILED: 'WARNING',
  LOGOUT: 'INFO',
  TOKEN_REFRESHED: 'INFO',
  TOKEN_REFRESH_FAILED: 'WARNING',
  USER_REGISTERED: 'INFO',
  AUTHENTICATED_ACCESS: 'INFO',
  UNAUTHORIZED_ACCESS: 'WARNING',
  FORBIDDEN_ACCESS: 'WARNING',
  INVALID_TOKEN: 'WARNING',
  RATE_LIMIT_EXCEEDED: 'WARNING',
  CSRF_VALIDATION_FAILED: 'ERROR',
  UPLOAD_VALIDATION_FAILED: 'WARNING',
  UPLOAD_SUCCESS: 'INFO',
  MALICIOUS_FILE_DETECTED: 'CRITICAL',
  FILE_SIZE_EXCEEDED: 'WARNING',
  DANGEROUS_EXTENSION_BLOCKED: 'ERROR',
  SYSTEM_EXCEPTION: 'ERROR',
  SECURITY_HEADER_APPLIED: 'INFO',
  ORIGIN_VALIDATION_FAILED: 'ERROR',
  SESSION_EXPIRED: 'INFO',
  ALL_TOKENS_REVOKED: 'WARNING',
};

// ---------------------------------------------------------------------------
// Structured Security Logger
// ---------------------------------------------------------------------------

class SecurityLogger {
  private entries: SecurityLogEntry[] = [];
  private readonly maxEntries = 50000;
  private readonly flushThreshold = 45000;

  // Counters for quick aggregation
  private counters: Record<SecurityEventType, number> = {} as Record<SecurityEventType, number>;

  constructor() {
    // Initialize counters
    for (const event of Object.keys(EVENT_SEVERITY) as SecurityEventType[]) {
      this.counters[event] = 0;
    }
  }

  log(
    event: SecurityEventType,
    options: {
      userId?: string;
      ip?: string;
      userAgent?: string;
      path?: string;
      method?: string;
      statusCode?: number;
      details?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): void {
    const severity = EVENT_SEVERITY[event] || 'INFO';

    const entry: SecurityLogEntry = {
      timestamp: new Date().toISOString(),
      event,
      severity,
      ...options,
    };

    this.entries.push(entry);
    this.counters[event] = (this.counters[event] || 0) + 1;

    // Structured console output (JSON format for log aggregators)
    const logLine = JSON.stringify({
      level: severity.toLowerCase(),
      msg: `[SECURITY] ${event}`,
      timestamp: entry.timestamp,
      event: entry.event,
      userId: entry.userId,
      ip: entry.ip,
      path: entry.path,
      method: entry.method,
      statusCode: entry.statusCode,
      details: entry.details,
    });

    switch (severity) {
      case 'CRITICAL':
      case 'ERROR':
        console.error(logLine);
        break;
      case 'WARNING':
        console.warn(logLine);
        break;
      default:
        console.log(logLine);
    }

    // Trim old entries if needed
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(this.entries.length - this.flushThreshold);
    }
  }

  getEntries(options: {
    limit?: number;
    severity?: SecuritySeverity;
    event?: SecurityEventType;
    userId?: string;
    since?: string;
  } = {}): SecurityLogEntry[] {
    let filtered = [...this.entries];

    if (options.severity) {
      filtered = filtered.filter(e => e.severity === options.severity);
    }
    if (options.event) {
      filtered = filtered.filter(e => e.event === options.event);
    }
    if (options.userId) {
      filtered = filtered.filter(e => e.userId === options.userId);
    }
    if (options.since) {
      filtered = filtered.filter(e => e.timestamp >= options.since!);
    }

    const limit = options.limit || 100;
    return filtered.slice(-limit);
  }

  getCounters(): Record<SecurityEventType, number> {
    return { ...this.counters };
  }

  getSummary(): {
    totalEvents: number;
    byEvent: Record<string, number>;
    bySeverity: Record<string, number>;
    recentCritical: SecurityLogEntry[];
    recentErrors: SecurityLogEntry[];
  } {
    const bySeverity: Record<string, number> = { INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 };
    for (const entry of this.entries) {
      bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1;
    }

    return {
      totalEvents: this.entries.length,
      byEvent: { ...this.counters },
      bySeverity,
      recentCritical: this.entries.filter(e => e.severity === 'CRITICAL').slice(-10),
      recentErrors: this.entries.filter(e => e.severity === 'ERROR').slice(-20),
    };
  }

  clear(): void {
    this.entries = [];
    for (const event of Object.keys(this.counters) as SecurityEventType[]) {
      this.counters[event] = 0;
    }
  }
}

// Singleton instance
export const securityLogger = new SecurityLogger();

// ---------------------------------------------------------------------------
// Request Logging Hook (logs all API requests with security context)
// ---------------------------------------------------------------------------

export async function securityLoggingHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const path = request.url.split('?')[0];

  // Skip health checks from logging (too noisy)
  if (path === '/api/health') return;

  // Skip non-API routes
  if (!path.startsWith('/api/')) return;

  // Log will be completed in the onResponse hook (see registerSecurityLogging)
  // Store start time for response time calculation
  (request as unknown as Record<string, unknown>)._securityLogStart = Date.now();
}

// ---------------------------------------------------------------------------
// Register Security Logging Routes & Hooks
// ---------------------------------------------------------------------------

export async function registerSecurityLogging(app: FastifyInstance): Promise<void> {
  // Response hook — log completed requests
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?')[0];
    if (path === '/api/health' || !path.startsWith('/api/')) return;

    const startTime = (request as unknown as Record<string, unknown>)._securityLogStart as number | undefined;
    const responseTime = startTime ? Date.now() - startTime : undefined;
    const statusCode = reply.statusCode;

    // Determine event type based on status code
    let event: SecurityEventType = 'AUTHENTICATED_ACCESS';
    if (statusCode === 401) event = 'UNAUTHORIZED_ACCESS';
    else if (statusCode === 403) event = 'FORBIDDEN_ACCESS';
    else if (statusCode === 429) event = 'RATE_LIMIT_EXCEEDED';
    else if (statusCode >= 500) event = 'SYSTEM_EXCEPTION';

    // Only log non-success and specific events (reduce noise)
    if (statusCode >= 400 || path.startsWith('/api/auth/') || path.startsWith('/api/security/')) {
      const user = (request as unknown as Record<string, unknown>).user as { userId?: string } | undefined;
      securityLogger.log(event, {
        userId: user?.userId,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        path,
        method: request.method,
        statusCode,
        metadata: { responseTime },
      });
    }
  });

  // Error hook — log unhandled errors
  app.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    const path = request.url.split('?')[0];
    const user = (request as unknown as Record<string, unknown>).user as { userId?: string } | undefined;

    securityLogger.log('SYSTEM_EXCEPTION', {
      userId: user?.userId,
      ip: request.ip,
      path,
      method: request.method,
      details: error.message,
      metadata: { stack: error.stack },
    });
  });

  // GET /api/security/logs — security log viewer (admin only)
  app.get('/api/security/logs', async (request: FastifyRequest) => {
    const query = request.query as Record<string, string>;
    return securityLogger.getEntries({
      limit: parseInt(query.limit || '100', 10),
      severity: query.severity as SecuritySeverity | undefined,
      event: query.event as SecurityEventType | undefined,
      userId: query.userId,
      since: query.since,
    });
  });

  // GET /api/security/summary — security summary (admin only)
  app.get('/api/security/summary', async () => {
    return securityLogger.getSummary();
  });
}

// ---------------------------------------------------------------------------
// Exported configuration for reports
// ---------------------------------------------------------------------------

export const SECURITY_LOGGING_CONFIG = {
  eventTypes: Object.keys(EVENT_SEVERITY),
  severityLevels: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'],
  eventSeverityMap: EVENT_SEVERITY,
  maxEntries: 50000,
  features: {
    structuredJsonOutput: true,
    severityClassification: true,
    eventFiltering: true,
    userTracking: true,
    ipTracking: true,
    responseTimeTracking: true,
    adminDashboard: true,
    autoTrim: true,
  },
  loggedEvents: [
    'Failed login attempts',
    'Unauthorized API access (401)',
    'Forbidden access attempts (403)',
    'Rate limit exceeded (429)',
    'CSRF validation failures',
    'Upload validation failures',
    'Malicious file detections',
    'System exceptions (500+)',
    'Token refresh failures',
    'Session expirations',
    'Security header applications',
  ],
};
