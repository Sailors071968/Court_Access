// ============================================================================
// CourtAccess — Discount Code Expiration Worker
// Phase 228: Scheduled job to automatically deactivate expired discount codes
// Runs daily — checks all active codes and disables any past their expiresAt date
// ============================================================================

import { deactivateExpiredCodes } from '../models/discountCode';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Run a single expiration check — deactivates all codes past their expiresAt date.
 * Returns the number of codes deactivated.
 */
export async function runExpirationCheck(): Promise<number> {
  const deactivated = await deactivateExpiredCodes();
  if (deactivated > 0) {
    console.log(
      `[DiscountExpirationWorker] Deactivated ${deactivated} expired discount code(s) at ${new Date().toISOString()}`
    );
  }
  return deactivated;
}

/**
 * Start the daily expiration worker.
 * Runs immediately on start, then every 24 hours.
 */
export function startExpirationWorker(): void {
  if (intervalId !== null) {
    console.log('[DiscountExpirationWorker] Worker already running');
    return;
  }

  console.log('[DiscountExpirationWorker] Starting daily expiration check');
  void runExpirationCheck().catch((err) => console.error('[DiscountExpirationWorker] Expiration check failed:', err));
  intervalId = setInterval(() => { void runExpirationCheck().catch((err) => console.error('[DiscountExpirationWorker] Expiration check failed:', err)); }, ONE_DAY_MS);
}

/**
 * Stop the expiration worker.
 */
export function stopExpirationWorker(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[DiscountExpirationWorker] Stopped');
  }
}
