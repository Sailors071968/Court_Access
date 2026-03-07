// ============================================
// Court Access — PM2 Ecosystem Configuration
// Manages all platform services including monitoring workers.
// Usage: pm2 start ecosystem.config.cjs
// ============================================

module.exports = {
  apps: [
    // -----------------------------------------------------------------------
    // Main Application (Vite dev server or production serve)
    // -----------------------------------------------------------------------
    {
      name: 'courtaccess',
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
    // Queue Monitor Worker
    // Interval: every 30 seconds
    // -----------------------------------------------------------------------
    {
      name: 'queueMonitor',
      script: 'workers/runners/queueMonitorRunner.mjs',
      cwd: __dirname,
      cron_restart: '*/1 * * * *', // PM2 cron restarts every minute; internal loop handles 30s
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
        WORKER_INTERVAL_MS: '900000', // 15 minutes
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
