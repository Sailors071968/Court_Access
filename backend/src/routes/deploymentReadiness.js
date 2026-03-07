// ============================================
// Court Access — Deployment Readiness Routes
// Phase 44: Env var validation, startup checks, system connectivity
// ============================================

import { Router } from 'express';
import { validateConfig } from '../config/index.js';
import prisma from '../services/prismaClient.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// Required environment variables by category
// ---------------------------------------------------------------------------

const ENV_CATEGORIES = {
  database: {
    required: ['DATABASE_URL'],
    description: 'PostgreSQL connection',
  },
  ai: {
    required: ['OPENAI_API_KEY'],
    description: 'OpenAI GPT-4 for evidence analysis',
  },
  payments: {
    required: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    description: 'Stripe subscription billing',
  },
  storage: {
    required: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'],
    description: 'Cloudflare R2 evidence storage',
  },
  redis: {
    required: ['REDIS_URL'],
    optional: true,
    description: 'Redis for BullMQ job queue',
  },
  monitoring: {
    required: ['SENTRY_DSN'],
    optional: true,
    description: 'Sentry error tracking',
  },
  security: {
    required: ['JWT_SECRET'],
    description: 'JWT token signing',
  },
  sms: {
    required: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    optional: true,
    description: 'Twilio SMS notifications',
  },
};

// ---------------------------------------------------------------------------
// GET /api/admin/deployment/readiness — Full deployment readiness check
// ---------------------------------------------------------------------------

router.get('/readiness', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const checks = {};
    let allRequired = true;

    // Check each category of env vars
    for (const [category, config] of Object.entries(ENV_CATEGORIES)) {
      const missing = validateConfig(config.required);
      const isReady = missing.length === 0;

      if (!isReady && !config.optional) {
        allRequired = false;
      }

      checks[category] = {
        description: config.description,
        required: !config.optional,
        ready: isReady,
        missing: missing.length > 0 ? missing : undefined,
      };
    }

    // Database connectivity check
    let dbConnected = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch {
      dbConnected = false;
      allRequired = false;
    }
    checks.database.connected = dbConnected;

    // Redis connectivity check (non-blocking)
    let redisConnected = false;
    if (process.env.REDIS_URL) {
      try {
        const { default: Redis } = await import('ioredis');
        const redis = new Redis(process.env.REDIS_URL, { connectTimeout: 3000 });
        await redis.ping();
        redisConnected = true;
        redis.disconnect();
      } catch {
        redisConnected = false;
      }
    }
    checks.redis.connected = redisConnected;

    res.json({
      ready: allRequired && dbConnected,
      checks,
      environment: process.env.NODE_ENV || 'development',
      serverVersion: '1.0.0-beta',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Deployment] Readiness check error:', err.message);
    res.status(500).json({ error: 'Readiness check failed' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/health — Public health check (no auth required)
// ---------------------------------------------------------------------------

router.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/deployment/config — Masked config overview
// ---------------------------------------------------------------------------

router.get('/config', authenticate, requireRole('admin'), (req, res) => {
  const maskedConfig = {};

  for (const [category, catConfig] of Object.entries(ENV_CATEGORIES)) {
    maskedConfig[category] = {};
    for (const envVar of catConfig.required) {
      const value = process.env[envVar];
      if (value) {
        // Mask sensitive values: show first 4 and last 4 chars
        if (value.length > 12) {
          maskedConfig[category][envVar] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
        } else {
          maskedConfig[category][envVar] = '****';
        }
      } else {
        maskedConfig[category][envVar] = '(not set)';
      }
    }
  }

  res.json({ config: maskedConfig });
});

// ---------------------------------------------------------------------------
// Startup validation — call during server boot
// ---------------------------------------------------------------------------

export function runStartupChecks() {
  console.log('\n=== Court Access — Deployment Readiness Check ===\n');

  let hasErrors = false;

  for (const [category, catConfig] of Object.entries(ENV_CATEGORIES)) {
    const missing = validateConfig(catConfig.required);
    const status = missing.length === 0 ? 'OK' : (catConfig.optional ? 'OPTIONAL' : 'MISSING');
    const icon = missing.length === 0 ? '[+]' : (catConfig.optional ? '[~]' : '[-]');

    console.log(`  ${icon} ${category.padEnd(12)} ${status.padEnd(10)} ${catConfig.description}`);

    if (missing.length > 0) {
      console.log(`      Missing: ${missing.join(', ')}`);
      if (!catConfig.optional) hasErrors = true;
    }
  }

  console.log('');

  if (hasErrors) {
    console.log('  [!] Some required environment variables are missing.');
    console.log('  [!] The server will start but some features may not work.\n');
  } else {
    console.log('  [*] All required environment variables are set.\n');
  }

  return !hasErrors;
}

export default router;
