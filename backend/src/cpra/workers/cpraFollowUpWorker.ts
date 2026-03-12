// ============================================================================
// Autonomous CPRA System — Follow-Up Worker
// Monitors open CPRA requests and auto-sends follow-ups after 14 days.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { sendAutonomousFollowUp } from '../services/cpraRequestEngine.js';
import { checkFollowUpEligibility } from '../services/cpraSafeguards.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const FOLLOW_UP_DAYS = parseInt(process.env.CPRA_FOLLOW_UP_DAYS ?? '14', 10);
const FOLLOW_UP_CHECK_INTERVAL_MS = parseInt(
  process.env.CPRA_FOLLOW_UP_CHECK_INTERVAL_MS ?? '3600000', // 1 hour default
  10,
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FollowUpCheckResult {
  checked: number;
  followUpsSent: number;
  skipped: number;
  errors: number;
  details: Array<{
    requestId: string;
    agencyId: string;
    agencyName: string;
    daysSinceLastContact: number;
    action: 'follow_up_sent' | 'not_eligible' | 'error';
    error?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Check and send follow-ups for overdue requests
// ---------------------------------------------------------------------------

export async function checkAndSendFollowUps(): Promise<FollowUpCheckResult> {
  const result: FollowUpCheckResult = {
    checked: 0,
    followUpsSent: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  // Find open requests that may need follow-up
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - FOLLOW_UP_DAYS);

  const openRequests = await prisma.cPRAAgencyRequest.findMany({
    where: {
      closed: false,
      responseReceived: false,
      sentAt: { not: null },
      // Last contact was more than FOLLOW_UP_DAYS ago
      OR: [
        {
          lastFollowUpAt: null,
          sentAt: { lte: cutoffDate },
        },
        {
          lastFollowUpAt: { lte: cutoffDate },
        },
      ],
    },
    include: {
      Agency: { select: { agencyName: true } },
    },
    take: 20, // Process max 20 per cycle to stay within rate limits
  });

  result.checked = openRequests.length;

  for (const request of openRequests) {
    const lastContact = request.lastFollowUpAt ?? request.sentAt;
    const daysSinceLastContact = lastContact
      ? Math.floor((Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Check eligibility
    const eligibility = await checkFollowUpEligibility(request.requestId);

    if (!eligibility.eligible) {
      result.skipped++;
      result.details.push({
        requestId: request.requestId,
        agencyId: request.agencyId,
        agencyName: request.Agency?.agencyName ?? 'Unknown',
        daysSinceLastContact,
        action: 'not_eligible',
        error: eligibility.reason ?? undefined,
      });
      continue;
    }

    // Send follow-up
    try {
      const sendResult = await sendAutonomousFollowUp(request.requestId);

      if (sendResult.success) {
        result.followUpsSent++;
        result.details.push({
          requestId: request.requestId,
          agencyId: request.agencyId,
          agencyName: request.Agency?.agencyName ?? 'Unknown',
          daysSinceLastContact,
          action: 'follow_up_sent',
        });
      } else {
        result.errors++;
        result.details.push({
          requestId: request.requestId,
          agencyId: request.agencyId,
          agencyName: request.Agency?.agencyName ?? 'Unknown',
          daysSinceLastContact,
          action: 'error',
          error: sendResult.error ?? 'Unknown error',
        });
      }

      // Rate limit: wait 3 seconds between follow-ups
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      result.errors++;
      result.details.push({
        requestId: request.requestId,
        agencyId: request.agencyId,
        agencyName: request.Agency?.agencyName ?? 'Unknown',
        daysSinceLastContact,
        action: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (result.checked > 0) {
    console.log(
      `[Follow-Up Worker] Checked ${result.checked} requests: ${result.followUpsSent} follow-ups sent, ${result.skipped} skipped, ${result.errors} errors`,
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Background worker
// ---------------------------------------------------------------------------

let followUpInterval: ReturnType<typeof setInterval> | null = null;

export function startFollowUpWorker(): void {
  if (followUpInterval) {
    console.log('[Follow-Up Worker] Already running');
    return;
  }

  console.log(`[Follow-Up Worker] Starting with ${FOLLOW_UP_CHECK_INTERVAL_MS}ms interval`);

  // Run immediately on start
  checkAndSendFollowUps().catch((err) =>
    console.error(`[Follow-Up Worker] Initial check error: ${err}`),
  );

  followUpInterval = setInterval(async () => {
    try {
      await checkAndSendFollowUps();
    } catch (error) {
      console.error(
        `[Follow-Up Worker] Error: ${error instanceof Error ? error.message : error}`,
      );
    }
  }, FOLLOW_UP_CHECK_INTERVAL_MS);
}

export function stopFollowUpWorker(): void {
  if (followUpInterval) {
    clearInterval(followUpInterval);
    followUpInterval = null;
    console.log('[Follow-Up Worker] Stopped');
  }
}

export function isFollowUpWorkerRunning(): boolean {
  return followUpInterval !== null;
}
