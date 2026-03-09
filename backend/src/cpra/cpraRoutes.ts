// ---------------------------------------------------------------------------
// Phase 42-45 — CPRA Route Handlers
// Plain handler pattern with RouteResponse<T> return type.
// ---------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';
import { enqueueCampaignBatch, scheduleOverdueCheck } from './workers/cpraCampaignWorker.js';
import { markResponseReceived, closeRequestNoResponse, getCpraRequestStatus } from './services/cpraResponseProcessor.js';
import { getCampaignDeadlineSummary, findOverdueRequests } from './services/cpraDeadlineService.js';
import { getCpraSafetyStatus } from './services/cpraSafeguards.js';
import type { DocumentAttachment } from './services/cpraResponseProcessor.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Campaign CRUD
// ---------------------------------------------------------------------------

export async function handleCreateCampaign(params: {
  campaignName: string;
}): Promise<RouteResponse<{ campaignId: string }>> {
  try {
    const campaign = await prisma.cPRARequestCampaign.create({
      data: { campaignName: params.campaignName },
    });
    return {
      success: true,
      data: { campaignId: campaign.campaignId },
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function handleGetCampaigns(): Promise<
  RouteResponse<Array<{
    campaignId: string;
    campaignName: string;
    createdAt: Date;
    active: boolean;
    requestCount: number;
  }>>
> {
  try {
    const campaigns = await prisma.cPRARequestCampaign.findMany({
      include: { _count: { select: { requests: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: campaigns.map((c) => ({
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        createdAt: c.createdAt,
        active: c.active,
        requestCount: c._count.requests,
      })),
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function handleGetCampaignDetail(params: {
  campaignId: string;
}): Promise<
  RouteResponse<{
    campaign: {
      campaignId: string;
      campaignName: string;
      active: boolean;
      createdAt: Date;
    };
    requests: Array<{
      requestId: string;
      agencyId: string;
      agencyName: string;
      status: string;
      sentAt: Date | null;
      followUpCount: number;
      responseReceived: boolean;
      closed: boolean;
    }>;
    deadlineSummary: {
      totalRequests: number;
      sentRequests: number;
      overdueRequests: number;
      needsFollowUp: number;
      responded: number;
      closed: number;
    };
  }>
> {
  try {
    const campaign = await prisma.cPRARequestCampaign.findUnique({
      where: { campaignId: params.campaignId },
      include: { requests: true },
    });

    if (!campaign) {
      return { success: false, data: null, error: 'Campaign not found' };
    }

    // Enrich requests with agency names
    const enrichedRequests = await Promise.all(
      campaign.requests.map(async (r) => {
        const agency = await prisma.agency.findUnique({
          where: { agencyId: r.agencyId },
          select: { agencyName: true },
        });
        return {
          requestId: r.requestId,
          agencyId: r.agencyId,
          agencyName: agency?.agencyName ?? 'Unknown',
          status: r.status,
          sentAt: r.sentAt,
          followUpCount: r.followUpCount,
          responseReceived: r.responseReceived,
          closed: r.closed,
        };
      }),
    );

    const deadlineSummary = await getCampaignDeadlineSummary(params.campaignId);

    return {
      success: true,
      data: {
        campaign: {
          campaignId: campaign.campaignId,
          campaignName: campaign.campaignName,
          active: campaign.active,
          createdAt: campaign.createdAt,
        },
        requests: enrichedRequests,
        deadlineSummary,
      },
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Launch campaign — send CPRA requests to agencies
// ---------------------------------------------------------------------------

export async function handleLaunchCampaign(params: {
  campaignId: string;
  agencyIds?: string[];
}): Promise<RouteResponse<{ enqueued: number; skipped: number }>> {
  try {
    // If no specific agencies provided, use all agencies with websites
    let targetAgencyIds = params.agencyIds;
    if (!targetAgencyIds || targetAgencyIds.length === 0) {
      const agencies = await prisma.agency.findMany({
        where: { website: { not: null } },
        select: { agencyId: true },
        orderBy: { jurisdictionRank: 'asc' },
      });
      targetAgencyIds = agencies.map((a) => a.agencyId);
    }

    const result = await enqueueCampaignBatch(
      params.campaignId,
      targetAgencyIds,
    );

    return { success: true, data: result, error: null };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Phase 40 — Manual response confirmation
// ---------------------------------------------------------------------------

export async function handleMarkResponseReceived(params: {
  requestId: string;
  attachments?: DocumentAttachment[];
}): Promise<RouteResponse<{
  thankYouSent: boolean;
  documentsIngested: number;
}>> {
  try {
    const result = await markResponseReceived(
      params.requestId,
      params.attachments ?? [],
    );

    if (!result.success) {
      return { success: false, data: null, error: result.error };
    }

    return {
      success: true,
      data: {
        thankYouSent: result.thankYouSent,
        documentsIngested: result.documentsIngested,
      },
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Close request without response
// ---------------------------------------------------------------------------

export async function handleCloseRequest(params: {
  requestId: string;
}): Promise<RouteResponse<{ closed: boolean }>> {
  try {
    const result = await closeRequestNoResponse(params.requestId);
    return {
      success: result.success,
      data: { closed: result.success },
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Phase 43 — Agency response tracking
// ---------------------------------------------------------------------------

export async function handleGetRequestStatus(params: {
  requestId: string;
}): Promise<RouteResponse<Awaited<ReturnType<typeof getCpraRequestStatus>>>> {
  try {
    const status = await getCpraRequestStatus(params.requestId);
    if (!status) {
      return { success: false, data: null, error: 'Request not found' };
    }
    return { success: true, data: status, error: null };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Phase 42 — CPRA Dashboard metrics
// ---------------------------------------------------------------------------

export async function handleGetCpraDashboard(): Promise<
  RouteResponse<{
    totalAgencies: number;
    totalRequestsSent: number;
    totalResponsesReceived: number;
    totalFollowUpsPending: number;
    totalClosed: number;
    activeCampaigns: number;
    statusBreakdown: Record<string, number>;
    safetyStatus: Awaited<ReturnType<typeof getCpraSafetyStatus>>;
  }>
> {
  try {
    const [
      totalAgencies,
      totalRequestsSent,
      totalResponsesReceived,
      totalFollowUpsPending,
      totalClosed,
      activeCampaigns,
      safetyStatus,
    ] = await Promise.all([
      prisma.agency.count(),
      prisma.cPRAAgencyRequest.count({ where: { sentAt: { not: null } } }),
      prisma.cPRAAgencyRequest.count({ where: { responseReceived: true } }),
      findOverdueRequests().then((r) => r.length),
      prisma.cPRAAgencyRequest.count({ where: { closed: true } }),
      prisma.cPRARequestCampaign.count({ where: { active: true } }),
      getCpraSafetyStatus(),
    ]);

    // Status breakdown
    const statusGroups = await prisma.cPRAAgencyRequest.groupBy({
      by: ['status'],
      _count: true,
    });

    const statusBreakdown: Record<string, number> = {};
    for (const group of statusGroups) {
      statusBreakdown[group.status] = group._count;
    }

    return {
      success: true,
      data: {
        totalAgencies,
        totalRequestsSent,
        totalResponsesReceived,
        totalFollowUpsPending,
        totalClosed,
        activeCampaigns,
        statusBreakdown,
        safetyStatus,
      },
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Trigger overdue processing
// ---------------------------------------------------------------------------

export async function handleProcessOverdue(): Promise<
  RouteResponse<{ scheduled: boolean }>
> {
  try {
    await scheduleOverdueCheck();
    return { success: true, data: { scheduled: true }, error: null };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
