// ---------------------------------------------------------------------------
// Phase 35 — CPRA Deadline Service
// Tracks 10 business day response deadlines and triggers follow-ups.
// ---------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';
import { CPRA_SAFEGUARDS } from './cpraSafeguards.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Business day calculation
// ---------------------------------------------------------------------------

/**
 * Add N business days to a date (skips weekends).
 */
export function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;

  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }

  return result;
}

/**
 * Count business days between two dates.
 */
export function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);

  while (current < end) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// Deadline calculation
// ---------------------------------------------------------------------------

export interface DeadlineInfo {
  requestId: string;
  agencyId: string;
  sentAt: Date;
  deadlineDate: Date;
  businessDaysElapsed: number;
  isOverdue: boolean;
  followUpCount: number;
  needsFollowUp: boolean;
}

/**
 * Calculate the CPRA response deadline for a request.
 */
export function calculateDeadline(sentAt: Date): Date {
  return addBusinessDays(sentAt, CPRA_SAFEGUARDS.businessDaysBeforeFollowUp);
}

/**
 * Get deadline info for a single request.
 */
export function getDeadlineInfo(request: {
  requestId: string;
  agencyId: string;
  sentAt: Date | null;
  responseReceived: boolean;
  closed: boolean;
  followUpCount: number;
}): DeadlineInfo | null {
  if (!request.sentAt || request.responseReceived || request.closed) {
    return null;
  }

  const deadlineDate = calculateDeadline(request.sentAt);
  const now = new Date();
  const businessDaysElapsed = countBusinessDays(request.sentAt, now);
  const isOverdue = now > deadlineDate;
  const needsFollowUp =
    isOverdue && request.followUpCount < CPRA_SAFEGUARDS.maxFollowUps;

  return {
    requestId: request.requestId,
    agencyId: request.agencyId,
    sentAt: request.sentAt,
    deadlineDate,
    businessDaysElapsed,
    isOverdue,
    followUpCount: request.followUpCount,
    needsFollowUp,
  };
}

// ---------------------------------------------------------------------------
// Find requests needing follow-up
// ---------------------------------------------------------------------------

/**
 * Find all requests that are overdue and need follow-up.
 */
export async function findOverdueRequests(): Promise<DeadlineInfo[]> {
  const openRequests = await prisma.cPRAAgencyRequest.findMany({
    where: {
      closed: false,
      responseReceived: false,
      sentAt: { not: null },
      followUpCount: { lt: CPRA_SAFEGUARDS.maxFollowUps },
    },
  });

  const overdueList: DeadlineInfo[] = [];

  for (const request of openRequests) {
    const info = getDeadlineInfo({
      requestId: request.requestId,
      agencyId: request.agencyId,
      sentAt: request.sentAt,
      responseReceived: request.responseReceived,
      closed: request.closed,
      followUpCount: request.followUpCount,
    });

    if (info?.needsFollowUp) {
      overdueList.push(info);
    }
  }

  return overdueList;
}

// ---------------------------------------------------------------------------
// Campaign deadline summary
// ---------------------------------------------------------------------------

export interface CampaignDeadlineSummary {
  campaignId: string;
  totalRequests: number;
  sentRequests: number;
  overdueRequests: number;
  needsFollowUp: number;
  responded: number;
  closed: number;
}

export async function getCampaignDeadlineSummary(
  campaignId: string,
): Promise<CampaignDeadlineSummary> {
  const requests = await prisma.cPRAAgencyRequest.findMany({
    where: { campaignId },
  });

  let overdueCount = 0;
  let needsFollowUpCount = 0;

  for (const request of requests) {
    const info = getDeadlineInfo({
      requestId: request.requestId,
      agencyId: request.agencyId,
      sentAt: request.sentAt,
      responseReceived: request.responseReceived,
      closed: request.closed,
      followUpCount: request.followUpCount,
    });

    if (info?.isOverdue) overdueCount++;
    if (info?.needsFollowUp) needsFollowUpCount++;
  }

  return {
    campaignId,
    totalRequests: requests.length,
    sentRequests: requests.filter((r) => r.sentAt !== null).length,
    overdueRequests: overdueCount,
    needsFollowUp: needsFollowUpCount,
    responded: requests.filter((r) => r.responseReceived).length,
    closed: requests.filter((r) => r.closed).length,
  };
}
