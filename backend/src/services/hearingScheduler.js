// ============================================
// Court Access — Hearing Reminder Scheduler
// Uses node-cron for reliable hourly scheduling
// that survives server restarts (re-initialized on boot).
// Sends SMS reminders via Twilio with Google Maps link.
// Prevents duplicate alerts via Prisma DB logs.
// ============================================

import cron from 'node-cron';
import { config } from '../config/index.js';
import { sendClientSms } from './smsNotification.js';
import prisma from './prismaClient.js';

let schedulerTask = null;
let lastRunTimestamp = null;

// ---------------------------------------------------------------------------
// Core scheduler logic
// ---------------------------------------------------------------------------

/**
 * Calculate calendar days between today and a target date.
 * Compares dates only (ignoring time of day) to avoid
 * missing reminders due to hour-of-day timing.
 * Returns 0 if the hearing is today, 1 if tomorrow, etc.
 */
function calendarDaysUntil(targetDatetime) {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(targetDatetime);
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffMs = targetMidnight.getTime() - todayMidnight.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Build the SMS message for a hearing reminder.
 * Includes Google Maps directions link.
 */
function buildReminderMessage(hearing, caseName) {
  const address = hearing.courthouseAddress || '';
  const mapsUrl = address
    ? `https://maps.google.com/?q=${encodeURIComponent(address)}`
    : null;

  return [
    'Court Access Reminder',
    '',
    `Case: ${caseName || 'Unknown Case'}`,
    '',
    `Hearing: ${hearing.hearingName}`,
    `Courthouse: ${hearing.courthouseName}`,
    `Address: ${address}`,
    hearing.department ? `Dept: ${hearing.department}` : null,
    `Date: ${formatDate(hearing.hearingDatetime)}`,
    `Time: ${formatTime(hearing.hearingDatetime)}`,
    '',
    mapsUrl ? `Directions:\n${mapsUrl}` : null,
  ].filter(Boolean).join('\n');
}

/**
 * Resolve the phone number to send SMS to.
 * Priority: hearing.clientPhone > config.adminAlertPhone
 * Returns null if no phone available (skip SMS + log warning).
 */
function resolvePhone(hearing) {
  if (hearing.clientPhone) return hearing.clientPhone;
  if (config.adminAlertPhone) return config.adminAlertPhone;
  return null;
}

/**
 * Format a datetime string to a readable date (e.g., "May 12, 2026").
 */
function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a datetime string to a readable time (e.g., "8:30 AM").
 */
function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Retry a single failed SMS after 60 seconds.
 * If the retry also fails, log a ReminderFailure record.
 */
async function retrySmsSend({ hearing, reminder, phone, message }) {
  try {
    const smsResult = await sendClientSms(phone, message);

    // Only log as sent if SMS was actually delivered
    if (smsResult === null) {
      console.warn(JSON.stringify({
        event: 'retry_skipped',
        reason: 'sms_not_configured',
        hearingId: hearing.id,
        caseId: hearing.caseId,
        reminderType: reminder.type,
        attempt: 2,
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    // Log the sent reminder in the database
    await prisma.hearingReminderLog.create({
      data: {
        hearingId: hearing.id,
        reminderType: reminder.type,
      },
    });

    console.log(JSON.stringify({
      event: 'reminder_triggered',
      hearingId: hearing.id,
      caseId: hearing.caseId,
      clientPhone: phone,
      reminderType: reminder.type,
      attempt: 2,
      timestamp: new Date().toISOString(),
    }));
  } catch (retryErr) {
    // Second attempt failed — create reminder_failure record
    console.error(JSON.stringify({
      event: 'sms_failed',
      hearingId: hearing.id,
      caseId: hearing.caseId,
      clientPhone: phone,
      reminderType: reminder.type,
      error: retryErr.message,
      attempt: 2,
      timestamp: new Date().toISOString(),
    }));

    try {
      await prisma.reminderFailure.create({
        data: {
          hearingId: hearing.id,
          reminderType: reminder.type,
          phone,
          errorMessage: retryErr.message || 'Unknown error',
          attempt: 2,
        },
      });
    } catch (dbErr) {
      console.error(`[HearingScheduler] Failed to log reminder failure: ${dbErr.message}`);
    }
  }
}

/**
 * Run one pass of the reminder scheduler.
 * Queries PostgreSQL for hearings within the next 30 days and sends reminders.
 * Failed sends are retried once after 60 seconds.
 */
export async function runSchedulerPass() {
  let checked = 0;
  let sent = 0;
  const retryQueue = [];

  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Query upcoming hearings from the database (within 30 days, future only)
    const hearings = await prisma.hearing.findMany({
      where: {
        hearingDatetime: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
      },
      include: {
        reminderLogs: true,
      },
    });

    for (const hearing of hearings) {
      const days = calendarDaysUntil(hearing.hearingDatetime);
      if (days < 0 || days > 30) continue;
      checked++;

      const reminders = [
        { type: 1, enabled: hearing.reminder1Enabled, daysBefore: hearing.reminder1DaysBefore },
        { type: 2, enabled: hearing.reminder2Enabled, daysBefore: hearing.reminder2DaysBefore },
        { type: 3, enabled: hearing.reminder3Enabled, daysBefore: hearing.reminder3DaysBefore },
      ];

      for (const reminder of reminders) {
        if (!reminder.enabled) continue;
        // Use range check: fire on target day or any day after (closer to hearing).
        // DB unique constraint on (hearingId, reminderType) prevents duplicate sends.
        if (days > reminder.daysBefore) continue;

        // Check if already sent via database (unique constraint on hearingId + reminderType)
        const alreadySent = hearing.reminderLogs.some(
          (log) => log.reminderType === reminder.type
        );
        if (alreadySent) continue;

        // Resolve phone number (priority: hearing.clientPhone > admin phone)
        const phone = resolvePhone(hearing);
        if (!phone) {
          console.warn(JSON.stringify({
            event: 'reminder_skipped',
            reason: 'no_phone',
            hearingId: hearing.id,
            caseId: hearing.caseId,
            reminderType: reminder.type,
            timestamp: new Date().toISOString(),
          }));
          continue;
        }

        // Build and send the SMS
        const message = buildReminderMessage(hearing, hearing.caseName || 'Unknown Case');

        try {
          const smsResult = await sendClientSms(phone, message);

          // Only log as sent if SMS was actually delivered (not silently skipped)
          if (smsResult === null) {
            console.warn(JSON.stringify({
              event: 'reminder_skipped',
              reason: 'sms_not_configured',
              hearingId: hearing.id,
              caseId: hearing.caseId,
              reminderType: reminder.type,
              timestamp: new Date().toISOString(),
            }));
            continue;
          }

          // Log the sent reminder in the database (persists across restarts)
          await prisma.hearingReminderLog.create({
            data: {
              hearingId: hearing.id,
              reminderType: reminder.type,
            },
          });

          sent++;
          console.log(JSON.stringify({
            event: 'reminder_triggered',
            hearingId: hearing.id,
            caseId: hearing.caseId,
            clientPhone: phone,
            reminderType: reminder.type,
            daysBefore: days,
            timestamp: new Date().toISOString(),
          }));
        } catch (err) {
          console.error(JSON.stringify({
            event: 'reminder_send_failed',
            hearingId: hearing.id,
            caseId: hearing.caseId,
            clientPhone: phone,
            reminderType: reminder.type,
            error: err.message,
            attempt: 1,
            timestamp: new Date().toISOString(),
          }));

          // Retry once after 60 seconds
          retryQueue.push({ hearing, reminder, phone, message });
        }
      }
    }

    if (checked > 0 || sent > 0) {
      console.log(`[HearingScheduler] Pass complete: ${checked} hearings checked, ${sent} reminders sent`);
    }
  } catch (err) {
    console.error(`[HearingScheduler] Pass error: ${err.message}`);
  }

  // Process retry queue — retry failed sends after 60 seconds
  if (retryQueue.length > 0) {
    console.log(`[HearingScheduler] ${retryQueue.length} reminder(s) queued for retry in 60s`);
    setTimeout(async () => {
      for (const item of retryQueue) {
        await retrySmsSend(item);
      }
    }, 60000);
  }

  lastRunTimestamp = new Date().toISOString();
  return { checked, sent };
}

// ---------------------------------------------------------------------------
// Admin status — used by GET /api/admin/reminder-status
// ---------------------------------------------------------------------------

/**
 * Get the current reminder system status for admin monitoring.
 */
export async function getReminderStatus() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [hearingsPending, hearingsToday, remindersQueued, recentFailures] = await Promise.all([
    // Hearings with future dates
    prisma.hearing.count({
      where: { hearingDatetime: { gte: now } },
    }),
    // Hearings scheduled for today
    prisma.hearing.count({
      where: {
        hearingDatetime: { gte: todayStart, lt: todayEnd },
      },
    }),
    // Hearings within reminder window (next 30 days)
    prisma.hearing.count({
      where: {
        hearingDatetime: {
          gte: now,
          lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    // Recent failures in last 24 hours
    prisma.reminderFailure.count({
      where: { createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
    }),
  ]);

  // Estimate the next cron run time (top of the next hour)
  const nextHour = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);

  return {
    schedulerRunning: schedulerTask !== null,
    lastRunTimestamp,
    nextScheduledRun: schedulerTask ? nextHour.toISOString() : null,
    hearingsPending,
    hearingsToday,
    remindersQueued,
    recentFailures,
  };
}

// ---------------------------------------------------------------------------
// Scheduler lifecycle
// ---------------------------------------------------------------------------

/**
 * Initialize the scheduler using node-cron.
 * Runs at the top of every hour (minute 0).
 * Survives server restarts by being re-initialized on boot.
 */
export function initScheduler() {
  // Run first pass immediately on startup
  runSchedulerPass().catch((err) => {
    console.error(`[HearingScheduler] Initial pass error: ${err.message}`);
  });

  // Schedule hourly passes using node-cron (at minute 0 of every hour)
  schedulerTask = cron.schedule('0 * * * *', () => {
    runSchedulerPass().catch((err) => {
      console.error(`[HearingScheduler] Scheduled pass error: ${err.message}`);
    });
  });

  console.log('[HearingScheduler] Started — running every hour (node-cron)');
}

/**
 * Stop the scheduler.
 */
export function stopScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('[HearingScheduler] Stopped');
  }
}
