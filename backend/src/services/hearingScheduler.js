// ============================================
// Court Access — Hearing Reminder Scheduler
// Runs every hour, checks upcoming hearings,
// and sends SMS reminders via Twilio.
// Prevents duplicate alerts via reminder logs.
// ============================================

import crypto from 'crypto';
import { config, features } from '../config/index.js';
import { sendClientSms } from './smsNotification.js';

// These will be set by initScheduler() from the hearings route stores
let hearingsStore = null;
let reminderLogsStore = null;

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
 * Check if a reminder has already been sent for a given hearing + reminder type.
 */
function wasReminderSent(hearingId, reminderType) {
  for (const log of reminderLogsStore.values()) {
    if (log.hearingId === hearingId && log.reminderType === reminderType) {
      return true;
    }
  }
  return false;
}

/**
 * Log a sent reminder to prevent duplicates.
 */
function logReminderSent(hearingId, reminderType) {
  const id = crypto.randomUUID();
  reminderLogsStore.set(id, {
    id,
    hearingId,
    reminderType,
    sentAt: new Date().toISOString(),
  });
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
 * Scans all hearings within the next 30 days and sends reminders as configured.
 */
export async function runSchedulerPass() {
  if (!hearingsStore || !reminderLogsStore) {
    console.log('[HearingScheduler] Stores not initialized — skipping pass');
    return { checked: 0, sent: 0 };
  }

  let checked = 0;
  let sent = 0;

  for (const hearing of hearingsStore.values()) {
    const days = daysUntil(hearing.hearingDatetime);

    // Only check hearings within the next 30 days and in the future
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
      if (wasReminderSent(hearing.id, reminder.type)) continue;

      // Build and send the SMS
      const message = buildReminderMessage(hearing, hearing.caseName || 'Unknown Case');

      try {
        // clientPhone would come from the user profile associated with the case
        // For now we use the admin phone as fallback
        const phone = hearing.clientPhone || config.adminAlertPhone;
        if (!phone) {
          console.log(`[HearingScheduler] No phone number for hearing ${hearing.id} — skipping`);
          continue;
        }

        await sendClientSms(phone, message);
        logReminderSent(hearing.id, reminder.type);
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

  return { checked, sent };
}

// ---------------------------------------------------------------------------
// Scheduler lifecycle
// ---------------------------------------------------------------------------

/**
 * Initialize the scheduler with the hearing and reminder log stores.
 * Runs the scheduler every hour (3600000 ms).
 */
export function initScheduler(hearings, reminderLogs) {
  hearingsStore = hearings;
  reminderLogsStore = reminderLogs;

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
