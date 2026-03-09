// ---------------------------------------------------------------------------
// Phase 48 — CPRA Annual Update Scheduler Worker
// BullMQ worker that runs daily to check for annual updates due.
// Sends annual update request emails and follow-ups.
// ---------------------------------------------------------------------------

import { Queue, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import {
  findDueAnnualUpdates,
  findAnnualUpdatesNeedingFollowUp,
} from '../services/cpraAnnualUpdateService.js';
import {
  sendEmail,
  loadTemplate,
  mergeTemplate,
  type TemplateVariables,
} from '../services/cpraEmailSender.js';
import {
  checkDailyLimit,
  checkMinuteLimit,
  CPRA_SAFEGUARDS,
} from '../services/cpraSafeguards.js';

const prisma = new PrismaClient();

export const CPRA_ANNUAL_UPDATE_QUEUE = 'cpra-annual-update-queue';

// ---------------------------------------------------------------------------
// Job types
// ---------------------------------------------------------------------------

export interface CpraAnnualJobData {
  type: 'check_due' | 'send_annual' | 'send_annual_followup';
  updateId?: string;
  agencyId?: string;
}

export interface CpraAnnualJobResult {
  type: string;
  success: boolean;
  updateId: string | null;
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
// Send annual update email to agency
// ---------------------------------------------------------------------------

async function handleSendAnnual(
  data: CpraAnnualJobData,
): Promise<CpraAnnualJobResult> {
  if (!data.updateId || !data.agencyId) {
    return {
      type: 'send_annual',
      success: false,
      updateId: null,
      error: 'Missing updateId or agencyId',
    };
  }

  // Check rate limits
  const dailyCheck = await checkDailyLimit();
  if (!dailyCheck.allowed) {
    return {
      type: 'send_annual',
      success: false,
      updateId: data.updateId,
      error: `Daily limit reached (${dailyCheck.sentToday}/${CPRA_SAFEGUARDS.maxEmailsPerDay})`,
    };
  }

  const minuteCheck = await checkMinuteLimit();
  if (!minuteCheck.allowed) {
    return {
      type: 'send_annual',
      success: false,
      updateId: data.updateId,
      error: 'Minute limit reached',
    };
  }

  // Load agency
  const agency = await prisma.agency.findUnique({
    where: { agencyId: data.agencyId },
  });

  if (!agency) {
    return {
      type: 'send_annual',
      success: false,
      updateId: data.updateId,
      error: `Agency ${data.agencyId} not found`,
    };
  }

  // Derive email — skip if no website
  const domain =
    agency.website
      ?.replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./, '') || '';
  if (!domain) {
    return {
      type: 'send_annual',
      success: false,
      updateId: data.updateId,
      error: `Agency ${data.agencyId} has no website — cannot derive email address`,
    };
  }
  const agencyEmail = `records@${domain}`;

  // Load the annual update record to get policyReceivedAt
  const update = await prisma.cPRAAnnualUpdate.findUnique({
    where: { updateId: data.updateId },
  });

  if (!update) {
    return {
      type: 'send_annual',
      success: false,
      updateId: data.updateId,
      error: `Annual update ${data.updateId} not found`,
    };
  }

  // Get the most recent policy received date for this agency
  const latestRequest = await prisma.cPRAAgencyRequest.findFirst({
    where: {
      agencyId: data.agencyId,
      policyReceivedAt: { not: null },
    },
    orderBy: { policyReceivedAt: 'desc' },
  });

  const policyReceivedDate = latestRequest?.policyReceivedAt
    ? latestRequest.policyReceivedAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'a previous date';

  // Load and merge template
  const REQUESTER_NAME =
    process.env.CPRA_REQUESTER_NAME ?? 'CourtAccess Research Division';
  const REQUESTER_ORG = process.env.CPRA_REQUESTER_ORG ?? 'CourtAccess';

  const template = loadTemplate('cpra_annual_update_request.txt');
  const variables: TemplateVariables = {
    agencyName: agency.agencyName,
    agencyEmail,
    agencyCity: agency.city ?? '',
    agencyCounty: agency.county ?? '',
    requestDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    requesterName: REQUESTER_NAME,
    requesterOrganization: REQUESTER_ORG,
  };

  // Merge policyReceivedDate manually since it's not in standard variables
  let { subject, body } = mergeTemplate(template, variables);
  body = body.replace(/\{policyReceivedDate\}/g, policyReceivedDate);
  subject = subject.replace(/\{policyReceivedDate\}/g, policyReceivedDate);

  // Send email
  const sendResult = await sendEmail(agencyEmail, subject, body);

  if (!sendResult.error) {
    await prisma.cPRAAnnualUpdate.update({
      where: { updateId: data.updateId },
      data: {
        status: 'sent',
        requestedAt: new Date(),
      },
    });
  }

  return {
    type: 'send_annual',
    success: !sendResult.error,
    updateId: data.updateId,
    error: sendResult.error,
  };
}

// ---------------------------------------------------------------------------
// Send annual follow-up email
// ---------------------------------------------------------------------------

async function handleSendAnnualFollowup(
  data: CpraAnnualJobData,
): Promise<CpraAnnualJobResult> {
  if (!data.updateId || !data.agencyId) {
    return {
      type: 'send_annual_followup',
      success: false,
      updateId: null,
      error: 'Missing updateId or agencyId',
    };
  }

  // Check rate limits
  const dailyCheck = await checkDailyLimit();
  if (!dailyCheck.allowed) {
    return {
      type: 'send_annual_followup',
      success: false,
      updateId: data.updateId,
      error: 'Daily limit reached',
    };
  }

  const minuteCheck = await checkMinuteLimit();
  if (!minuteCheck.allowed) {
    return {
      type: 'send_annual_followup',
      success: false,
      updateId: data.updateId,
      error: 'Minute limit reached',
    };
  }

  const update = await prisma.cPRAAnnualUpdate.findUnique({
    where: { updateId: data.updateId },
  });

  if (!update) {
    return {
      type: 'send_annual_followup',
      success: false,
      updateId: data.updateId,
      error: `Annual update ${data.updateId} not found`,
    };
  }

  if (update.followUpCount >= 3) {
    return {
      type: 'send_annual_followup',
      success: false,
      updateId: data.updateId,
      error: 'Max follow-ups (3) reached',
    };
  }

  // Load agency
  const agency = await prisma.agency.findUnique({
    where: { agencyId: data.agencyId },
  });

  if (!agency) {
    return {
      type: 'send_annual_followup',
      success: false,
      updateId: data.updateId,
      error: `Agency ${data.agencyId} not found`,
    };
  }

  // Derive email
  const domain =
    agency.website
      ?.replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./, '') || '';
  if (!domain) {
    return {
      type: 'send_annual_followup',
      success: false,
      updateId: data.updateId,
      error: `Agency ${data.agencyId} has no website`,
    };
  }
  const agencyEmail = `records@${domain}`;

  // Select template based on follow-up count
  let templateName: string;
  if (update.followUpCount === 0) {
    templateName = 'cpra_annual_followup_1.txt';
  } else if (update.followUpCount === 1) {
    templateName = 'cpra_annual_followup_2.txt';
  } else {
    templateName = 'cpra_annual_final.txt';
  }

  // Get policy received date
  const latestRequest = await prisma.cPRAAgencyRequest.findFirst({
    where: {
      agencyId: data.agencyId,
      policyReceivedAt: { not: null },
    },
    orderBy: { policyReceivedAt: 'desc' },
  });

  const policyReceivedDate = latestRequest?.policyReceivedAt
    ? latestRequest.policyReceivedAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'a previous date';

  const REQUESTER_NAME =
    process.env.CPRA_REQUESTER_NAME ?? 'CourtAccess Research Division';
  const REQUESTER_ORG = process.env.CPRA_REQUESTER_ORG ?? 'CourtAccess';

  const template = loadTemplate(templateName);
  const variables: TemplateVariables = {
    agencyName: agency.agencyName,
    agencyEmail,
    agencyCity: agency.city ?? '',
    agencyCounty: agency.county ?? '',
    requestDate: update.requestedAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    requesterName: REQUESTER_NAME,
    requesterOrganization: REQUESTER_ORG,
  };

  let { subject, body } = mergeTemplate(template, variables);
  body = body.replace(/\{policyReceivedDate\}/g, policyReceivedDate);
  subject = subject.replace(/\{policyReceivedDate\}/g, policyReceivedDate);

  const sendResult = await sendEmail(agencyEmail, subject, body);

  if (!sendResult.error) {
    let newStatus: string;
    if (update.followUpCount === 0) {
      newStatus = 'follow_up_1';
    } else if (update.followUpCount === 1) {
      newStatus = 'follow_up_2';
    } else {
      newStatus = 'follow_up_final';
    }

    await prisma.cPRAAnnualUpdate.update({
      where: { updateId: data.updateId },
      data: {
        followUpCount: update.followUpCount + 1,
        lastFollowUpAt: new Date(),
        status: newStatus,
        // Close after final follow-up
        ...(update.followUpCount >= 2 ? { closed: true } : {}),
      },
    });
  }

  return {
    type: 'send_annual_followup',
    success: !sendResult.error,
    updateId: data.updateId,
    error: sendResult.error,
  };
}

// ---------------------------------------------------------------------------
// Check for due annual updates and enqueue sends
// ---------------------------------------------------------------------------

async function handleCheckDue(): Promise<CpraAnnualJobResult> {
  const connection = getRedisConnection();
  const queue = new Queue<CpraAnnualJobData>(CPRA_ANNUAL_UPDATE_QUEUE, {
    connection,
  });

  try {
    // 1. Find scheduled updates that are due
    const dueUpdates = await findDueAnnualUpdates();
    let enqueued = 0;

    for (const update of dueUpdates) {
      await queue.add(
        `annual-send-${update.updateId}`,
        {
          type: 'send_annual',
          updateId: update.updateId,
          agencyId: update.agencyId,
        },
        {
          delay: enqueued * 15_000,
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
        },
      );
      enqueued++;
    }

    // 2. Find sent updates needing follow-up
    const followUps = await findAnnualUpdatesNeedingFollowUp();

    for (const update of followUps) {
      await queue.add(
        `annual-followup-${update.updateId}`,
        {
          type: 'send_annual_followup',
          updateId: update.updateId,
          agencyId: update.agencyId,
        },
        {
          delay: enqueued * 15_000,
          attempts: 2,
          backoff: { type: 'exponential', delay: 60_000 },
        },
      );
      enqueued++;
    }

    console.log(
      `[CPRA Annual Worker] Enqueued ${dueUpdates.length} annual sends + ${followUps.length} follow-ups`,
    );
  } finally {
    await queue.close();
  }

  return {
    type: 'check_due',
    success: true,
    updateId: null,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Worker creation
// ---------------------------------------------------------------------------

export function createCpraAnnualUpdateWorker(
  onComplete?: (result: CpraAnnualJobResult) => Promise<void>,
): Worker<CpraAnnualJobData, CpraAnnualJobResult> {
  const connection = getRedisConnection();

  const worker = new Worker<CpraAnnualJobData, CpraAnnualJobResult>(
    CPRA_ANNUAL_UPDATE_QUEUE,
    async (job) => {
      console.log(
        `[CPRA Annual Worker] Processing job ${job.id} type=${job.data.type}`,
      );

      let result: CpraAnnualJobResult;

      switch (job.data.type) {
        case 'check_due':
          result = await handleCheckDue();
          break;
        case 'send_annual':
          result = await handleSendAnnual(job.data);
          break;
        case 'send_annual_followup':
          result = await handleSendAnnualFollowup(job.data);
          break;
        default:
          result = {
            type: job.data.type,
            success: false,
            updateId: null,
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
      `[CPRA Annual Worker] Job ${job?.id} failed: ${err.message}`,
    );
  });

  console.log('[CPRA Annual Worker] Annual update worker started');
  return worker;
}

// ---------------------------------------------------------------------------
// Schedule daily check (typically called by cron)
// ---------------------------------------------------------------------------

export async function scheduleDailyAnnualCheck(): Promise<void> {
  const connection = getRedisConnection();
  const queue = new Queue<CpraAnnualJobData>(CPRA_ANNUAL_UPDATE_QUEUE, {
    connection,
  });

  try {
    await queue.add(
      `annual-check-${Date.now()}`,
      { type: 'check_due' },
      { attempts: 1 },
    );
  } finally {
    await queue.close();
  }

  console.log('[CPRA Annual Worker] Daily annual check scheduled');
}
