// ============================================
// Court Access — Alert Service
// Phase 116: Monitoring & Alerting System
//
// Monitors:
// - Server crashes (uncaught exceptions)
// - Worker failures (heartbeat misses)
// - Database connection errors
// - Email delivery failures
// - High error rates
//
// Alerts administrators immediately via email or log.
// ============================================

import prisma from './prismaClient.js';
import { sendEmail } from './emailService.js';

// Default alert rules — seeded on first startup
const DEFAULT_RULES = [
  { alertType: 'server_crash', threshold: 1, windowMinutes: 1, enabled: true },
  { alertType: 'worker_failure', threshold: 1, windowMinutes: 5, enabled: true },
  { alertType: 'db_connection_error', threshold: 3, windowMinutes: 5, enabled: true },
  { alertType: 'email_delivery_failure', threshold: 5, windowMinutes: 15, enabled: true },
  { alertType: 'high_error_rate', threshold: 10, windowMinutes: 5, enabled: true },
];

// In-memory error counters for rate-based alerting
const errorCounters = new Map(); // alertType -> { count, windowStart }

/**
 * Initialize alert rules in database (idempotent).
 */
export async function initAlertRules() {
  try {
    for (const rule of DEFAULT_RULES) {
      await prisma.alertRule.upsert({
        where: { alertType: rule.alertType },
        update: {},
        create: {
          alertType: rule.alertType,
          threshold: rule.threshold,
          windowMinutes: rule.windowMinutes,
          enabled: rule.enabled,
        },
      });
    }
    console.log('[Alerts] Alert rules initialized');
  } catch (err) {
    console.warn(`[Alerts] Failed to initialize rules: ${err.message}`);
  }
}

/**
 * Fire an alert event. Checks threshold rules before creating alert.
 */
export async function fireAlert(alertType, severity, message, details = {}) {
  try {
    // Check if alert rule exists and is enabled
    const rule = await prisma.alertRule.findUnique({
      where: { alertType },
    });

    if (rule && !rule.enabled) {
      return null; // Alert type disabled
    }

    // Check threshold with sliding window
    const threshold = rule?.threshold || 1;
    const windowMinutes = rule?.windowMinutes || 5;

    const counter = errorCounters.get(alertType) || { count: 0, windowStart: Date.now() };
    const windowMs = windowMinutes * 60 * 1000;

    // Reset window if expired
    if (Date.now() - counter.windowStart > windowMs) {
      counter.count = 0;
      counter.windowStart = Date.now();
    }

    counter.count++;
    errorCounters.set(alertType, counter);

    // Only fire alert when threshold is reached
    if (counter.count < threshold) {
      return null;
    }

    // Reset counter after firing
    counter.count = 0;

    // Create alert event in database
    const alertEvent = await prisma.alertEvent.create({
      data: {
        alertType,
        severity,
        message,
        details,
      },
    });

    // Update rule trigger info
    if (rule) {
      await prisma.alertRule.update({
        where: { alertType },
        data: {
          lastTriggered: new Date(),
          triggerCount: rule.triggerCount + 1,
        },
      });
    }

    // Notify administrator
    await notifyAdmin(alertType, severity, message, details, rule);

    console.warn(`[ALERT] ${severity.toUpperCase()}: [${alertType}] ${message}`);
    return alertEvent;
  } catch (err) {
    // Alert system should never crash the app
    console.error(`[Alerts] Failed to fire alert: ${err.message}`);
    return null;
  }
}

/**
 * Notify administrator of an alert via configured method.
 */
async function notifyAdmin(alertType, severity, message, details, rule) {
  const notifyEmail = rule?.notifyEmail || process.env.ADMIN_ALERT_EMAIL;
  const notifyMethod = rule?.notifyMethod || 'log';

  if (notifyMethod === 'email' && notifyEmail) {
    try {
      await sendEmail({
        to: notifyEmail,
        subject: `[CourtAccess ALERT] ${severity.toUpperCase()}: ${alertType}`,
        body: `Alert Type: ${alertType}\nSeverity: ${severity}\nMessage: ${message}\nDetails: ${JSON.stringify(details, null, 2)}\nTimestamp: ${new Date().toISOString()}`,
        emailType: 'notification',
        metadata: { alertType, severity },
      });
    } catch {
      console.error(`[Alerts] Failed to send alert email to ${notifyEmail}`);
    }
  }

  // Always log to console regardless of method
  console.warn(`[ALERT NOTIFICATION] ${severity}: ${alertType} — ${message}`);
}

/**
 * Get all alert events (with optional filters).
 */
export async function getAlertEvents({ acknowledged, alertType, severity, page = 1, limit = 50 } = {}) {
  const where = {};
  if (acknowledged !== undefined) where.acknowledged = acknowledged;
  if (alertType) where.alertType = alertType;
  if (severity) where.severity = severity;

  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    prisma.alertEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.alertEvent.count({ where }),
  ]);

  return { events, total, page, totalPages: Math.ceil(total / limit) };
}

/**
 * Acknowledge an alert event.
 */
export async function acknowledgeAlert(alertId, acknowledgedBy) {
  return prisma.alertEvent.update({
    where: { id: alertId },
    data: {
      acknowledged: true,
      acknowledgedBy,
      acknowledgedAt: new Date(),
    },
  });
}

/**
 * Get all alert rules.
 */
export async function getAlertRules() {
  return prisma.alertRule.findMany({
    orderBy: { alertType: 'asc' },
  });
}

/**
 * Update an alert rule.
 */
export async function updateAlertRule(alertType, updates) {
  return prisma.alertRule.update({
    where: { alertType },
    data: updates,
  });
}

/**
 * Install global error handlers for crash detection.
 */
export function installCrashHandlers() {
  process.on('uncaughtException', async (err) => {
    await fireAlert('server_crash', 'critical', `Uncaught exception: ${err.message}`, {
      stack: err.stack,
      name: err.name,
    });
    // Let Node.js default handler continue (process exits)
  });

  process.on('unhandledRejection', async (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    await fireAlert('server_crash', 'high', `Unhandled promise rejection: ${message}`, {
      stack,
    });
  });

  console.log('[Alerts] Crash handlers installed');
}
