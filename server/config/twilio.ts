// ============================================
// Court Access — Twilio Configuration
// ============================================

import twilio from 'twilio';
import { env } from './env.js';

let twilioClient: ReturnType<typeof twilio> | null = null;

export function getTwilioClient(): ReturnType<typeof twilio> {
  if (!twilioClient) {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials are not configured');
    }
    twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}
