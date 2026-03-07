// Standalone entry point for hearing scheduler (PM2 compatible)
import { initScheduler, stopScheduler } from './hearingScheduler.js';

console.log('[HearingScheduler] Starting as standalone process...');
initScheduler();

process.on('SIGINT', () => { stopScheduler(); process.exit(0); });
process.on('SIGTERM', () => { stopScheduler(); process.exit(0); });
