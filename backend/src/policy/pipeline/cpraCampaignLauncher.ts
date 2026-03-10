// ============================================================================
// Phase 78 — CPRA Campaign Launch (Controlled)
// Send CPRA requests to the first 25 agencies.
// Limits: 20 emails/day maximum.
// Goal: Verify the response processing pipeline.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { enqueueCampaignBatch } from '../../cpra/workers/cpraCampaignWorker.js';
import { prepareCpraRequestQueue, type CpraQueueEntry } from './cpraRequestPreparation.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CampaignLaunchResult {
  campaignId: string;
  campaignName: string;
  status: 'launched' | 'partial' | 'failed';
  targetAgencies: number;
  agenciesEnqueued: number;
  agenciesSkipped: number;
  dailyLimit: number;
  estimatedCompletionDays: number;
  launchedAt: string;
  agencyDetails: CampaignAgencyDetail[];
  errors: string[];
}

export interface CampaignAgencyDetail {
  agencyId: string;
  agencyName: string;
  email: string | null;
  missingPolicies: number;
  criticalMissing: number;
  status: 'enqueued' | 'skipped' | 'error';
  reason: string | null;
}

export interface CampaignLaunchConfig {
  maxAgencies: number;       // default: 25
  dailyEmailLimit: number;   // default: 20
  campaignName?: string;
  dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_LAUNCH_CONFIG: CampaignLaunchConfig = {
  maxAgencies: 25,
  dailyEmailLimit: 20,
  campaignName: `Phase 78 CPRA Campaign — ${new Date().toISOString().slice(0, 10)}`,
  dryRun: false,
};

// ---------------------------------------------------------------------------
// Main: Launch controlled CPRA campaign
// ---------------------------------------------------------------------------

export async function launchCpraCampaign(
  config: Partial<CampaignLaunchConfig> = {},
): Promise<CampaignLaunchResult> {
  const cfg = { ...DEFAULT_LAUNCH_CONFIG, ...config };
  const errors: string[] = [];
  const agencyDetails: CampaignAgencyDetail[] = [];

  console.log(`[Phase 78] Launching CPRA campaign: ${cfg.campaignName}`);
  console.log(`[Phase 78] Target: ${cfg.maxAgencies} agencies, ${cfg.dailyEmailLimit} emails/day`);

  try {
    // Step 1: Prepare the CPRA queue (from Phase 77)
    const queueResult = await prepareCpraRequestQueue(cfg.maxAgencies);
    const targetQueue = queueResult.queue.slice(0, cfg.maxAgencies);

    console.log(`[Phase 78] Queue prepared: ${targetQueue.length} agencies targeted`);

    if (targetQueue.length === 0) {
      return {
        campaignId: '',
        campaignName: cfg.campaignName!,
        status: 'failed',
        targetAgencies: 0,
        agenciesEnqueued: 0,
        agenciesSkipped: 0,
        dailyLimit: cfg.dailyEmailLimit,
        estimatedCompletionDays: 0,
        launchedAt: new Date().toISOString(),
        agencyDetails: [],
        errors: ['No agencies in queue — all agencies may have full coverage or no website'],
      };
    }

    // Step 2: Create campaign record
    const campaign = await prisma.cPRARequestCampaign.create({
      data: {
        campaignName: cfg.campaignName!,
        active: true,
      },
    });

    console.log(`[Phase 78] Campaign created: ${campaign.campaignId}`);

    // Step 3: Validate and filter agencies
    const validAgencies: CpraQueueEntry[] = [];
    let skipped = 0;

    for (const entry of targetQueue) {
      // Check if agency already has an active CPRA request
      const existingRequest = await prisma.cPRAAgencyRequest.findFirst({
        where: {
          agencyId: entry.agencyId,
          closed: false,
        },
      });

      if (existingRequest) {
        agencyDetails.push({
          agencyId: entry.agencyId,
          agencyName: entry.agencyName,
          email: entry.estimatedEmail,
          missingPolicies: entry.missingPolicies.length,
          criticalMissing: entry.missingPolicies.filter((p) => p.isCritical).length,
          status: 'skipped',
          reason: `Active CPRA request exists (${existingRequest.requestId})`,
        });
        skipped++;
        continue;
      }

      if (!entry.estimatedEmail) {
        agencyDetails.push({
          agencyId: entry.agencyId,
          agencyName: entry.agencyName,
          email: null,
          missingPolicies: entry.missingPolicies.length,
          criticalMissing: entry.missingPolicies.filter((p) => p.isCritical).length,
          status: 'skipped',
          reason: 'No email address derivable from website',
        });
        skipped++;
        continue;
      }

      validAgencies.push(entry);
      agencyDetails.push({
        agencyId: entry.agencyId,
        agencyName: entry.agencyName,
        email: entry.estimatedEmail,
        missingPolicies: entry.missingPolicies.length,
        criticalMissing: entry.missingPolicies.filter((p) => p.isCritical).length,
        status: 'enqueued',
        reason: null,
      });
    }

    console.log(`[Phase 78] Valid agencies: ${validAgencies.length}, Skipped: ${skipped}`);

    // Step 4: Enqueue campaign batch (if not dry run)
    let enqueued = 0;
    if (!cfg.dryRun && validAgencies.length > 0) {
      try {
        const agencyIds = validAgencies.map((a) => a.agencyId);
        const batchResult = await enqueueCampaignBatch(
          campaign.campaignId,
          agencyIds,
        );
        enqueued = batchResult.enqueued;
        console.log(`[Phase 78] Enqueued: ${enqueued}, Skipped by worker: ${batchResult.skipped}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Enqueue failed: ${msg}`);
        console.error(`[Phase 78] Enqueue error: ${msg}`);
      }
    } else if (cfg.dryRun) {
      enqueued = validAgencies.length;
      console.log(`[Phase 78] DRY RUN — would enqueue ${enqueued} agencies`);
    }

    // Step 5: Calculate estimated completion
    const estimatedCompletionDays = Math.ceil(enqueued / cfg.dailyEmailLimit);

    const status = enqueued > 0 ? 'launched' : validAgencies.length > 0 ? 'partial' : 'failed';

    console.log(
      `[Phase 78] Campaign ${status}: ${enqueued}/${validAgencies.length} enqueued, ` +
      `est. ${estimatedCompletionDays} days to complete`,
    );

    return {
      campaignId: campaign.campaignId,
      campaignName: cfg.campaignName!,
      status,
      targetAgencies: targetQueue.length,
      agenciesEnqueued: enqueued,
      agenciesSkipped: skipped,
      dailyLimit: cfg.dailyEmailLimit,
      estimatedCompletionDays,
      launchedAt: new Date().toISOString(),
      agencyDetails,
      errors,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`Fatal: ${msg}`);
    console.error(`[Phase 78] Fatal error: ${msg}`);

    return {
      campaignId: '',
      campaignName: cfg.campaignName!,
      status: 'failed',
      targetAgencies: 0,
      agenciesEnqueued: 0,
      agenciesSkipped: 0,
      dailyLimit: cfg.dailyEmailLimit,
      estimatedCompletionDays: 0,
      launchedAt: new Date().toISOString(),
      agencyDetails,
      errors,
    };
  }
}

// ---------------------------------------------------------------------------
// Get active campaign status
// ---------------------------------------------------------------------------

export async function getActiveCampaignStatus(): Promise<{
  activeCampaigns: number;
  totalRequestsSent: number;
  totalResponsesReceived: number;
  pendingFollowUps: number;
  dailySendCount: number;
  dailyLimit: number;
  campaigns: Array<{
    campaignId: string;
    campaignName: string;
    requestCount: number;
    sentCount: number;
    respondedCount: number;
    closedCount: number;
  }>;
}> {
  const campaigns = await prisma.cPRARequestCampaign.findMany({
    where: { active: true },
    include: {
      requests: {
        select: {
          status: true,
          sentAt: true,
          responseReceived: true,
          closed: true,
        },
      },
    },
  });

  // Count today's sends
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dailySendCount = await prisma.cPRAAgencyRequest.count({
    where: {
      sentAt: { gte: todayStart },
    },
  });

  const campaignSummaries = campaigns.map((c) => ({
    campaignId: c.campaignId,
    campaignName: c.campaignName,
    requestCount: c.requests.length,
    sentCount: c.requests.filter((r) => r.sentAt !== null).length,
    respondedCount: c.requests.filter((r) => r.responseReceived).length,
    closedCount: c.requests.filter((r) => r.closed).length,
  }));

  const totalSent = campaignSummaries.reduce((s, c) => s + c.sentCount, 0);
  const totalResponded = campaignSummaries.reduce((s, c) => s + c.respondedCount, 0);

  return {
    activeCampaigns: campaigns.length,
    totalRequestsSent: totalSent,
    totalResponsesReceived: totalResponded,
    pendingFollowUps: totalSent - totalResponded - campaignSummaries.reduce((s, c) => s + c.closedCount, 0),
    dailySendCount,
    dailyLimit: 20,
    campaigns: campaignSummaries,
  };
}
