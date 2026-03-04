// ============================================
// Court Access — Twilio SMS Service
// ============================================

import { getTwilioClient } from '../config/twilio.js';
import { env } from '../config/env.js';
import { logger } from '../utils/loggingUtils.js';
import { createNotification, updateNotificationStatus } from './notificationService.js';

export interface SendSmsInput {
  tenantId: string;
  userId: string;
  to: string;
  message: string;
  type: string;
}

/**
 * Send an SMS notification via Twilio and log it.
 */
export async function sendSms(input: SendSmsInput) {
  // Create notification record first
  const notification = await createNotification({
    tenantId: input.tenantId,
    userId: input.userId,
    type: input.type,
    channel: 'sms',
    message: input.message,
  });

  try {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      logger.warn('Twilio not configured — SMS not sent');
      await updateNotificationStatus(notification.id, 'skipped');
      return { ...notification, sentStatus: 'skipped' };
    }

    const client = getTwilioClient();
    const twilioMessage = await client.messages.create({
      body: input.message,
      from: env.TWILIO_PHONE_NUMBER,
      to: input.to,
    });

    await updateNotificationStatus(notification.id, 'sent', twilioMessage.sid);

    logger.info('SMS sent', {
      notificationId: notification.id,
      twilioSid: twilioMessage.sid,
      to: input.to,
    });

    return { ...notification, sentStatus: 'sent', twilioSid: twilioMessage.sid };
  } catch (error) {
    logger.error('SMS send failed', { error: (error as Error).message });
    await updateNotificationStatus(notification.id, 'failed');
    return { ...notification, sentStatus: 'failed' };
  }
}

/**
 * Send document upload notification SMS.
 */
export async function sendUploadNotification(
  tenantId: string,
  userId: string,
  phone: string,
  documentName: string
) {
  return sendSms({
    tenantId,
    userId,
    to: phone,
    message: `Court Access: Document "${documentName}" has been uploaded to your case.`,
    type: 'document_upload',
  });
}

/**
 * Send analysis completion notification SMS.
 */
export async function sendAnalysisCompleteNotification(
  tenantId: string,
  userId: string,
  phone: string,
  documentName: string
) {
  return sendSms({
    tenantId,
    userId,
    to: phone,
    message: `Court Access: Analysis of "${documentName}" is complete. Log in to view results.`,
    type: 'analysis_complete',
  });
}
