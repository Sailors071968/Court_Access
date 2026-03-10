// ============================================================================
// CourtAccess — Marketing Analytics Dashboard (/dashboard/marketing)
// Phase 216: Marketing performance tracking and conversion analytics
// ============================================================================

import { useState, useEffect } from 'react';
import {
  BarChart3,
  Eye,
  Send,
  UserPlus,
  TrendingUp,
  Globe,
  ArrowUpRight,
  RefreshCw,
  Calendar,
} from 'lucide-react';

interface PageMetric {
  page: string;
  label: string;
  views: number;
  conversions: number;
}

interface MarketingData {
  totalPageViews: number;
  totalDemoRequests: number;
  totalSignups: number;
  conversionRate: number;
  pageMetrics: PageMetric[];
  recentActivity: { type: string; page: string; timestamp: string }[];
}

const TRACKED_PAGES: { path: string; label: string }[] = [
  { path: '/', label: 'Main Landing Page' },
  { path: '/for-defense', label: 'Defense Landing Page' },
  { path: '/for-prosecutors', label: 'Prosecutor Landing Page' },
  { path: '/government', label: 'Government Page' },
  { path: '/case-studies', label: 'Case Studies' },
  { path: '/demo', label: 'Demo Request' },
];

function getStoredMetrics(): MarketingData {
  const events = JSON.parse(localStorage.getItem('courtaccess_marketing_events') || '[]') as { type: string; page: string; timestamp: string }[];
  const demoRequests = JSON.parse(localStorage.getItem('courtaccess_demo_requests') || '[]') as { submittedAt: string }[];

  const pageViews = events.filter((e) => e.type === 'page_view');
  const signups = events.filter((e) => e.type === 'signup');

  const pageViewCounts: Record<string, number> = {};
  const pageConversionCounts: Record<string, number> = {};

  for (const pv of pageViews) {
    pageViewCounts[pv.page] = (pageViewCounts[pv.page] || 0) + 1;
  }

  for (const s of [...signups, ...events.filter((e) => e.type === 'cta_click')]) {
    pageConversionCounts[s.page] = (pageConversionCounts[s.page] || 0) + 1;
  }

  const pageMetrics: PageMetric[] = TRACKED_PAGES.map((p) => ({
    page: p.path,
    label: p.label,
    views: pageViewCounts[p.path] || 0,
    conversions: pageConversionCounts[p.path] || 0,
  }));

  const totalViews = pageViews.length;
  const totalDemos = demoRequests.length;
  const totalSignupsCount = signups.length;
  const totalConversions = totalDemos + totalSignupsCount;

  return {
    totalPageViews: totalViews,
    totalDemoRequests: totalDemos,
    totalSignups: totalSignupsCount,
    conversionRate: totalViews > 0 ? (totalConversions / totalViews) * 100 : 0,
    pageMetrics,
    recentActivity: events.slice(-20).reverse(),
  };
}

export function MarketingDashboard() {
  const [data, setData] = useState<MarketingData>(getStoredMetrics());
  const [seeding, setSeeding] = useState(false);

  const refresh = () => setData(getStoredMetrics());

  useEffect(() => { refresh(); }, []);

  const seedDemoData = () => {
    setSeeding(true);
    const events: { type: string; page: string; timestamp: string }[] = [];
    const pages = ['/', '/for-defense', '/for-prosecutors', '/government', '/case-studies', '/demo'];
    const now = Date.now();

    // Generate 30 days of mock page views
    for (let day = 0; day < 30; day++) {
      const dayTs = now - day * 86400000;
      const viewsPerDay = Math.floor(Math.random() * 40) + 10;
      for (let i = 0; i < viewsPerDay; i++) {
        events.push({
          type: 'page_view',
          page: pages[Math.floor(Math.random() * pages.length)],
          timestamp: new Date(dayTs + Math.random() * 86400000).toISOString(),
        });
      }
      // Some signups
      if (Math.random() > 0.6) {
        events.push({
          type: 'signup',
          page: pages[Math.floor(Math.random() * 2)],
          timestamp: new Date(dayTs + Math.random() * 86400000).toISOString(),
        });
      }
      // Some CTA clicks
      for (let i = 0; i < Math.floor(Math.random() * 5); i++) {
        events.push({
          type: 'cta_click',
          page: pages[Math.floor(Math.random() * pages.length)],
          timestamp: new Date(dayTs + Math.random() * 86400000).toISOString(),
        });
      }
    }

    localStorage.setItem('courtaccess_marketing_events', JSON.stringify(events));
    setSeeding(false);
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Track landing page performance and conversion metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={seedDemoData} disabled={seeding} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <BarChart3 size={14} />
            {seeding ? 'Generating...' : 'Seed Demo Data'}
          </button>
          <button onClick={refresh} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Eye size={16} className="text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Page Views</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.totalPageViews.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Send size={16} className="text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Demo Requests</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.totalDemoRequests.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <UserPlus size={16} className="text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Signups</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.totalSignups.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <TrendingUp size={16} className="text-amber-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Conversion Rate</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.conversionRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Page Performance Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Page Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Page</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Views</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Conversions</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Conv. Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.pageMetrics.map((pm) => (
                <tr key={pm.page} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Globe size={14} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{pm.label}</p>
                        <p className="text-xs text-gray-400">{pm.page}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-700">{pm.views.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-sm text-gray-700">{pm.conversions.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`text-sm font-medium ${pm.views > 0 && pm.conversions > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {pm.views > 0 ? ((pm.conversions / pm.views) * 100).toFixed(1) : '0.0'}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        {data.recentActivity.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="mx-auto mb-3 text-gray-300" size={32} />
            <p className="text-sm text-gray-500">No marketing events recorded yet. Use "Seed Demo Data" to generate sample data.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {data.recentActivity.map((activity, i) => (
              <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'page_view' ? 'bg-blue-400' :
                    activity.type === 'signup' ? 'bg-emerald-400' :
                    activity.type === 'cta_click' ? 'bg-amber-400' : 'bg-gray-400'
                  }`} />
                  <span className="text-sm text-gray-700 capitalize">{activity.type.replace('_', ' ')}</span>
                  <span className="text-xs text-gray-400">{activity.page}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(activity.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
