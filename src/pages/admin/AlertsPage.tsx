// ============================================
// Court Access — Alerts Management Page
// Phase 116: Monitoring & Alerting Dashboard
// ============================================

import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Shield,
  RefreshCw,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../../services/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertEvent {
  id: string;
  alertType: string;
  severity: string;
  message: string;
  details: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

interface AlertRule {
  id: string;
  alertType: string;
  threshold: number;
  windowMinutes: number;
  enabled: boolean;
  notifyEmail: string;
  notifyMethod: string;
  lastTriggered: string | null;
  triggerCount: number;
}

interface AlertSummary {
  totalUnacknowledged: number;
  criticalCount: number;
  highCount: number;
  recentEvents: AlertEvent[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  server_crash: 'Server Crash',
  worker_failure: 'Worker Failure',
  db_connection_error: 'Database Error',
  email_delivery_failure: 'Email Failure',
  high_error_rate: 'High Error Rate',
};

type TabId = 'events' | 'rules';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AlertsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('events');
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (!showAcknowledged) params.set('acknowledged', 'false');

      const [summaryRes, eventsRes, rulesRes] = await Promise.all([
        apiGet('/api/admin/alerts/summary'),
        apiGet(`/api/admin/alerts/events?${params.toString()}`),
        apiGet('/api/admin/alerts/rules'),
      ]);

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
      }
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setEvents(data.events);
      }
      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setRules(data.rules);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [showAcknowledged]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const acknowledgeEvent = async (id: string) => {
    try {
      const res = await apiPost(`/api/admin/alerts/events/${id}/acknowledge`);
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const toggleRule = async (alertType: string, enabled: boolean) => {
    try {
      const res = await apiPut(`/api/admin/alerts/rules/${alertType}`, { enabled });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Failed to update rule:', err);
    }
  };

  const fireTestAlert = async () => {
    try {
      await apiPost('/api/admin/alerts/test');
      fetchData();
    } catch (err) {
      console.error('Failed to fire test alert:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Alerts</h1>
            <p className="text-sm text-slate-500 mt-1">Real-time monitoring alerts and rule configuration</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fireTestAlert}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <Bell size={14} />
              Test Alert
            </button>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500 mb-1">Unacknowledged</div>
              <div className="text-2xl font-bold text-amber-600">{summary.totalUnacknowledged}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500 mb-1">Critical</div>
              <div className="text-2xl font-bold text-red-600">{summary.criticalCount}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500 mb-1">High</div>
              <div className="text-2xl font-bold text-orange-600">{summary.highCount}</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg border border-slate-200 p-1 w-fit">
          {([
            { id: 'events' as TabId, label: 'Alert Events', icon: Bell },
            { id: 'rules' as TabId, label: 'Alert Rules', icon: Settings },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading alerts...</div>
        ) : activeTab === 'events' ? (
          <>
            {/* Filter */}
            <div className="flex items-center gap-3 mb-4">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={showAcknowledged}
                  onChange={(e) => setShowAcknowledged(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Show acknowledged
              </label>
            </div>

            {/* Events List */}
            {events.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <Shield size={40} className="mx-auto text-emerald-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-600">All clear</h3>
                <p className="text-sm text-slate-400 mt-1">No active alerts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => {
                  const isExpanded = expandedId === event.id;
                  return (
                    <div
                      key={event.id}
                      className={`bg-white rounded-xl border p-4 ${
                        event.acknowledged ? 'border-slate-200 opacity-60' : SEVERITY_COLORS[event.severity]?.replace('bg-', 'border-') || 'border-slate-200'
                      }`}
                    >
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : event.id)}
                      >
                        <div className="flex items-center gap-3">
                          {event.acknowledged
                            ? <CheckCircle size={16} className="text-emerald-500" />
                            : <AlertTriangle size={16} className="text-amber-500" />
                          }
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-900">
                                {ALERT_TYPE_LABELS[event.alertType] || event.alertType}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[event.severity] || ''}`}>
                                {event.severity}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{event.message}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">
                            {new Date(event.createdAt).toLocaleString()}
                          </span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="mt-3 ml-7 space-y-2">
                          {Object.keys(event.details).length > 0 && (
                            <pre className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 overflow-x-auto">
                              {JSON.stringify(event.details, null, 2)}
                            </pre>
                          )}
                          {!event.acknowledged && (
                            <button
                              onClick={(e) => { e.stopPropagation(); acknowledgeEvent(event.id); }}
                              className="px-3 py-1 text-xs bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 text-emerald-700"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Rules Tab */
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Alert Rules</h2>
              <p className="text-sm text-slate-500 mt-1">Configure thresholds and notification methods</p>
            </div>
            <div className="divide-y divide-slate-100">
              {rules.map((rule) => (
                <div key={rule.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {ALERT_TYPE_LABELS[rule.alertType] || rule.alertType}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Threshold: {rule.threshold} in {rule.windowMinutes}min &middot;
                      Triggered {rule.triggerCount} times
                      {rule.lastTriggered && ` (last: ${new Date(rule.lastTriggered).toLocaleDateString()})`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      rule.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <button
                      onClick={() => toggleRule(rule.alertType, !rule.enabled)}
                      className="px-3 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 text-slate-600"
                    >
                      {rule.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
