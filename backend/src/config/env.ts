// ============================================
// Court Access — Environment Configuration
// ============================================

import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '8000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://courtaccess:courtaccess@localhost:5432/courtaccess',

  JWT_SECRET: process.env.JWT_SECRET || 'court-access-dev-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  S3_BUCKET: process.env.S3_BUCKET || 'court-access-documents',

  SES_REGION: process.env.SES_REGION || 'us-east-1',
  SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || 'noreply@courtaccess.net',

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_PRICE_BASIC: process.env.STRIPE_PRICE_BASIC || '',
  STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO || '',
  STRIPE_PRICE_ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE || '',

  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',

  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
} as const;
