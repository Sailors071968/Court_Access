// ============================================
// Court Access — SMS Notification Service
// Sends Twilio SMS alerts to admin on key events
// (new subscriptions, payments, cancellations).
// Includes rate protection (max 5 SMS per phone per 10 min)
// and retry logic for hearing reminders.
// ============================================

import twilio from 'twilio';
import { config, features } from '../config/index.js';
import prisma from './prismaClient.js';

let twilioClient = null;

// ---------------------------------------------------------------------------
// SMS Rate Protection — max 5 SMS per phone per 10 minutes
// ---------------------------------------------------------------------------

const SMS_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const SMS_RATE_MAX = 5;

/**
 * Check if a phone number has exceeded the SMS rate limit.
 * Returns true if the phone can receive another SMS.
 */
export async function checkSmsRateLimit(phone) {
  const windowStart = new Date(Date.now() - SMS_RATE_WINDOW_MS);
  const recentCount = await prisma.smsRateLog.count({
    where: {
      phone,
      sentAt: { gte: windowStart },
    },
  });
  return recentCount < SMS_RATE_MAX;
}

/**
 * Record an SMS send for rate limiting purposes.
 */
async function recordSmsSend(phone) {
  await prisma.smsRateLog.create({ data: { phone } });
}

/**
 * Get or create the Twilio client.
 * Returns null if Twilio is not configured.
 */
function getClient() {
  if (twilioClient) return twilioClient;
  if (!features.twilio) return null;

  twilioClient = twilio(config.twilioAccountSid, config.twilioAuthToken);
  return twilioClient;
}

/**
 * Send an SMS message to the admin alert phone number.
 * Silently degrades if Twilio is not configured.
 */
export async function sendAdminSms(message) {
  const client = getClient();
  if (!client) {
    console.log('[SMS] Twilio not configured — skipping SMS notification');
    return null;
  }

  if (!config.adminAlertPhone) {
    console.log('[SMS] ADMIN_ALERT_PHONE not configured — skipping SMS notification');
    return null;
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: config.twilioPhoneNumber,
      to: config.adminAlertPhone,
    });
    console.log(`[SMS] Alert sent to ${config.adminAlertPhone} (SID: ${result.sid})`);
    return result;
  } catch (err) {
    console.error(`[SMS] Failed to send alert: ${err.message}`);
    return null;
  }
}

/**
 * Send SMS notification for a new subscription checkout.
 */
export async function notifyNewSubscription({ customerName, customerEmail, planName, amount }) {
  const message = [
    'NEW COURT ACCESS SUBSCRIPTION',
    `Name: ${customerName || 'Unknown'}`,
    `Email: ${customerEmail || 'Unknown'}`,
    `Plan: ${planName || 'Unknown Plan'}`,
    `Amount: $${amount || '0.00'}`,
  ].join('\n');

  return sendAdminSms(message);
}

/**
 * Send SMS notification for a successful invoice payment.
 */
export async function notifyPaymentReceived({ customerEmail, amount, currency }) {
  const message = [
    'COURT ACCESS PAYMENT RECEIVED',
    `Email: ${customerEmail || 'Unknown'}`,
    `Amount: $${amount || '0.00'} ${(currency || 'usd').toUpperCase()}`,
  ].join('\n');

  return sendAdminSms(message);
}

/**
 * Send SMS notification for a failed payment.
 */
export async function notifyPaymentFailed({ customerEmail, attemptCount }) {
  const message = [
    'COURT ACCESS PAYMENT FAILED',
    `Email: ${customerEmail || 'Unknown'}`,
    `Attempt: ${attemptCount || 1}`,
    'Action may be required.',
  ].join('\n');

  return sendAdminSms(message);
}

/**
 * Send SMS notification for a subscription cancellation.
 */
export async function notifySubscriptionCancelled({ customerEmail }) {
  const message = [
    'COURT ACCESS SUBSCRIPTION CANCELLED',
    `Email: ${customerEmail || 'Unknown'}`,
  ].join('\n');

  return sendAdminSms(message);
}

/**
 * Send an SMS message to a specific client phone number.
 * Used by the hearing reminder scheduler.
 * Enforces rate protection (max 5 SMS per phone per 10 min).
 * Silently degrades if Twilio is not configured.
 */
export async function sendClientSms(toPhone, message) {
  const client = getClient();
  if (!client) {
    console.log(JSON.stringify({
      event: 'sms_skipped', reason: 'twilio_not_configured', phone: toPhone, timestamp: new Date().toISOString(),
    }));
    return null;
  }

  if (!toPhone) {
    console.log(JSON.stringify({
      event: 'sms_skipped', reason: 'no_phone', timestamp: new Date().toISOString(),
    }));
    return null;
  }

  // Rate protection: max 5 SMS per phone per 10 minutes
  const withinLimit = await checkSmsRateLimit(toPhone);
  if (!withinLimit) {
    console.warn(JSON.stringify({
      event: 'sms_rate_limited', phone: toPhone, timestamp: new Date().toISOString(),
    }));
    throw new Error(`SMS rate limit exceeded for ${toPhone} (max ${SMS_RATE_MAX} per ${SMS_RATE_WINDOW_MS / 60000} min)`);
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: config.twilioPhoneNumber,
      to: toPhone,
    });
    // Record send for rate limiting
    await recordSmsSend(toPhone);
    console.log(JSON.stringify({
      event: 'sms_sent', phone: toPhone, sid: result.sid, timestamp: new Date().toISOString(),
    }));
    return result;
  } catch (err) {
    console.error(JSON.stringify({
      event: 'sms_failed', phone: toPhone, error: err.message, timestamp: new Date().toISOString(),
    }));
    throw err; // Re-throw so scheduler can handle retry
  }
}

/**
 * Check if SMS notifications are available.
 */
export function isSmsAvailable() {
  return features.twilio && !!config.adminAlertPhone;
}
