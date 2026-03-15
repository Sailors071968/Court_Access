// ============================================================================
// CourtAccess — Marketing Metrics Model
// Phase 216: Marketing analytics tracking
// Now persisted to PostgreSQL via Prisma (replaces in-memory array).
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Types (kept for backward compatibility with existing route handlers)
// ---------------------------------------------------------------------------

export type MarketingEventType = 'page_view' | 'demo_request' | 'signup' | 'cta_click';

export interface MarketingMetrics {
  id: string;
  page: string;
  event: MarketingEventType;
  source: string;
  timestamp: string;
  metadata: Record<string, string>;
}

export interface MarketingSnapshot {
  totalPageViews: number;
  totalDemoRequests: number;
  totalSignups: number;
  conversionRate: number;
  pageBreakdown: Record<string, number>;
  dailyMetrics: { date: string; views: number; demos: number; signups: number }[];
}

// ---------------------------------------------------------------------------
// Prisma row → interface mapper
// ---------------------------------------------------------------------------

function toMarketingMetrics(row: {
  id: string;
  page: string;
  event: string;
  source: string;
  metadata: unknown;
  createdAt: Date;
}): MarketingMetrics {
  return {
    id: row.id,
    page: row.page,
    event: row.event as MarketingEventType,
    source: row.source,
    timestamp: row.createdAt.toISOString(),
    metadata: (row.metadata as Record<string, string>) ?? {},
  };
}

// ---------------------------------------------------------------------------
// CRUD — persisted to PostgreSQL via Prisma
// ---------------------------------------------------------------------------

export async function trackMarketingEvent(data: Omit<MarketingMetrics, 'id' | 'timestamp'>): Promise<MarketingMetrics> {
  const row = await prisma.marketingEvent.create({
    data: {
      page: data.page,
      event: data.event,
      source: data.source,
      metadata: data.metadata ?? {},
    },
  });
  return toMarketingMetrics(row);
}

export async function getMarketingMetrics(): Promise<MarketingMetrics[]> {
  const rows = await prisma.marketingEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 });
  return rows.map(toMarketingMetrics);
}

export async function getMarketingSnapshot(): Promise<MarketingSnapshot> {
  const [totalViews, totalDemos, totalSignups] = await Promise.all([
    prisma.marketingEvent.count({ where: { event: 'page_view' } }),
    prisma.marketingEvent.count({ where: { event: 'demo_request' } }),
    prisma.marketingEvent.count({ where: { event: 'signup' } }),
  ]);

  // Page breakdown via groupBy
  const pageGroups = await prisma.marketingEvent.groupBy({
    by: ['page'],
    where: { event: 'page_view' },
    _count: { id: true },
  });
  const pageBreakdown: Record<string, number> = {};
  for (const g of pageGroups) {
    pageBreakdown[g.page] = g._count.id;
  }

  return {
    totalPageViews: totalViews,
    totalDemoRequests: totalDemos,
    totalSignups: totalSignups,
    conversionRate: totalViews > 0 ? ((totalDemos + totalSignups) / totalViews) * 100 : 0,
    pageBreakdown,
    dailyMetrics: [], // Can be populated via date-range aggregation queries
  };
}
