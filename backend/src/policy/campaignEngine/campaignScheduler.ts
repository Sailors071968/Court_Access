// ============================================
// Court Access — Campaign Scheduler
// Manages scheduled campaign execution and rate-limited batch sending.
// ============================================

import { sendCampaign } from './campaignService.js';
import { countSentThisHour, getCampaignStats } from './requestTracker.js';
import type { SendCampaignInput, CampaignBatchResult, RateLimitConfig } from './types.js';

// ---------------------------------------------------------------------------
// Scheduler State
// ---------------------------------------------------------------------------

interface SchedulerState {
  isRunning: boolean;
  lastRun: Date | null;
  lastResult: CampaignBatchResult | null;
  intervalId: ReturnType<typeof setInterval> | null;
}

const state: SchedulerState = {
  isRunning: false,
  lastRun: null,
  lastResult: null,
  intervalId: null,
};

// ---------------------------------------------------------------------------
// Default Schedule Config
// ---------------------------------------------------------------------------

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Start Scheduler
// ---------------------------------------------------------------------------

/**
 * Start the campaign scheduler. Runs campaigns at a fixed interval.
 * Only sends to agencies that haven't been contacted yet.
 */
export function startScheduler(
  input: SendCampaignInput = { onlyNew: true },
  intervalMs: number = DEFAULT_INTERVAL_MS
): void {
  if (state.isRunning) {
    console.log('[CampaignScheduler] Already running — skipping start');
    return;
  }

  state.isRunning = true;
  console.log(`[CampaignScheduler] Starting with interval ${intervalMs}ms`);

  // Run immediately on start
  void runCampaignCycle(input);

  // Then run on interval
  state.intervalId = setInterval(() => {
    void runCampaignCycle(input);
  }, intervalMs);
}

// ---------------------------------------------------------------------------
// Stop Scheduler
// ---------------------------------------------------------------------------

export function stopScheduler(): void {
  if (!state.isRunning) {
    console.log('[CampaignScheduler] Not running — nothing to stop');
    return;
  }

  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  state.isRunning = false;
  console.log('[CampaignScheduler] Stopped');
}

// ---------------------------------------------------------------------------
// Get Scheduler Status
// ---------------------------------------------------------------------------

export interface SchedulerStatus {
  isRunning: boolean;
  lastRun: string | null;
  lastResult: CampaignBatchResult | null;
  sentThisHour: number;
  maxPerHour: number;
}

export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  const sentThisHour = await countSentThisHour();

  return {
    isRunning: state.isRunning,
    lastRun: state.lastRun ? state.lastRun.toISOString() : null,
    lastResult: state.lastResult,
    sentThisHour,
    maxPerHour: 50,
  };
}

// ---------------------------------------------------------------------------
// Run Single Campaign Cycle
// ---------------------------------------------------------------------------

async function runCampaignCycle(input: SendCampaignInput): Promise<void> {
  try {
    // Check rate limit before running
    const sentThisHour = await countSentThisHour();
    if (sentThisHour >= 50) {
      console.log(`[CampaignScheduler] Rate limit reached (${sentThisHour}/50 this hour) — skipping cycle`);
      return;
    }

    console.log(`[CampaignScheduler] Running campaign cycle — ${sentThisHour}/50 sent this hour`);

    const result = await sendCampaign(input);

    state.lastRun = new Date();
    state.lastResult = result;

    console.log(
      `[CampaignScheduler] Cycle complete — sent: ${result.totalSent}, failed: ${result.totalFailed}, skipped: ${result.totalSkipped}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[CampaignScheduler] Cycle failed: ${msg}`);
  }
}
