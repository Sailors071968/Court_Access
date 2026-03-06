// ============================================
// Court Access — Centralized Configuration
// All environment variables loaded and validated here.
// ============================================

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Redis (BullMQ)
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',

  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY || '',

  // Cloudflare R2
  r2AccountId: process.env.R2_ACCOUNT_ID || '',
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  r2BucketName: process.env.R2_BUCKET_NAME || 'court-access-evidence',
  r2PublicUrl: process.env.R2_PUBLIC_URL || '',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'court-access-dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',

  // Sentry
  sentryDsn: process.env.SENTRY_DSN || '',

  // Twilio SMS
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  adminAlertPhone: process.env.ADMIN_ALERT_PHONE || '',

  // ClamAV
  clamavHost: process.env.CLAMAV_HOST || 'localhost',
  clamavPort: parseInt(process.env.CLAMAV_PORT || '3310', 10),

  // File Upload Limits
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10),

  // Database
  databaseUrl: process.env.DATABASE_URL || '',
};

/**
 * Validates that required environment variables are present.
 * Accepts raw env var names (e.g. 'STRIPE_SECRET_KEY') and checks process.env directly.
 * Returns an array of missing env var names.
 */
export function validateConfig(requiredKeys = []) {
  const missing = [];
  for (const key of requiredKeys) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  return missing;
}

/**
 * Checks if a feature is enabled based on config availability.
 */
export const features = {
  get redis() { return !!process.env.REDIS_URL; },
  get stripe() { return !!config.stripeSecretKey; },
  get openai() { return !!config.openaiApiKey; },
  get r2() { return !!config.r2AccessKeyId && !!config.r2SecretAccessKey; },
  get sentry() { return !!config.sentryDsn; },
  get twilio() { return !!config.twilioAccountSid && !!config.twilioAuthToken && !!config.twilioPhoneNumber; },
  get clamav() { return !!process.env.CLAMAV_HOST; },
};
