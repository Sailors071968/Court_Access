// ---------------------------------------------------------------------------
// Phase 44 — CPRA Automation Safeguards
// Rate limits, deduplication, and follow-up caps.
// ---------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Safety constants
// ---------------------------------------------------------------------------

export const CPRA_SAFEGUARDS = {
  /** Maximum emails sent per day */
  maxEmailsPerDay: 50,

  /** Maximum emails per minute */
  maxEmailsPerMinute: 5,

  /** Maximum follow-up emails per request */
  maxFollowUps: 3,

  /** Business days before follow-up is triggered */
  businessDaysBeforeFollowUp: 10,

  /** Minimum hours between follow-ups for same agency */
  minHoursBetweenFollowUps: 72,

  /** Maximum concurrent campaign sends */
  maxConcurrentSends: 2,
} as const;

export type CpraSafeguards = typeof CPRA_SAFEGUARDS;

// ---------------------------------------------------------------------------
// Rate limit checking
// ---------------------------------------------------------------------------

export async function checkDailyLimit(): Promise<{
  allowed: boolean;
  sentToday: number;
  remaining: number;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const sentToday = await prisma.cPRAAgencyRequest.count({
    where: {
      sentAt: { gte: todayStart },
    },
  });

  return {
    allowed: sentToday < CPRA_SAFEGUARDS.maxEmailsPerDay,
    sentToday,
    remaining: Math.max(0, CPRA_SAFEGUARDS.maxEmailsPerDay - sentToday),
  };
}

export async function checkMinuteLimit(): Promise<{
  allowed: boolean;
  sentLastMinute: number;
}> {
  const oneMinuteAgo = new Date(Date.now() - 60_000);

  const sentLastMinute = await prisma.cPRAAgencyRequest.count({
    where: {
      sentAt: { gte: oneMinuteAgo },
    },
  });

  return {
    allowed: sentLastMinute < CPRA_SAFEGUARDS.maxEmailsPerMinute,
    sentLastMinute,
  };
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

export async function checkDuplicateRequest(
  agencyId: string,
  campaignId: string,
): Promise<{ isDuplicate: boolean; existingRequestId: string | null }> {
  const existing = await prisma.cPRAAgencyRequest.findFirst({
    where: {
      agencyId,
      campaignId,
      closed: false,
    },
  });

  return {
    isDuplicate: !!existing,
    existingRequestId: existing?.requestId ?? null,
  };
}

// ---------------------------------------------------------------------------
// Follow-up eligibility
// ---------------------------------------------------------------------------

export async function checkFollowUpEligibility(
  requestId: string,
): Promise<{
  eligible: boolean;
  reason: string | null;
}> {
  const request = await prisma.cPRAAgencyRequest.findUnique({
    where: { requestId },
  });

  if (!request) {
    return { eligible: false, reason: 'Request not found' };
  }

  if (request.closed) {
    return { eligible: false, reason: 'Request is closed' };
  }

  if (request.responseReceived) {
    return { eligible: false, reason: 'Response already received' };
  }

  if (request.followUpCount >= CPRA_SAFEGUARDS.maxFollowUps) {
    return {
      eligible: false,
      reason: `Max follow-ups (${CPRA_SAFEGUARDS.maxFollowUps}) reached`,
    };
  }

  // Check minimum time between follow-ups
  const lastContact = request.lastFollowUpAt ?? request.sentAt;
  if (lastContact) {
    const hoursSinceLast =
      (Date.now() - lastContact.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLast < CPRA_SAFEGUARDS.minHoursBetweenFollowUps) {
      return {
        eligible: false,
        reason: `Must wait ${CPRA_SAFEGUARDS.minHoursBetweenFollowUps}h between follow-ups (${Math.round(hoursSinceLast)}h elapsed)`,
      };
    }
  }

  return { eligible: true, reason: null };
}

// ---------------------------------------------------------------------------
// System status
// ---------------------------------------------------------------------------

export async function getCpraSafetyStatus(): Promise<{
  dailyLimit: { sentToday: number; remaining: number; allowed: boolean };
  minuteLimit: { sentLastMinute: number; allowed: boolean };
  activeCampaigns: number;
  openRequests: number;
  safeguards: CpraSafeguards;
}> {
  const [dailyLimit, minuteLimit, activeCampaigns, openRequests] =
    await Promise.all([
      checkDailyLimit(),
      checkMinuteLimit(),
      prisma.cPRARequestCampaign.count({ where: { active: true } }),
      prisma.cPRAAgencyRequest.count({ where: { closed: false } }),
    ]);

  return {
    dailyLimit,
    minuteLimit,
    activeCampaigns,
    openRequests,
    safeguards: CPRA_SAFEGUARDS,
  };
}
