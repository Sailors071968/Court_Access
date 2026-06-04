// ============================================================================
// Stage 1 — Structured Logging Categories
//
// Centralized logging category constants and category-aware logger factory.
// All production logging should use one of these categories for consistent
// filtering, alerting, and dashboard creation.
//
// Usage:
//   import { categoryLogger } from './observability/logCategories.ts';
//   const log = categoryLogger('AUTH');
//   log.info('Login attempt', { email: 'user@example.com' });
//   log.error('JWT verification failed', { error: err.message });
// ============================================================================

import { logger, type LogLevel } from './structuredLogger.ts';

// ---------------------------------------------------------------------------
// Log Categories
// ---------------------------------------------------------------------------

export const LOG_CATEGORIES = {
  AUTH: 'auth',
  SECURITY: 'security',
  INGESTION: 'ingestion',
  OCR: 'ocr',
  QUEUE: 'queue',
  REDIS: 'redis',
  DIFF_ENGINE: 'diff-engine',
  INMATE_MATCH: 'inmate-match',
  DEDUPE: 'dedupe',
  BOND_SCORING: 'bond-scoring',
  API: 'api',
  SYSTEM: 'system',
} as const;

export type LogCategory = typeof LOG_CATEGORIES[keyof typeof LOG_CATEGORIES];

// ---------------------------------------------------------------------------
// Category Logger Factory
// ---------------------------------------------------------------------------

export interface CategoryLoggerInterface {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

/**
 * Create a category-scoped logger. The category is automatically
 * included in every log entry as the `component` field.
 *
 * @example
 *   const log = categoryLogger('AUTH');
 *   log.info('User logged in', { userId: '123' });
 *   // Output: {"timestamp":"...","level":"info","service":"court-access-backend","component":"auth","message":"User logged in","data":{"userId":"123"}}
 */
export function categoryLogger(category: LogCategory | string): CategoryLoggerInterface {
  return {
    debug: (message: string, data?: Record<string, unknown>) => logger.debug(category, message, data),
    info: (message: string, data?: Record<string, unknown>) => logger.info(category, message, data),
    warn: (message: string, data?: Record<string, unknown>) => logger.warn(category, message, data),
    error: (message: string, data?: Record<string, unknown>) => logger.error(category, message, data),
  };
}

// ---------------------------------------------------------------------------
// Pre-instantiated Category Loggers (convenience)
// ---------------------------------------------------------------------------

export const authLog = categoryLogger(LOG_CATEGORIES.AUTH);
export const securityLog = categoryLogger(LOG_CATEGORIES.SECURITY);
export const ingestionLog = categoryLogger(LOG_CATEGORIES.INGESTION);
export const ocrLog = categoryLogger(LOG_CATEGORIES.OCR);
export const queueLog = categoryLogger(LOG_CATEGORIES.QUEUE);
export const redisLog = categoryLogger(LOG_CATEGORIES.REDIS);
export const diffEngineLog = categoryLogger(LOG_CATEGORIES.DIFF_ENGINE);
export const inmateMatchLog = categoryLogger(LOG_CATEGORIES.INMATE_MATCH);
export const dedupeLog = categoryLogger(LOG_CATEGORIES.DEDUPE);
export const bondScoringLog = categoryLogger(LOG_CATEGORIES.BOND_SCORING);
export const apiLog = categoryLogger(LOG_CATEGORIES.API);
export const systemLog = categoryLogger(LOG_CATEGORIES.SYSTEM);
