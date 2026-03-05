// ============================================
// Court Access — Deployment Configuration
// Phase 33: Production Deployment Pipeline
//
// Infrastructure targets:
// - AWS EC2 (backend + workers)
// - Redis (BullMQ job queue)
// - Cloudflare R2 (evidence storage)
// - Cloudflare CDN (media delivery)
// ============================================

export const deploymentConfig = {
  // Production environment
  production: {
    server: {
      port: 3001,
      host: '0.0.0.0',
      trustProxy: true,
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    },
    r2: {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucketName: process.env.R2_BUCKET_NAME || 'court-access-evidence',
      publicUrl: process.env.R2_PUBLIC_URL || '',
    },
    worker: {
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '3', 10),
      maxJobsPerMinute: parseInt(process.env.WORKER_MAX_JOBS_PER_MIN || '10', 10),
    },
    cors: {
      origins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
    },
  },

  // Staging environment
  staging: {
    server: {
      port: 3001,
      host: '0.0.0.0',
      trustProxy: true,
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      maxRetriesPerRequest: null,
    },
    worker: {
      concurrency: 2,
      maxJobsPerMinute: 5,
    },
  },

  // Development environment
  development: {
    server: {
      port: 3001,
      host: 'localhost',
      trustProxy: false,
    },
    redis: {
      url: 'redis://localhost:6379',
      maxRetriesPerRequest: null,
    },
    worker: {
      concurrency: 1,
      maxJobsPerMinute: 5,
    },
  },
};

/**
 * Required environment variables by service.
 */
export const requiredEnvVars = {
  core: ['PORT', 'NODE_ENV'],
  stripe: ['STRIPE_SECRET_KEY'],
  stripeWebhooks: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  openai: ['OPENAI_API_KEY'],
  r2: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'],
  redis: ['REDIS_URL'],
  sentry: ['SENTRY_DSN'],
  clamav: ['CLAMAV_HOST', 'CLAMAV_PORT'],
};

/**
 * Get deployment config for current environment.
 */
export function getDeploymentConfig() {
  const env = process.env.NODE_ENV || 'development';
  return deploymentConfig[env] || deploymentConfig.development;
}
