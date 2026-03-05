// ============================================
// Court Access — SMS Notification Service
// Sends Twilio SMS alerts to admin on key events
// (new subscriptions, payments, cancellations).
// ============================================

import twilio from 'twilio';
import { config, features } from '../config/index.js';

let twilioClient = null;

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
 * Silently degrades if Twilio is not configured.
 */
export async function sendClientSms(toPhone, message) {
  const client = getClient();
  if (!client) {
    console.log('[SMS] Twilio not configured — skipping client SMS');
    return null;
  }

  if (!toPhone) {
    console.log('[SMS] No recipient phone number — skipping client SMS');
    return null;
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: config.twilioPhoneNumber,
      to: toPhone,
    });
    console.log(`[SMS] Client SMS sent to ${toPhone} (SID: ${result.sid})`);
    return result;
  } catch (err) {
    console.error(`[SMS] Failed to send client SMS: ${err.message}`);
    return null;
  }
}

/**
 * Check if SMS notifications are available.
 */
export function isSmsAvailable() {
  return features.twilio && !!config.adminAlertPhone;
}
