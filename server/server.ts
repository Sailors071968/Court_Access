// ============================================
// Court Access — Server Entry Point
// ============================================

import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/loggingUtils.js';

async function main() {
  try {
    const app = await buildApp();

    await app.listen({ port: env.PORT, host: env.HOST });

    logger.info(`Court Access API running`, {
      port: env.PORT,
      host: env.HOST,
      env: env.NODE_ENV,
    });
  } catch (error) {
    logger.error('Failed to start server', { error: (error as Error).message });
    process.exit(1);
  }
}

main();
