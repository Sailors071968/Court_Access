// ============================================================================
// CourtAccess — PM2 Ecosystem Config (FINAL STABLE — ENV FIXED)
// ============================================================================

require("dotenv").config();

module.exports = {
  apps: [
    {
      name: "courtaccess",

      script: "src/server.ts",
      cwd: "/var/www/courtaccess/backend",

      // 🔥 CRITICAL FIX — force dotenv to load BEFORE anything else
      interpreter: "npx",
      interpreter_args: "tsx -r dotenv/config",

      instances: 1,

      env: {
        NODE_ENV: "production",
        PORT: 3001,

        // 🔥 FORCE ENV PASS-THROUGH (guarantees availability)
        REDIS_URL: process.env.REDIS_URL,
        DATABASE_URL: process.env.DATABASE_URL,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,

        // 🔥 EXTRA SAFETY (ensures dotenv path is known)
        DOTENV_CONFIG_PATH: "/var/www/courtaccess/backend/.env",
      },

      // 🔥 Stability controls
      max_memory_restart: "500M",
      restart_delay: 5000,
      autorestart: true,
      watch: false,
    },
  ],
};
