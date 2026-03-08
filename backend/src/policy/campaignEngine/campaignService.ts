// ============================================
// Court Access — Campaign Service
// Orchestrates CPRA policy request campaigns.
// ============================================

import { PrismaClient } from '@prisma/client';
import { sendCpraEmail } from './emailSender.js';
import {
  generateTrackingId,
  createPolicyRequest,
  countSentThisHour,
} from './requestTracker.js';
import type {
  SendCampaignInput,
  CampaignBatchResult,
  SendResult,
  RateLimitConfig,
} from './types.js';

// ---------------------------------------------------------------------------
// Singleton Prisma Client
// ---------------------------------------------------------------------------

let prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// ---------------------------------------------------------------------------
// Default Rate Limit (re-export for convenience)
// ---------------------------------------------------------------------------

const RATE_LIMIT: RateLimitConfig = {
  maxPerHour: 50,
  maxPerBatch: 25,
  delayBetweenMs: 2000,
};

// ---------------------------------------------------------------------------
// Sleep Helper
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Send Campaign
// ---------------------------------------------------------------------------

/**
 * Send CPRA policy requests to matching agencies.
 * Respects rate limits and tracks all sent requests in the database.
 */
export async function sendCampaign(
  input: SendCampaignInput,
  rateLimit: RateLimitConfig = RATE_LIMIT
): Promise<CampaignBatchResult> {
  const db = getPrisma();

  // Build agency filter
  const agencyWhere: Record<string, unknown> = {
    recordsEmail: { not: null },
  };

  if (input.county) agencyWhere.county = input.county;
  if (input.agencyType) agencyWhere.agencyType = input.agencyType;

  // If onlyNew, exclude agencies that already have a request
  if (input.onlyNew) {
    agencyWhere.policyRequests = { none: {} };
  }

  // Fetch matching agencies
  const agencies = await db.agency.findMany({
    where: agencyWhere,
    select: {
      id: true,
      agencyName: true,
      recordsEmail: true,
    },
    orderBy: [{ county: 'asc' }, { agencyName: 'asc' }],
  });

  // Check rate limit: how many can we still send this hour?
  const sentThisHour = await countSentThisHour();
  const remaining = Math.max(0, rateLimit.maxPerHour - sentThisHour);
  const batchSize = Math.min(agencies.length, remaining, rateLimit.maxPerBatch);

  const results: SendResult[] = [];
  let totalSent = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (let i = 0; i < agencies.length; i++) {
    const agency = agencies[i];

    // Enforce batch size limit
    if (totalSent + totalFailed >= batchSize) {
      totalSkipped++;
      continue;
    }

    // Skip agencies without email (shouldn't happen due to filter, but defensive)
    if (!agency.recordsEmail) {
      totalSkipped++;
      continue;
    }

    const trackingId = generateTrackingId();

    try {
      // Send email via SES
      const emailResult = await sendCpraEmail({
        toEmail: agency.recordsEmail,
        agencyName: agency.agencyName,
        trackingId,
      });

      if (emailResult.success) {
        // Track in database
        await createPolicyRequest({
          agencyId: agency.id,
          trackingId,
          sesMessageId: emailResult.messageId,
        });

        // Update agency's lastRequestSent
        await db.agency.update({
          where: { id: agency.id },
          data: { lastRequestSent: new Date() },
        });

        results.push({
          agencyId: agency.id,
          agencyName: agency.agencyName,
          trackingId,
          success: true,
          sesMessageId: emailResult.messageId,
        });
        totalSent++;
      } else {
        // Track failed attempt
        await createPolicyRequest({
          agencyId: agency.id,
          trackingId,
        });

        results.push({
          agencyId: agency.id,
          agencyName: agency.agencyName,
          trackingId,
          success: false,
          error: emailResult.error,
        });
        totalFailed++;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      results.push({
        agencyId: agency.id,
        agencyName: agency.agencyName,
        trackingId,
        success: false,
        error: errorMsg,
      });
      totalFailed++;
    }

    // Rate limiting delay between emails
    if (i < agencies.length - 1 && totalSent + totalFailed < batchSize) {
      await sleep(rateLimit.delayBetweenMs);
    }
  }

  return {
    totalTargeted: agencies.length,
    totalSent,
    totalFailed,
    totalSkipped,
    results,
  };
}
