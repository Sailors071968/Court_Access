// ============================================================================
// CourtAccess — Marketing Metrics Model
// Phase 216: Marketing analytics tracking
// ============================================================================

export interface MarketingMetrics {
  id: string;
  page: string;
  event: 'page_view' | 'demo_request' | 'signup' | 'cta_click';
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

// In-memory store (production: migrate to PostgreSQL)
const metrics: MarketingMetrics[] = [];

export function trackMarketingEvent(data: Omit<MarketingMetrics, 'id' | 'timestamp'>): MarketingMetrics {
  const event: MarketingMetrics = {
    ...data,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  metrics.push(event);
  return event;
}

export function getMarketingMetrics(): MarketingMetrics[] {
  return [...metrics];
}

export function getMarketingSnapshot(): MarketingSnapshot {
  const pageViews = metrics.filter((m) => m.event === 'page_view');
  const demoRequests = metrics.filter((m) => m.event === 'demo_request');
  const signups = metrics.filter((m) => m.event === 'signup');

  const pageBreakdown: Record<string, number> = {};
  for (const m of pageViews) {
    pageBreakdown[m.page] = (pageBreakdown[m.page] || 0) + 1;
  }

  const totalViews = pageViews.length;
  const totalDemos = demoRequests.length;
  const totalSignups = signups.length;

  return {
    totalPageViews: totalViews,
    totalDemoRequests: totalDemos,
    totalSignups: totalSignups,
    conversionRate: totalViews > 0 ? ((totalDemos + totalSignups) / totalViews) * 100 : 0,
    pageBreakdown,
    dailyMetrics: [], // populated from aggregation in production
  };
}
