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

// ---------------------------------------------------------------------------
// Core scheduler logic
// ---------------------------------------------------------------------------

/**
 * Calculate days between now and a target datetime.
 * Returns a whole number of days (floor).
 */
function daysUntil(targetDatetime) {
  const now = new Date();
  const target = new Date(targetDatetime);
  const diffMs = target.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
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
 * Run one pass of the reminder scheduler.
 * Queries PostgreSQL for hearings within the next 30 days and sends reminders.
 */
export async function runSchedulerPass() {
  let checked = 0;
  let sent = 0;

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
      const days = daysUntil(hearing.hearingDatetime);
      if (days < 0 || days > 30) continue;
      checked++;

      const reminders = [
        { type: 1, enabled: hearing.reminder1Enabled, daysBefore: hearing.reminder1DaysBefore },
        { type: 2, enabled: hearing.reminder2Enabled, daysBefore: hearing.reminder2DaysBefore },
        { type: 3, enabled: hearing.reminder3Enabled, daysBefore: hearing.reminder3DaysBefore },
      ];

      for (const reminder of reminders) {
        if (!reminder.enabled) continue;
        if (days !== reminder.daysBefore) continue;

        // Check if already sent via database (unique constraint on hearingId + reminderType)
        const alreadySent = hearing.reminderLogs.some(
          (log) => log.reminderType === reminder.type
        );
        if (alreadySent) continue;

        // Resolve phone number (priority: hearing.clientPhone > admin phone)
        const phone = resolvePhone(hearing);
        if (!phone) {
          console.warn(`[HearingScheduler] No phone number for hearing ${hearing.id} (case: ${hearing.caseName || 'unknown'}) — skipping SMS`);
          continue;
        }

        // Build and send the SMS
        const message = buildReminderMessage(hearing, hearing.caseName || 'Unknown Case');

        try {
          await sendClientSms(phone, message);

          // Log the sent reminder in the database (persists across restarts)
          await prisma.hearingReminderLog.create({
            data: {
              hearingId: hearing.id,
              reminderType: reminder.type,
            },
          });

          sent++;
          console.log(`[HearingScheduler] Sent reminder ${reminder.type} for hearing ${hearing.id} to ${phone} (${days} days before)`);
        } catch (err) {
          console.error(`[HearingScheduler] Failed to send reminder for hearing ${hearing.id}: ${err.message}`);
        }
      }
    }

    if (checked > 0 || sent > 0) {
      console.log(`[HearingScheduler] Pass complete: ${checked} hearings checked, ${sent} reminders sent`);
    }
  } catch (err) {
    console.error(`[HearingScheduler] Pass error: ${err.message}`);
  }

  return { checked, sent };
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
