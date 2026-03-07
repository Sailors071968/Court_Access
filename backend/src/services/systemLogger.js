// ============================================
// Court Access — System Error Logger
// Phase 42: Persistent error logging to database
// ============================================

import prisma from './prismaClient.js';

/**
 * Log a system error to the database with deduplication.
 * If the same service+message already exists unresolved, increments count.
 */
export async function logSystemError({ service, level = 'error', message, stackTrace, metadata }) {
  try {
    const existing = await prisma.systemErrorLog.findFirst({
      where: { service, message, resolved: false },
    });

    if (existing) {
      return prisma.systemErrorLog.update({
        where: { id: existing.id },
        data: { count: existing.count + 1, lastSeen: new Date() },
      });
    }

    return prisma.systemErrorLog.create({
      data: {
        service,
        level,
        message,
        stackTrace: stackTrace || null,
        metadata: metadata || {},
      },
    });
  } catch (err) {
    // Fallback to console if DB logging fails
    console.error(`[SystemLogger] Failed to log error: ${err.message}`);
    console.error(`[SystemLogger] Original error: [${service}] ${message}`);
  }
}

/**
 * Log an API error (called from Express error handler).
 */
export async function logApiError(err, req) {
  return logSystemError({
    service: 'api',
    level: 'error',
    message: err.message || 'Unknown API error',
    stackTrace: err.stack,
    metadata: {
      method: req?.method,
      path: req?.originalUrl,
      statusCode: err.statusCode || 500,
    },
  });
}

/**
 * Log an evidence processing failure.
 */
export async function logProcessingError(evidenceId, error) {
  return logSystemError({
    service: 'evidence-processor',
    level: 'error',
    message: error.message || 'Processing failed',
    stackTrace: error.stack,
    metadata: { evidenceId },
  });
}

/**
 * Log an upload failure.
 */
export async function logUploadError(filename, error) {
  return logSystemError({
    service: 'upload',
    level: 'error',
    message: error.message || 'Upload failed',
    stackTrace: error.stack,
    metadata: { filename },
  });
}

/**
 * Log an AI processing failure.
 */
export async function logAiError(evidenceId, operation, error) {
  return logSystemError({
    service: 'ai-processing',
    level: 'error',
    message: `${operation}: ${error.message || 'AI processing failed'}`,
    stackTrace: error.stack,
    metadata: { evidenceId, operation },
  });
}

/**
 * Log a Stripe/payment error.
 */
export async function logPaymentError(eventType, error, metadata = {}) {
  return logSystemError({
    service: 'stripe',
    level: 'error',
    message: `${eventType}: ${error.message || 'Payment processing error'}`,
    stackTrace: error.stack,
    metadata: { eventType, ...metadata },
  });
}
