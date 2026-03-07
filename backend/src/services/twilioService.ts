// ============================================
// Court Access — Twilio SMS Notification Service
// ============================================

import twilio from 'twilio';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient(): ReturnType<typeof twilio> {
  if (!twilioClient) {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }
    twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

async function sendSms(to: string, message: string): Promise<string | null> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    logger.warn('Twilio not configured — SMS not sent', { to });
    return null;
  }

  try {
    const client = getTwilioClient();
    const result = await client.messages.create({
      body: message,
      from: env.TWILIO_PHONE_NUMBER,
      to,
    });
    logger.info('SMS sent', { sid: result.sid, to });
    return result.sid;
  } catch (error) {
    logger.error('SMS send failed', { error: (error as Error).message, to });
    return null;
  }
}

export async function sendUploadAlert(phone: string, documentName: string): Promise<string | null> {
  return sendSms(
    phone,
    `Court Access: Document "${documentName}" has been uploaded to your case.`
  );
}

export async function sendAnalysisNotification(phone: string, documentName: string): Promise<string | null> {
  return sendSms(
    phone,
    `Court Access: Analysis of "${documentName}" is complete. Log in to view results.`
  );
}
