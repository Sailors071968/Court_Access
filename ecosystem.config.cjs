// ============================================
// Court Access — PM2 Ecosystem Configuration
// Phase 8: Production Worker Management
// All workers: auto-restart on crash, startup on boot
// Usage: pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
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
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: '/var/log/pm2/courtaccess-api-error.log',
      out_file: '/var/log/pm2/courtaccess-api-out.log',
      merge_logs: true,
      time: true,
    },

    // -----------------------------------------------------------------------
    // Frontend Preview Server (Vite production serve)
    // -----------------------------------------------------------------------
    {
      name: 'courtaccess-frontend',
      script: 'npx',
      args: 'vite preview --port 4173',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
    },

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
