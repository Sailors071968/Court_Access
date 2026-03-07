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
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',

  // Sentry
  sentryDsn: process.env.SENTRY_DSN || '',

  // Twilio SMS
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  adminAlertPhone: process.env.ADMIN_ALERT_PHONE || '',

  // SES Email
  sesRegion: process.env.SES_REGION || '',
  sesAccessKeyId: process.env.SES_ACCESS_KEY_ID || '',
  sesSecretAccessKey: process.env.SES_SECRET_ACCESS_KEY || '',
  emailSandboxMode: process.env.EMAIL_SANDBOX_MODE !== 'false',
  staffAlertEmail: process.env.STAFF_ALERT_EMAIL || '',

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
 * Phase 99: Production environment validation.
 * Required variables that MUST be present for production startup.
 * In development, missing variables produce warnings instead of fatal errors.
 */
const REQUIRED_PRODUCTION_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'OPENAI_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'REDIS_URL',
  'EMAIL_SANDBOX_MODE',
];

/**
 * Phase 99: Validate all required production environment variables.
 * In production: missing vars cause server to refuse to start.
 * In development: missing vars are logged as warnings.
 */
export function validateProductionEnvironment() {
  const missing = validateConfig(REQUIRED_PRODUCTION_VARS);
  const isProduction = config.nodeEnv === 'production';

  if (missing.length > 0) {
    const message = `[Config] Missing required environment variables: ${missing.join(', ')}`;

    if (isProduction) {
      console.error(`\n\x1b[31m${'='.repeat(60)}`);
      console.error('FATAL: Server refusing to start — missing required config');
      console.error(`${'='.repeat(60)}\x1b[0m`);
      console.error(message);
      console.error('\nSet all required variables before starting in production.\n');
      process.exit(1);
    } else {
      console.warn(`\n\x1b[33m[Config] WARNING: ${missing.length} production variable(s) missing:\x1b[0m`);
      for (const v of missing) {
        console.warn(`  \x1b[33m- ${v}\x1b[0m`);
      }
      console.warn('  (Non-fatal in development mode)\n');
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
  get ses() { return !!config.sesAccessKeyId && !!config.sesSecretAccessKey; },
};
