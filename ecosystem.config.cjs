// ============================================
// Court Access — PM2 Ecosystem Configuration (Stage 1 Hardened)
//
// Production Worker Management with operational hardening:
//   - Memory ceilings per process
//   - Restart throttling (delay + max restarts)
//   - Structured log paths
//   - ENV injection via DOTENV_CONFIG_PATH
//   - Safety flags for staged subsystem restoration
//
// Usage:
//   pm2 start ecosystem.config.cjs --only courtaccess-api
//   pm2 save && pm2 startup
//
// Restart:
//   pm2 restart courtaccess-api
//
// Full restart (all workers):
//   pm2 restart ecosystem.config.cjs
//
// Rollback:
//   pm2 delete courtaccess-api
//   pm2 start ecosystem.config.cjs.pre-stage1 --only courtaccess-api
//   pm2 save
//
// Crash-loop detection:
//   pm2 show courtaccess-api | grep -E 'restarts|status|uptime'
//   If restarts > 10 in quick succession, PM2 stops the process.
//   Investigate with: pm2 logs courtaccess-api --lines 100 --nostream
// ============================================

module.exports = {
  apps: [
    // -----------------------------------------------------------------------
    // Main Backend API Server (Fastify on port 3001)
    // -----------------------------------------------------------------------
    {
      name: 'courtaccess-api',
      script: 'npx',
      args: 'tsx backend/src/server.ts',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        HOST: '0.0.0.0',
        DOTENV_CONFIG_PATH: __dirname + '/backend/.env',
        // Structured logging
        LOG_LEVEL: 'info',
        // Stage 2 safety flags (remove after full restoration)
        DISABLE_WORKERS: 'true',
        SKIP_SCHEMA_ASSERT: 'true',
        CPRA_SIMULATION_MODE: 'true',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 8000,
      listen_timeout: 15000,
      error_file: '/var/log/pm2/courtaccess-api-error.log',
      out_file: '/var/log/pm2/courtaccess-api-out.log',
      merge_logs: true,
      time: true,
    },

    // -----------------------------------------------------------------------
    // Frontend: served as static files by NGINX from dist/
    // No PM2 process needed — run `npm run build` and point NGINX root to dist/
    // -----------------------------------------------------------------------

    // -----------------------------------------------------------------------
    // CPRA Email Monitor Worker
    // Polls AWS SES inbox for incoming CPRA responses
    // -----------------------------------------------------------------------
    {
      name: 'cpra-email-monitor-worker',
      script: 'npx',
      args: 'tsx backend/src/cpra/workers/cpraEmailMonitorWorker.ts',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      restart_delay: 5000,
      error_file: '/var/log/pm2/cpra-email-monitor-error.log',
      out_file: '/var/log/pm2/cpra-email-monitor-out.log',
      merge_logs: true,
      time: true,
    },

    // -----------------------------------------------------------------------
    // CPRA Follow-Up Worker
    // Sends automated follow-up emails to agencies past deadline
    // -----------------------------------------------------------------------
    {
      name: 'cpra-followup-worker',
      script: 'npx',
      args: 'tsx backend/src/cpra/workers/cpraFollowUpWorker.ts',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      restart_delay: 5000,
      error_file: '/var/log/pm2/cpra-followup-error.log',
      out_file: '/var/log/pm2/cpra-followup-out.log',
      merge_logs: true,
      time: true,
    },

    // -----------------------------------------------------------------------
    // CPRA Ingestion Worker
    // Processes received policy documents into the knowledge base
    // -----------------------------------------------------------------------
    {
      name: 'cpra-ingestion-worker',
      script: 'npx',
      args: 'tsx backend/src/cpra/workers/cpraIngestionWorker.ts',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      restart_delay: 5000,
      error_file: '/var/log/pm2/cpra-ingestion-error.log',
      out_file: '/var/log/pm2/cpra-ingestion-out.log',
      merge_logs: true,
      time: true,
    },

    // -----------------------------------------------------------------------
    // Contradiction Detection Worker
    // -----------------------------------------------------------------------
    {
      name: 'contradiction-worker',
      script: 'npx',
      args: 'tsx backend/src/contradiction/contradictionWorker.ts',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      restart_delay: 5000,
      error_file: '/var/log/pm2/contradiction-worker-error.log',
      out_file: '/var/log/pm2/contradiction-worker-out.log',
      merge_logs: true,
      time: true,
    },

    // -----------------------------------------------------------------------
    // Video Processing Worker
    // -----------------------------------------------------------------------
    {
      name: 'video-processing-worker',
      script: 'npx',
      args: 'tsx backend/src/workers/videoProcessingWorker.ts',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 5000,
      error_file: '/var/log/pm2/video-processing-error.log',
      out_file: '/var/log/pm2/video-processing-out.log',
      merge_logs: true,
      time: true,
    },

    // -----------------------------------------------------------------------
    // Doctrine Intelligence Worker
    // -----------------------------------------------------------------------
    {
      name: 'doctrine-worker',
      script: 'npx',
      args: 'tsx backend/src/doctrine/doctrineWorker.ts',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      restart_delay: 5000,
      error_file: '/var/log/pm2/doctrine-worker-error.log',
      out_file: '/var/log/pm2/doctrine-worker-out.log',
      merge_logs: true,
      time: true,
    },

    // -----------------------------------------------------------------------
    // Queue Monitor Worker (legacy)
    // Interval: every 30 seconds
    // -----------------------------------------------------------------------
    {
      name: 'queueMonitor',
      script: 'workers/runners/queueMonitorRunner.mjs',
      cwd: __dirname,
      cron_restart: '*/1 * * * *',
      env: {
        NODE_ENV: 'production',
        WORKER_INTERVAL_MS: '30000',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
    },

    // -----------------------------------------------------------------------
    // Graph Integrity Check Worker
    // Interval: every 15 minutes
    // -----------------------------------------------------------------------
    {
      name: 'graphIntegrityCheck',
      script: 'workers/runners/graphIntegrityRunner.mjs',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        WORKER_INTERVAL_MS: '900000',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
    },

    // -----------------------------------------------------------------------
    // System Health Reporter
    // Interval: every 60 seconds
    // -----------------------------------------------------------------------
    {
      name: 'systemHealth',
      script: 'workers/runners/systemHealthRunner.mjs',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        WORKER_INTERVAL_MS: '60000',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
    },
  ],
};
