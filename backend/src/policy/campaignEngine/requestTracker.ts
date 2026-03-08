// ============================================
// Court Access — Request Tracker
// Tracks CPRA policy requests in the database.
// ============================================

import { PrismaClient } from '@prisma/client';
import type {
  PolicyRequestRecord,
  PolicyRequestStatus,
  CampaignFilter,
  PaginatedRequestResult,
  CampaignStats,
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
// Generate Tracking ID
// ---------------------------------------------------------------------------

export function generateTrackingId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `CPRA-${timestamp}-${random}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Create Policy Request
// ---------------------------------------------------------------------------

export async function createPolicyRequest(input: {
  agencyId: string;
  trackingId: string;
  sesMessageId?: string;
}): Promise<PolicyRequestRecord> {
  const db = getPrisma();

  const request = await db.policyRequest.create({
    data: {
      agencyId: input.agencyId,
      requestSentAt: new Date(),
      status: 'sent',
      trackingId: input.trackingId,
      sesMessageId: input.sesMessageId ?? null,
    },
  });

  return request as PolicyRequestRecord;
}

// ---------------------------------------------------------------------------
// Update Request Status
// ---------------------------------------------------------------------------

export async function updateRequestStatus(
  trackingId: string,
  status: PolicyRequestStatus,
  extra?: { responseAt?: Date; sesMessageId?: string; errorMessage?: string }
): Promise<PolicyRequestRecord> {
  const db = getPrisma();

  const request = await db.policyRequest.update({
    where: { trackingId },
    data: {
      status,
      responseAt: extra?.responseAt ?? undefined,
      sesMessageId: extra?.sesMessageId ?? undefined,
      errorMessage: extra?.errorMessage ?? undefined,
    },
  });

  return request as PolicyRequestRecord;
}

// ---------------------------------------------------------------------------
// Get Request by Tracking ID
// ---------------------------------------------------------------------------

export async function getRequestByTrackingId(trackingId: string): Promise<PolicyRequestRecord | null> {
  const db = getPrisma();

  const request = await db.policyRequest.findUnique({
    where: { trackingId },
  });

  return request as PolicyRequestRecord | null;
}

// ---------------------------------------------------------------------------
// List Policy Requests (paginated, filterable)
// ---------------------------------------------------------------------------

export async function listPolicyRequests(filter: CampaignFilter = {}): Promise<PaginatedRequestResult> {
  const db = getPrisma();
  const page = filter.page ?? 1;
  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (filter.agencyId) {
    where.agencyId = filter.agencyId;
  }
  if (filter.status) {
    where.status = filter.status;
  }
  if (filter.county || filter.agencyType || filter.search) {
    const agencyWhere: Record<string, unknown> = {};
    if (filter.county) agencyWhere.county = filter.county;
    if (filter.agencyType) agencyWhere.agencyType = filter.agencyType;
    if (filter.search) {
      agencyWhere.OR = [
        { agencyName: { contains: filter.search, mode: 'insensitive' } },
        { county: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    where.agency = agencyWhere;
  }

  const [requests, total] = await Promise.all([
    db.policyRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { requestSentAt: 'desc' },
      include: { agency: true },
    }),
    db.policyRequest.count({ where }),
  ]);

  return {
    requests: requests as PolicyRequestRecord[],
    total,
    page,
    limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

// ---------------------------------------------------------------------------
// Campaign Stats
// ---------------------------------------------------------------------------

export async function getCampaignStats(): Promise<CampaignStats> {
  const db = getPrisma();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const [totalRequests, byStatusRaw, sentToday, sentThisHour, responded] = await Promise.all([
    db.policyRequest.count(),
    db.policyRequest.groupBy({ by: ['status'], _count: { id: true } }),
    db.policyRequest.count({ where: { requestSentAt: { gte: startOfDay } } }),
    db.policyRequest.count({ where: { requestSentAt: { gte: oneHourAgo } } }),
    db.policyRequest.count({
      where: { status: { in: ['responded', 'documents_received'] } },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of byStatusRaw) {
    byStatus[row.status] = row._count.id;
  }

  return {
    totalRequests,
    byStatus,
    sentToday,
    sentThisHour,
    responseRate: totalRequests > 0 ? Math.round((responded / totalRequests) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Count Sent This Hour (for rate limiting)
// ---------------------------------------------------------------------------

export async function countSentThisHour(): Promise<number> {
  const db = getPrisma();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  return db.policyRequest.count({
    where: { requestSentAt: { gte: oneHourAgo } },
  });
}

// ---------------------------------------------------------------------------
// Get Agencies Without Requests (for new campaigns)
// ---------------------------------------------------------------------------

export async function getAgenciesWithoutRequests(filter?: {
  county?: string;
  agencyType?: string;
}): Promise<string[]> {
  const db = getPrisma();

  const agencyWhere: Record<string, unknown> = {
    recordsEmail: { not: null },
    policyRequests: { none: {} },
  };

  if (filter?.county) agencyWhere.county = filter.county;
  if (filter?.agencyType) agencyWhere.agencyType = filter.agencyType;

  const agencies = await db.agency.findMany({
    where: agencyWhere,
    select: { id: true },
  });

  return agencies.map((a) => a.id);
}
