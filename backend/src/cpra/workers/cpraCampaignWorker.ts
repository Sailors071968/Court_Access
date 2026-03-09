// ---------------------------------------------------------------------------
// Phase 34 — CPRA Campaign Scheduler Worker
// BullMQ worker that processes CPRA campaign jobs:
//   - Send initial CPRA requests
//   - Send follow-up emails
//   - Respect daily/minute rate limits
// ---------------------------------------------------------------------------

import { Queue, Worker } from 'bullmq';
import { sendCpraRequestEmail, sendFollowUpEmail } from '../services/cpraEmailSender.js';
import { findOverdueRequests } from '../services/cpraDeadlineService.js';
import {
  checkDailyLimit,
  checkMinuteLimit,
  checkDuplicateRequest,
  CPRA_SAFEGUARDS,
} from '../services/cpraSafeguards.js';

export const CPRA_CAMPAIGN_QUEUE = 'cpra-campaign-queue';

// ---------------------------------------------------------------------------
// Job types
// ---------------------------------------------------------------------------

export interface CpraCampaignJobData {
  type: 'send_initial' | 'send_followup' | 'process_overdue';
  campaignId?: string;
  agencyId?: string;
  requestId?: string;
}

export interface CpraCampaignResult {
  type: string;
  success: boolean;
  requestId: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Redis connection
// ---------------------------------------------------------------------------

function getRedisConnection() {
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  };
}

// ---------------------------------------------------------------------------
// Send initial CPRA request with rate limit checks
// ---------------------------------------------------------------------------

async function handleSendInitial(
  data: CpraCampaignJobData,
): Promise<CpraCampaignResult> {
  if (!data.campaignId || !data.agencyId) {
    return {
      type: 'send_initial',
      success: false,
      requestId: null,
      error: 'Missing campaignId or agencyId',
    };
  }

  // Check daily limit
  const dailyCheck = await checkDailyLimit();
  if (!dailyCheck.allowed) {
    return {
      type: 'send_initial',
      success: false,
      requestId: null,
      error: `Daily limit reached (${dailyCheck.sentToday}/${CPRA_SAFEGUARDS.maxEmailsPerDay})`,
    };
  }

  // Check minute limit
  const minuteCheck = await checkMinuteLimit();
  if (!minuteCheck.allowed) {
    return {
      type: 'send_initial',
      success: false,
      requestId: null,
      error: `Minute limit reached (${minuteCheck.sentLastMinute}/${CPRA_SAFEGUARDS.maxEmailsPerMinute})`,
    };
  }

  // Check for duplicate
  const dupCheck = await checkDuplicateRequest(data.agencyId, data.campaignId);
  if (dupCheck.isDuplicate) {
    return {
      type: 'send_initial',
      success: false,
      requestId: dupCheck.existingRequestId,
      error: 'Duplicate request already exists for this agency/campaign',
    };
  }

  // Send the email
  const result = await sendCpraRequestEmail(data.agencyId, data.campaignId);

  return {
    type: 'send_initial',
    success: result.success,
    requestId: result.requestId,
    error: result.error,
  };
}

// ---------------------------------------------------------------------------
// Send follow-up with rate limit checks
// ---------------------------------------------------------------------------

async function handleSendFollowup(
  data: CpraCampaignJobData,
): Promise<CpraCampaignResult> {
  if (!data.requestId) {
    return {
      type: 'send_followup',
      success: false,
      requestId: null,
      error: 'Missing requestId',
    };
  }

  // Check daily limit
  const dailyCheck = await checkDailyLimit();
  if (!dailyCheck.allowed) {
    return {
      type: 'send_followup',
      success: false,
      requestId: data.requestId,
      error: `Daily limit reached`,
    };
  }

  const result = await sendFollowUpEmail(data.requestId);

  return {
    type: 'send_followup',
    success: result.success,
    requestId: data.requestId,
    error: result.error,
  };
}

// ---------------------------------------------------------------------------
// Process overdue requests — find and enqueue follow-ups
// ---------------------------------------------------------------------------

async function handleProcessOverdue(): Promise<CpraCampaignResult> {
  const overdueRequests = await findOverdueRequests();

  console.log(
    `[CPRA Worker] Found ${overdueRequests.length} overdue requests needing follow-up`,
  );

  const connection = getRedisConnection();
  const queue = new Queue<CpraCampaignJobData>(CPRA_CAMPAIGN_QUEUE, {
    connection,
  });

  let enqueued = 0;
  try {
    for (const request of overdueRequests) {
      await queue.add(
        `followup-${request.requestId}`,
        {
          type: 'send_followup',
          requestId: request.requestId,
        },
        {
          delay: enqueued * 15_000, // 15 seconds between follow-ups
          attempts: 2,
          backoff: { type: 'exponential', delay: 60_000 },
        },
      );
      enqueued++;
    }
  } finally {
    await queue.close();
  }

  return {
    type: 'process_overdue',
    success: true,
    requestId: null,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Worker creation
// ---------------------------------------------------------------------------

export function createCpraCampaignWorker(
  onComplete?: (result: CpraCampaignResult) => Promise<void>,
): Worker<CpraCampaignJobData, CpraCampaignResult> {
  const connection = getRedisConnection();

  const worker = new Worker<CpraCampaignJobData, CpraCampaignResult>(
    CPRA_CAMPAIGN_QUEUE,
    async (job) => {
      console.log(
        `[CPRA Worker] Processing job ${job.id} type=${job.data.type}`,
      );

      let result: CpraCampaignResult;

      switch (job.data.type) {
        case 'send_initial':
          result = await handleSendInitial(job.data);
          break;
        case 'send_followup':
          result = await handleSendFollowup(job.data);
          break;
        case 'process_overdue':
          result = await handleProcessOverdue();
          break;
        default:
          result = {
            type: job.data.type,
            success: false,
            requestId: null,
            error: `Unknown job type: ${job.data.type}`,
          };
      }

      if (onComplete) {
        await onComplete(result);
      }

      return result;
    },
    {
      connection,
      concurrency: CPRA_SAFEGUARDS.maxConcurrentSends,
      limiter: {
        max: CPRA_SAFEGUARDS.maxEmailsPerMinute,
        duration: 60_000,
      },
    },
  );

  worker.on('failed', (job, err) => {
    console.error(
      `[CPRA Worker] Job ${job?.id} failed: ${err.message}`,
    );
  });

  console.log('[CPRA Worker] Campaign worker started');
  return worker;
}

// ---------------------------------------------------------------------------
// Enqueue a campaign batch — sends initial CPRA requests to all agencies
// ---------------------------------------------------------------------------

export async function enqueueCampaignBatch(
  campaignId: string,
  agencyIds: string[],
): Promise<{ enqueued: number; skipped: number }> {
  const connection = getRedisConnection();
  const queue = new Queue<CpraCampaignJobData>(CPRA_CAMPAIGN_QUEUE, {
    connection,
  });

  let enqueued = 0;
  let skipped = 0;

  try {
    for (const agencyId of agencyIds) {
      // Check for existing request
      const dupCheck = await checkDuplicateRequest(agencyId, campaignId);
      if (dupCheck.isDuplicate) {
        skipped++;
        continue;
      }

      await queue.add(
        `initial-${campaignId}-${agencyId}`,
        {
          type: 'send_initial',
          campaignId,
          agencyId,
        },
        {
          delay: enqueued * 15_000, // Stagger sends by 15 seconds
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
        },
      );
      enqueued++;
    }
  } finally {
    await queue.close();
  }

  return { enqueued, skipped };
}

// ---------------------------------------------------------------------------
// Schedule overdue check (typically called by cron)
// ---------------------------------------------------------------------------

export async function scheduleOverdueCheck(): Promise<void> {
  const connection = getRedisConnection();
  const queue = new Queue<CpraCampaignJobData>(CPRA_CAMPAIGN_QUEUE, {
    connection,
  });

  try {
    await queue.add(
      `overdue-check-${Date.now()}`,
      { type: 'process_overdue' },
      { attempts: 1 },
    );
  } finally {
    await queue.close();
  }

  console.log('[CPRA Worker] Overdue check scheduled');
}
