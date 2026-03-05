// ============================================
// Court Access — Hearing Reminder Scheduler
// Runs every hour, checks upcoming hearings,
// and sends SMS reminders via Twilio.
// Prevents duplicate alerts via Prisma DB logs.
// ============================================

import { config } from '../config/index.js';
import { sendClientSms } from './smsNotification.js';
import prisma from './prismaClient.js';

let schedulerInterval = null;

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
 */
function buildReminderMessage(hearing, caseName) {
  return [
    'Court Access Reminder',
    '',
    'Your hearing is coming up.',
    '',
    `Case: ${caseName || 'Unknown Case'}`,
    `Hearing: ${hearing.hearingName}`,
    `Courthouse: ${hearing.courthouseName}`,
    `Address: ${hearing.courthouseAddress}`,
    hearing.department ? `Dept: ${hearing.department}` : null,
    `Date: ${formatDate(hearing.hearingDatetime)}`,
    `Time: ${formatTime(hearing.hearingDatetime)}`,
  ].filter(Boolean).join('\n');
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

        // Build and send the SMS
        const message = buildReminderMessage(hearing, hearing.caseName || 'Unknown Case');

        try {
          const phone = hearing.clientPhone || config.adminAlertPhone;
          if (!phone) {
            console.log(`[HearingScheduler] No phone number for hearing ${hearing.id} — skipping`);
            continue;
          }

          await sendClientSms(phone, message);

          // Log the sent reminder in the database (persists across restarts)
          await prisma.hearingReminderLog.create({
            data: {
              hearingId: hearing.id,
              reminderType: reminder.type,
            },
          });

          sent++;
          console.log(`[HearingScheduler] Sent reminder ${reminder.type} for hearing ${hearing.id} (${days} days before)`);
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
 * Initialize the scheduler.
 * No longer needs store references — queries Prisma directly.
 * Runs the scheduler every hour (3600000 ms).
 */
export function initScheduler() {
  // Run first pass immediately
  runSchedulerPass().catch((err) => {
    console.error(`[HearingScheduler] Initial pass error: ${err.message}`);
  });

  // Schedule hourly passes
  schedulerInterval = setInterval(() => {
    runSchedulerPass().catch((err) => {
      console.error(`[HearingScheduler] Scheduled pass error: ${err.message}`);
    });
  }, 60 * 60 * 1000); // Every hour

  console.log('[HearingScheduler] Started — running every hour');
}

/**
 * Stop the scheduler.
 */
export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[HearingScheduler] Stopped');
  }
}
