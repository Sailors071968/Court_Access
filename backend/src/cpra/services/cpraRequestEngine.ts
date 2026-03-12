// ============================================================================
// Autonomous CPRA System — Request Engine
// Sends CPRA requests to agencies, logs emails, updates matrix status.
// Wraps existing cpraEmailSender with autonomous logging + notifications.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { sendCpraRequestEmail, sendFollowUpEmail } from './cpraEmailSender.js';
import { logEmail } from './cpraEmailLogService.js';
import { createNotification } from './cpraNotificationService.js';
import { addTimelineEvent } from './cpraTimelineService.js';
import { CANONICAL_POLICY_TOPICS } from './cpraMatrixService.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CpraRequestResult {
  agencyId: string;
  agencyName: string;
  success: boolean;
  requestId: string | null;
  emailLogId: string | null;
  error: string | null;
}

export interface BatchRequestResult {
  totalRequested: number;
  successful: number;
  failed: number;
  results: CpraRequestResult[];
}

// ---------------------------------------------------------------------------
// Send CPRA request to a single agency (with logging + notifications)
// ---------------------------------------------------------------------------

export async function sendAutonomousCpraRequest(
  agencyId: string,
  campaignId: string,
): Promise<CpraRequestResult> {
  // Load agency data
  const agency = await prisma.agency.findUnique({
    where: { agencyId },
  });

  if (!agency) {
    return {
      agencyId,
      agencyName: 'Unknown',
      success: false,
      requestId: null,
      emailLogId: null,
      error: `Agency ${agencyId} not found`,
    };
  }

  // Send the CPRA request email
  const sendResult = await sendCpraRequestEmail(agencyId, campaignId);

  if (!sendResult.success) {
    return {
      agencyId,
      agencyName: agency.agencyName,
      success: false,
      requestId: null,
      emailLogId: null,
      error: sendResult.error,
    };
  }

  // Derive email address (same logic as cpraEmailSender)
  const domain = agency.website?.replace(/^https?:\/\//, '').replace(/[/:].*$/, '').replace(/^www\./, '') || '';
  const agencyEmail = domain ? `records@${domain}` : 'unknown';

  // Log the outbound email
  const emailLog = await logEmail({
    agencyId,
    direction: 'OUTBOUND',
    emailAddress: agencyEmail,
    subject: 'California Public Records Act Request',
    body: '[CPRA request template sent]',
    requestId: sendResult.requestId,
    policyTopics: CANONICAL_POLICY_TOPICS.map((t) => t.topicName),
    sesMessageId: sendResult.messageId ?? undefined,
  });

  // Update matrix entries for this agency — mark all as REQUESTED
  for (const topic of CANONICAL_POLICY_TOPICS) {
    await prisma.agencyPolicyMatrix.upsert({
      where: {
        agencyId_topicId: {
          agencyId,
          topicId: topic.topicName,
        },
      },
      update: {
        status: 'REQUESTED',
        requestDate: new Date(),
      },
      create: {
        agencyId,
        topicId: topic.topicName,
        status: 'REQUESTED',
        requestDate: new Date(),
      },
    });
  }

  // Create notification
  await createNotification({
    agencyId,
    eventType: 'EMAIL_SENT',
    title: `CPRA request sent to ${agency.agencyName}`,
    message: `Initial CPRA request sent to ${agencyEmail}. Requesting all ${CANONICAL_POLICY_TOPICS.length} policy topics.`,
    metadata: {
      requestId: sendResult.requestId,
      emailLogId: emailLog.emailId,
      agencyEmail,
    },
  });

  // Add timeline event
  await addTimelineEvent({
    agencyId,
    eventType: 'REQUEST_SENT',
    title: `CPRA request sent`,
    description: `Initial request sent to ${agencyEmail} for ${CANONICAL_POLICY_TOPICS.length} policy topics`,
    metadata: {
      requestId: sendResult.requestId,
      emailLogId: emailLog.emailId,
      campaignId,
    },
  });

  return {
    agencyId,
    agencyName: agency.agencyName,
    success: true,
    requestId: sendResult.requestId,
    emailLogId: emailLog.emailId,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Send CPRA requests to multiple agencies
// ---------------------------------------------------------------------------

export async function sendBatchCpraRequests(
  agencyIds: string[],
  campaignId: string,
): Promise<BatchRequestResult> {
  const results: CpraRequestResult[] = [];
  let successful = 0;
  let failed = 0;

  for (const agencyId of agencyIds) {
    const result = await sendAutonomousCpraRequest(agencyId, campaignId);
    results.push(result);
    if (result.success) {
      successful++;
    } else {
      failed++;
    }

    // Rate limiting: wait 2 seconds between sends
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return {
    totalRequested: agencyIds.length,
    successful,
    failed,
    results,
  };
}

// ---------------------------------------------------------------------------
// Send CPRA requests to all agencies with NOT_REQUESTED status
// ---------------------------------------------------------------------------

export async function sendCpraRequestsToAllMissing(
  campaignId: string,
): Promise<BatchRequestResult> {
  // Find agencies that have NOT_REQUESTED policies or no matrix entries
  const agencies = await prisma.agency.findMany({
    where: { website: { not: null } },
    select: { agencyId: true },
  });

  // Filter to agencies that don't have an active (non-closed) CPRA request
  const agencyIdsWithActiveRequests = new Set(
    (
      await prisma.cPRAAgencyRequest.findMany({
        where: { closed: false },
        select: { agencyId: true },
      })
    ).map((r) => r.agencyId),
  );

  const targetAgencyIds = agencies
    .map((a) => a.agencyId)
    .filter((id) => !agencyIdsWithActiveRequests.has(id));

  return sendBatchCpraRequests(targetAgencyIds, campaignId);
}

// ---------------------------------------------------------------------------
// Send autonomous follow-up for a specific request
// ---------------------------------------------------------------------------

export async function sendAutonomousFollowUp(
  requestId: string,
): Promise<CpraRequestResult> {
  const request = await prisma.cPRAAgencyRequest.findUnique({
    where: { requestId },
  });

  if (!request) {
    return {
      agencyId: '',
      agencyName: 'Unknown',
      success: false,
      requestId,
      emailLogId: null,
      error: 'Request not found',
    };
  }

  const agency = await prisma.agency.findUnique({
    where: { agencyId: request.agencyId },
  });

  const result = await sendFollowUpEmail(requestId);

  if (result.success) {
    const domain = agency?.website?.replace(/^https?:\/\//, '').replace(/[/:].*$/, '').replace(/^www\./, '') || '';
    const agencyEmail = domain ? `records@${domain}` : 'unknown';

    // Log follow-up email
    const emailLog = await logEmail({
      agencyId: request.agencyId,
      direction: 'OUTBOUND',
      emailAddress: agencyEmail,
      subject: 'Follow-up: California Public Records Act Request',
      body: `[Follow-up #${request.followUpCount + 1} sent]`,
      requestId,
      sesMessageId: result.messageId ?? undefined,
    });

    // Create notification
    await createNotification({
      agencyId: request.agencyId,
      eventType: 'FOLLOW_UP_SENT',
      title: `Follow-up #${request.followUpCount + 1} sent to ${agency?.agencyName ?? 'Unknown'}`,
      message: `Automated follow-up sent. ${request.followUpCount + 1} of 3 follow-ups used.`,
      metadata: { requestId, followUpNumber: request.followUpCount + 1 },
    });

    // Add timeline event
    await addTimelineEvent({
      agencyId: request.agencyId,
      eventType: 'FOLLOW_UP_SENT',
      title: `Follow-up #${request.followUpCount + 1} sent`,
      description: `Automated follow-up email sent to ${agencyEmail}`,
      metadata: { requestId, emailLogId: emailLog.emailId },
    });

    return {
      agencyId: request.agencyId,
      agencyName: agency?.agencyName ?? 'Unknown',
      success: true,
      requestId,
      emailLogId: emailLog.emailId,
      error: null,
    };
  }

  return {
    agencyId: request.agencyId,
    agencyName: agency?.agencyName ?? 'Unknown',
    success: false,
    requestId,
    emailLogId: null,
    error: result.error,
  };
}

// ---------------------------------------------------------------------------
// Get acquisition progress summary
// ---------------------------------------------------------------------------

export async function getAcquisitionProgress(): Promise<{
  totalAgencies: number;
  totalTopics: number;
  statusBreakdown: Record<string, number>;
  coverage: number;
}> {
  const [totalAgencies, matrixEntries] = await Promise.all([
    prisma.agency.count(),
    prisma.agencyPolicyMatrix.groupBy({
      by: ['status'],
      _count: true,
    }),
  ]);

  const statusBreakdown: Record<string, number> = {
    NOT_REQUESTED: 0,
    REQUESTED: 0,
    RECEIVED: 0,
    UPLOADED: 0,
    IN_USE: 0,
  };

  for (const entry of matrixEntries) {
    statusBreakdown[entry.status] = entry._count;
  }

  const totalTracked = Object.values(statusBreakdown).reduce((a, b) => a + b, 0);
  const acquired = (statusBreakdown.RECEIVED ?? 0) + (statusBreakdown.UPLOADED ?? 0) + (statusBreakdown.IN_USE ?? 0);
  const coverage = totalTracked > 0 ? acquired / totalTracked : 0;

  return {
    totalAgencies,
    totalTopics: CANONICAL_POLICY_TOPICS.length,
    statusBreakdown,
    coverage,
  };
}
