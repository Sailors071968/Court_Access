// ============================================
// Court Access — Error Monitoring Service
// Phase 34: Sentry Integration
//
// Tracks:
// - API errors
// - Processing job failures
// - Upload failures
// - Frontend errors (via DSN)
// ============================================

import { config } from '../config/index.js';

let Sentry = null;
let initialized = false;

/**
 * Initialize Sentry error monitoring.
 * Safe to call multiple times — will only init once.
 */
export async function initErrorMonitoring() {
  if (initialized) return;

  if (!config.sentryDsn) {
    console.log('[Sentry] DSN not configured — error monitoring disabled');
    initialized = true;
    return;
  }

  try {
    Sentry = await import('@sentry/node');

    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.nodeEnv,
      release: `court-access-backend@${process.env.npm_package_version || '1.0.0'}`,
      tracesSampleRate: config.nodeEnv === 'production' ? 0.2 : 1.0,
      integrations: [],
    });

    initialized = true;
    console.log('[Sentry] Error monitoring initialized');
  } catch (err) {
    console.warn(`[Sentry] Failed to initialize: ${err.message}`);
    initialized = true; // Don't retry
  }
}

/**
 * Capture an exception in Sentry.
 */
export function captureException(error, context = {}) {
  if (Sentry) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
  // Always log to console as well
  console.error(`[Error] ${error.message}`, context);
}

/**
 * Capture a message in Sentry.
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (Sentry) {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  }
  console.log(`[${level.toUpperCase()}] ${message}`, Object.keys(context).length > 0 ? context : '');
}

/**
 * Set user context for error tracking.
 */
export function setUser(userId, tenantId, email) {
  if (Sentry) {
    Sentry.setUser({
      id: userId,
      email,
      tenant: tenantId,
    });
  }
}

/**
 * Clear user context.
 */
export function clearUser() {
  if (Sentry) {
    Sentry.setUser(null);
  }
}

/**
 * Express error handler middleware for Sentry.
 */
export function sentryErrorHandler() {
  return (err, req, res, next) => {
    captureException(err, {
      url: req.url,
      method: req.method,
      body: req.body,
      query: req.query,
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
    });

    // Pass to next error handler (logApiError) instead of sending response here
    next(err);
  };
}

/**
 * Track a processing job failure.
 */
export function trackJobFailure(jobType, jobId, error, metadata = {}) {
  captureException(error, {
    jobType,
    jobId,
    ...metadata,
    category: 'processing_job',
  });
}

/**
 * Track an upload failure.
 */
export function trackUploadFailure(evidenceId, error, metadata = {}) {
  captureException(error, {
    evidenceId,
    ...metadata,
    category: 'upload',
  });
}

/**
 * Flush pending events (call before process exit).
 */
export async function flushEvents(timeout = 2000) {
  if (Sentry) {
    await Sentry.flush(timeout);
  }
}
