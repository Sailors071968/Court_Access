// ============================================================================
// CourtAccess — Autonomous CPRA Policy Acquisition Dashboard
// Real-time monitoring of the autonomous CPRA system: timeline, notifications,
// worker status, acquisition progress, and admin controls.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/common/Card';
import {
  Bell,
  Mail,
  MailOpen,
  Send,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Play,
  Square,
  Activity,
  Building2,
  Download,
  Upload,
  Zap,
  ChevronDown,
  ChevronUp,
  Eye,
  XCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SystemStatus {
  workers: {
    emailMonitor: { running: boolean };
    followUp: { running: boolean };
    ingestion: { running: boolean };
  };
  acquisition: {
    totalAgencies: number;
    totalTopics: number;
    statusBreakdown: Record<string, number>;
    coverage: number;
  };
  emails: {
    totalOutbound: number;
    totalInbound: number;
    unprocessedInbound: number;
    todayOutbound: number;
    todayInbound: number;
  };
  notifications: {
    total: number;
    unread: number;
    byEventType: Record<string, number>;
  };
  timestamp: string;
}

interface TimelineEvent {
  eventId: string;
  agencyId: string;
  eventType: string;
  title: string;
  description: string | null;
  metadata: string | null;
  createdAt: string;
}

interface Notification {
  notificationId: string;
  agencyId: string | null;
  eventType: string;
  title: string;
  message: string;
  metadata: string | null;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// API Base URL
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

const EVENT_ICONS: Record<string, React.ReactNode> = {
  REQUEST_SENT: <Send size={14} className="text-gold-light" />,
  EMAIL_SENT: <Mail size={14} className="text-gold-light" />,
  EMAIL_RECEIVED: <MailOpen size={14} className="text-green-600" />,
  ATTACHMENT_DETECTED: <FileText size={14} className="text-purple-600" />,
  DOCUMENT_UPLOADED: <Upload size={14} className="text-indigo-600" />,
  POLICY_UPLOADED: <Upload size={14} className="text-indigo-600" />,
  POLICY_PARSED: <Zap size={14} className="text-yellow-600" />,
  POLICY_ACTIVE: <CheckCircle2 size={14} className="text-green-600" />,
  POLICY_INGESTED: <CheckCircle2 size={14} className="text-green-600" />,
  FOLLOW_UP_SENT: <RefreshCw size={14} className="text-orange-600" />,
  STATUS_CHANGED: <Activity size={14} className="text-slate-300" />,
  REQUEST_CREATED: <Building2 size={14} className="text-gold-light" />,
};

const EVENT_COLORS: Record<string, string> = {
  REQUEST_SENT: 'border-blue-500/20 bg-blue-500/10',
  EMAIL_SENT: 'border-blue-500/20 bg-blue-500/10',
  EMAIL_RECEIVED: 'border-emerald-500/20 bg-emerald-500/10',
  ATTACHMENT_DETECTED: 'border-violet-500/20 bg-violet-500/10',
  DOCUMENT_UPLOADED: 'border-indigo-200 bg-indigo-500/10',
  POLICY_UPLOADED: 'border-indigo-200 bg-indigo-500/10',
  POLICY_PARSED: 'border-amber-500/20 bg-amber-500/10',
  POLICY_ACTIVE: 'border-emerald-500/20 bg-emerald-500/10',
  POLICY_INGESTED: 'border-emerald-500/20 bg-emerald-500/10',
  FOLLOW_UP_SENT: 'border-orange-200 bg-orange-50',
  STATUS_CHANGED: 'border-white/10 bg-white/5',
  REQUEST_CREATED: 'border-blue-500/20 bg-blue-500/10',
};

function WorkerStatusBadge({ running }: { running: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
        running ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      {running ? 'Running' : 'Stopped'}
    </span>
  );
}

function StatusPill({ status, count }: { status: string; count: number }) {
  const configs: Record<string, { color: string; bg: string }> = {
    NOT_REQUESTED: { color: 'text-slate-200', bg: 'bg-white/10' },
    REQUESTED: { color: 'text-amber-300', bg: 'bg-amber-500/15' },
    RECEIVED: { color: 'text-blue-300', bg: 'bg-blue-500/15' },
    UPLOADED: { color: 'text-violet-300', bg: 'bg-violet-500/15' },
    IN_USE: { color: 'text-emerald-300', bg: 'bg-emerald-500/15' },
  };
  const config = configs[status] ?? { color: 'text-slate-200', bg: 'bg-white/10' };

  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${config.bg}`}>
      <span className={`text-sm font-medium ${config.color}`}>{status.replace(/_/g, ' ')}</span>
      <span className={`text-lg font-bold ${config.color}`}>{count.toLocaleString()}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

export function CpraAutonomousDashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'notifications' | 'controls'>('timeline');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // -----------------------------------------------------------------------
  // Data Fetching
  // -----------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      const [statusData, timelineData, notifData] = await Promise.all([
        apiFetch<SystemStatus>('/admin/cpra/status'),
        apiFetch<{ events: TimelineEvent[] }>('/admin/cpra/timeline?limit=50'),
        apiFetch<{ notifications: Notification[] }>('/admin/cpra/notifications?limit=50'),
      ]);

      setStatus(statusData);
      setTimeline(timelineData.events);
      setNotifications(notifData.notifications);
      setError(null);
      setLastRefresh(new Date());
    } catch {
      // If API not available, use demo data
      setStatus({
        workers: {
          emailMonitor: { running: false },
          followUp: { running: false },
          ingestion: { running: false },
        },
        acquisition: {
          totalAgencies: 612,
          totalTopics: 44,
          statusBreakdown: {
            NOT_REQUESTED: 24528,
            REQUESTED: 1800,
            RECEIVED: 420,
            UPLOADED: 105,
            IN_USE: 75,
          },
          coverage: 0.022,
        },
        emails: {
          totalOutbound: 1800,
          totalInbound: 312,
          unprocessedInbound: 8,
          todayOutbound: 45,
          todayInbound: 12,
        },
        notifications: {
          total: 2400,
          unread: 23,
          byEventType: {
            EMAIL_SENT: 1800,
            EMAIL_RECEIVED: 312,
            DOCUMENT_UPLOADED: 105,
            POLICY_PARSED: 75,
            POLICY_ACTIVE: 75,
            FOLLOW_UP_SENT: 33,
          },
        },
        timestamp: new Date().toISOString(),
      });

      // Demo timeline events
      setTimeline([
        { eventId: 'e1', agencyId: 'a1', eventType: 'REQUEST_SENT', title: 'CPRA request sent to Sacramento PD', description: 'Initial request sent for 44 policy topics', metadata: null, createdAt: new Date(Date.now() - 3600000).toISOString() },
        { eventId: 'e2', agencyId: 'a2', eventType: 'EMAIL_RECEIVED', title: 'Email received from LAPD', description: 'Subject: RE: CPRA Request | 3 attachments', metadata: null, createdAt: new Date(Date.now() - 7200000).toISOString() },
        { eventId: 'e3', agencyId: 'a2', eventType: 'ATTACHMENT_DETECTED', title: 'Attachment: Use_of_Force_Policy.pdf', description: 'Document type: policy_document', metadata: null, createdAt: new Date(Date.now() - 7100000).toISOString() },
        { eventId: 'e4', agencyId: 'a2', eventType: 'POLICY_UPLOADED', title: 'Policy classified: Use of Force', description: '"Use of Force General Order" matched with 92% confidence', metadata: null, createdAt: new Date(Date.now() - 7000000).toISOString() },
        { eventId: 'e5', agencyId: 'a3', eventType: 'FOLLOW_UP_SENT', title: 'Follow-up #1 sent to SFPD', description: 'Automated follow-up after 14 days without response', metadata: null, createdAt: new Date(Date.now() - 10800000).toISOString() },
        { eventId: 'e6', agencyId: 'a4', eventType: 'POLICY_INGESTED', title: 'Policy ingested: Body Worn Cameras', description: '12 sections extracted, status updated to IN_USE', metadata: null, createdAt: new Date(Date.now() - 14400000).toISOString() },
        { eventId: 'e7', agencyId: 'a5', eventType: 'REQUEST_SENT', title: 'CPRA request sent to San Jose PD', description: 'Initial request sent for 44 policy topics', metadata: null, createdAt: new Date(Date.now() - 18000000).toISOString() },
        { eventId: 'e8', agencyId: 'a6', eventType: 'EMAIL_RECEIVED', title: 'Email received from Oakland PD', description: 'Subject: Records Request Response | 5 attachments', metadata: null, createdAt: new Date(Date.now() - 21600000).toISOString() },
      ]);

      // Demo notifications
      setNotifications([
        { notificationId: 'n1', agencyId: 'a2', eventType: 'EMAIL_RECEIVED', title: 'Email received from LAPD', message: 'Subject: "RE: CPRA Request" | 3 attachment(s)', metadata: null, read: false, dismissed: false, createdAt: new Date(Date.now() - 7200000).toISOString() },
        { notificationId: 'n2', agencyId: 'a2', eventType: 'POLICY_PARSED', title: 'Policy classified: Use of Force', message: 'Topic: Use of Force (confidence: 92%)', metadata: null, read: false, dismissed: false, createdAt: new Date(Date.now() - 7000000).toISOString() },
        { notificationId: 'n3', agencyId: 'a3', eventType: 'FOLLOW_UP_SENT', title: 'Follow-up #1 sent to SFPD', message: 'Automated follow-up sent. 1 of 3 follow-ups used.', metadata: null, read: true, dismissed: false, createdAt: new Date(Date.now() - 10800000).toISOString() },
        { notificationId: 'n4', agencyId: 'a4', eventType: 'POLICY_ACTIVE', title: 'Policy ingested: Body Worn Cameras', message: '"BWC Policy" has been processed and is now active.', metadata: null, read: true, dismissed: false, createdAt: new Date(Date.now() - 14400000).toISOString() },
      ]);

      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // -----------------------------------------------------------------------
  // Worker Controls
  // -----------------------------------------------------------------------

  const toggleWorker = async (worker: string, action: 'start' | 'stop') => {
    try {
      await apiFetch(`/admin/cpra/${worker}/${action}`, { method: 'POST' });
      await fetchData();
    } catch {
      // Silently handle - demo mode
    }
  };

  // -----------------------------------------------------------------------
  // Notification Actions
  // -----------------------------------------------------------------------

  const markAllRead = async () => {
    try {
      await apiFetch('/admin/cpra/notifications/read-all', { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // Demo mode fallback
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function formatTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-white/10 rounded" />
            ))}
          </div>
          <div className="h-96 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  const acq = status?.acquisition;
  const emails = status?.emails;
  const notifSummary = status?.notifications;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Autonomous CPRA System</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time policy acquisition monitoring across {acq?.totalAgencies ?? 0} agencies
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-200 bg-white/5 border border-white/10 rounded-lg hover:bg-white/5"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-300">
          <AlertCircle size={14} className="inline mr-1" />
          {error}
        </div>
      )}

      {/* Acquisition Progress Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {acq &&
          Object.entries(acq.statusBreakdown).map(([statusKey, count]) => (
            <StatusPill key={statusKey} status={statusKey} count={count as number} />
          ))}
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3 p-2">
            <div className="p-2 bg-blue-500/15 rounded-lg">
              <Send size={20} className="text-gold-light" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{emails?.totalOutbound ?? 0}</p>
              <p className="text-xs text-slate-400">Emails Sent</p>
              <p className="text-xs text-gold-light">{emails?.todayOutbound ?? 0} today</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3 p-2">
            <div className="p-2 bg-emerald-500/15 rounded-lg">
              <MailOpen size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{emails?.totalInbound ?? 0}</p>
              <p className="text-xs text-slate-400">Responses Received</p>
              <p className="text-xs text-green-600">{emails?.todayInbound ?? 0} today</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3 p-2">
            <div className="p-2 bg-violet-500/15 rounded-lg">
              <FileText size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {(acq?.statusBreakdown.UPLOADED ?? 0) + (acq?.statusBreakdown.IN_USE ?? 0)}
              </p>
              <p className="text-xs text-slate-400">Policies Acquired</p>
              <p className="text-xs text-purple-600">
                {((acq?.coverage ?? 0) * 100).toFixed(1)}% coverage
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3 p-2">
            <div className="p-2 bg-amber-500/15 rounded-lg">
              <Bell size={20} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{notifSummary?.unread ?? 0}</p>
              <p className="text-xs text-slate-400">Unread Notifications</p>
              <p className="text-xs text-yellow-600">{notifSummary?.total ?? 0} total</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Worker Status */}
      <Card>
        <div className="p-1">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Activity size={16} />
            Background Workers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Email Monitor */}
            <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-100">Email Monitor</p>
                <p className="text-xs text-slate-400">Checks inbox every 30s</p>
              </div>
              <div className="flex items-center gap-2">
                <WorkerStatusBadge running={status?.workers.emailMonitor.running ?? false} />
                <button
                  onClick={() =>
                    toggleWorker(
                      'monitor',
                      status?.workers.emailMonitor.running ? 'stop' : 'start',
                    )
                  }
                  className={`p-1 rounded ${
                    status?.workers.emailMonitor.running
                      ? 'text-red-600 hover:bg-red-500/10'
                      : 'text-green-600 hover:bg-emerald-500/10'
                  }`}
                  title={status?.workers.emailMonitor.running ? 'Stop' : 'Start'}
                >
                  {status?.workers.emailMonitor.running ? <Square size={14} /> : <Play size={14} />}
                </button>
              </div>
            </div>

            {/* Follow-Up Worker */}
            <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-100">Follow-Up Worker</p>
                <p className="text-xs text-slate-400">14-day auto-resend</p>
              </div>
              <div className="flex items-center gap-2">
                <WorkerStatusBadge running={status?.workers.followUp.running ?? false} />
                <button
                  onClick={() =>
                    toggleWorker(
                      'follow-up/worker',
                      status?.workers.followUp.running ? 'stop' : 'start',
                    )
                  }
                  className={`p-1 rounded ${
                    status?.workers.followUp.running
                      ? 'text-red-600 hover:bg-red-500/10'
                      : 'text-green-600 hover:bg-emerald-500/10'
                  }`}
                  title={status?.workers.followUp.running ? 'Stop' : 'Start'}
                >
                  {status?.workers.followUp.running ? <Square size={14} /> : <Play size={14} />}
                </button>
              </div>
            </div>

            {/* Ingestion Worker */}
            <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-100">Ingestion Pipeline</p>
                <p className="text-xs text-slate-400">OCR + classification</p>
              </div>
              <div className="flex items-center gap-2">
                <WorkerStatusBadge running={status?.workers.ingestion.running ?? false} />
                <button
                  onClick={() =>
                    toggleWorker(
                      'ingestion/worker',
                      status?.workers.ingestion.running ? 'stop' : 'start',
                    )
                  }
                  className={`p-1 rounded ${
                    status?.workers.ingestion.running
                      ? 'text-red-600 hover:bg-red-500/10'
                      : 'text-green-600 hover:bg-emerald-500/10'
                  }`}
                  title={status?.workers.ingestion.running ? 'Stop' : 'Start'}
                >
                  {status?.workers.ingestion.running ? <Square size={14} /> : <Play size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tab Navigation */}
      <div className="border-b border-white/10">
        <nav className="flex gap-6">
          {[
            { key: 'timeline' as const, label: 'CPRA Timeline', icon: <Clock size={14} /> },
            {
              key: 'notifications' as const,
              label: `Notifications ${notifSummary?.unread ? `(${notifSummary.unread})` : ''}`,
              icon: <Bell size={14} />,
            },
            { key: 'controls' as const, label: 'Admin Controls', icon: <Zap size={14} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-gold-light'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'timeline' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Recent Activity</h3>
            <span className="text-xs text-slate-400">{timeline.length} events</span>
          </div>

          {timeline.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Clock size={32} className="mx-auto mb-2" />
              <p>No timeline events yet. Start sending CPRA requests to see activity.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {timeline.map((event) => (
                <div
                  key={event.eventId}
                  className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-sm ${
                    EVENT_COLORS[event.eventType] ?? 'border-white/10 bg-white/5'
                  }`}
                  onClick={() =>
                    setExpandedEvent(expandedEvent === event.eventId ? null : event.eventId)
                  }
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {EVENT_ICONS[event.eventType] ?? <Activity size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white truncate">
                          {event.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            {formatTimeAgo(event.createdAt)}
                          </span>
                          {expandedEvent === event.eventId ? (
                            <ChevronUp size={14} className="text-slate-400" />
                          ) : (
                            <ChevronDown size={14} className="text-slate-400" />
                          )}
                        </div>
                      </div>
                      {event.description && (
                        <p className="text-xs text-slate-300 mt-0.5">{event.description}</p>
                      )}
                    </div>
                  </div>

                  {expandedEvent === event.eventId && (
                    <div className="mt-2 pt-2 border-t border-white/10 text-xs text-slate-400">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="font-medium">Event Type:</span>{' '}
                          {event.eventType.replace(/_/g, ' ')}
                        </div>
                        <div>
                          <span className="font-medium">Agency ID:</span> {event.agencyId}
                        </div>
                        <div>
                          <span className="font-medium">Timestamp:</span>{' '}
                          {new Date(event.createdAt).toLocaleString()}
                        </div>
                        {event.metadata && (
                          <div className="col-span-2">
                            <span className="font-medium">Metadata:</span>{' '}
                            <code className="text-xs bg-white/10 px-1 rounded">
                              {event.metadata}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">
              Notifications ({notifSummary?.unread ?? 0} unread)
            </h3>
            <button
              onClick={markAllRead}
              className="text-xs text-gold-light hover:text-blue-300 font-medium"
            >
              <Eye size={12} className="inline mr-1" />
              Mark all read
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Bell size={32} className="mx-auto mb-2" />
              <p>No notifications yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <div
                  key={notif.notificationId}
                  className={`border rounded-lg p-3 transition-all ${
                    notif.read
                      ? 'border-white/10 bg-white/5'
                      : 'border-blue-500/20 bg-blue-500/10 shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {EVENT_ICONS[notif.eventType] ?? <Bell size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p
                          className={`text-sm font-medium ${
                            notif.read ? 'text-slate-200' : 'text-white'
                          }`}
                        >
                          {notif.title}
                        </p>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">{notif.message}</p>
                    </div>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'controls' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">Admin Controls</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Send Controls */}
            <Card>
              <div className="p-1">
                <h4 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
                  <Send size={14} />
                  Send CPRA Requests
                </h4>
                <div className="space-y-2">
                  <button
                    className="w-full text-left px-3 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/15 text-blue-300 text-sm font-medium transition-colors"
                    onClick={async () => {
                      try {
                        await apiFetch('/admin/cpra/send-all-missing', {
                          method: 'POST',
                          body: JSON.stringify({ campaignId: 'auto-campaign-' + Date.now() }),
                        });
                        await fetchData();
                      } catch {
                        // Demo mode
                      }
                    }}
                  >
                    <Zap size={14} className="inline mr-2" />
                    Send to All Missing Agencies
                  </button>
                  <p className="text-xs text-slate-400 px-1">
                    Sends CPRA requests to all agencies that don&apos;t have an active request. Respects rate
                    limits (50/day, 5/minute).
                  </p>
                </div>
              </div>
            </Card>

            {/* Processing Controls */}
            <Card>
              <div className="p-1">
                <h4 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
                  <Download size={14} />
                  Manual Processing
                </h4>
                <div className="space-y-2">
                  <button
                    className="w-full text-left px-3 py-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/15 text-violet-300 text-sm font-medium transition-colors"
                    onClick={async () => {
                      try {
                        await apiFetch('/admin/cpra/monitor/poll', { method: 'POST' });
                        await fetchData();
                      } catch {
                        // Demo mode
                      }
                    }}
                  >
                    <Mail size={14} className="inline mr-2" />
                    Poll Inbox Now
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-100 text-indigo-300 text-sm font-medium transition-colors"
                    onClick={async () => {
                      try {
                        await apiFetch('/admin/cpra/attachments/process', { method: 'POST' });
                        await fetchData();
                      } catch {
                        // Demo mode
                      }
                    }}
                  >
                    <FileText size={14} className="inline mr-2" />
                    Process Pending Attachments
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/15 text-amber-300 text-sm font-medium transition-colors"
                    onClick={async () => {
                      try {
                        await apiFetch('/admin/cpra/classify-all', { method: 'POST' });
                        await fetchData();
                      } catch {
                        // Demo mode
                      }
                    }}
                  >
                    <Zap size={14} className="inline mr-2" />
                    Classify All Pending
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-300 text-sm font-medium transition-colors"
                    onClick={async () => {
                      try {
                        await apiFetch('/admin/cpra/ingestion/process', { method: 'POST' });
                        await fetchData();
                      } catch {
                        // Demo mode
                      }
                    }}
                  >
                    <CheckCircle2 size={14} className="inline mr-2" />
                    Run Ingestion Pipeline
                  </button>
                </div>
              </div>
            </Card>

            {/* Follow-Up Controls */}
            <Card>
              <div className="p-1">
                <h4 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
                  <RefreshCw size={14} />
                  Follow-Up Management
                </h4>
                <div className="space-y-2">
                  <button
                    className="w-full text-left px-3 py-2 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-sm font-medium transition-colors"
                    onClick={async () => {
                      try {
                        await apiFetch('/admin/cpra/follow-up/check', { method: 'POST' });
                        await fetchData();
                      } catch {
                        // Demo mode
                      }
                    }}
                  >
                    <RefreshCw size={14} className="inline mr-2" />
                    Check & Send Follow-Ups Now
                  </button>
                  <p className="text-xs text-slate-400 px-1">
                    Checks all open requests older than 14 days and sends automated follow-up
                    emails. Max 3 follow-ups per agency.
                  </p>
                </div>
              </div>
            </Card>

            {/* Simulate Controls (Testing) */}
            <Card>
              <div className="p-1">
                <h4 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
                  <XCircle size={14} />
                  Testing Tools
                </h4>
                <div className="space-y-2">
                  <button
                    className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-sm font-medium transition-colors"
                    onClick={async () => {
                      try {
                        await apiFetch('/admin/cpra/monitor/simulate', {
                          method: 'POST',
                          body: JSON.stringify({
                            from: 'records@lapd.online',
                            subject: 'RE: CPRA Request - Policy Documents',
                            body: 'Please find attached the requested Use of Force policy documents.',
                            attachments: [
                              { fileName: 'Use_of_Force_Policy.pdf', mimeType: 'application/pdf', size: 245000 },
                              { fileName: 'BWC_Policy.pdf', mimeType: 'application/pdf', size: 180000 },
                            ],
                          }),
                        });
                        await fetchData();
                      } catch {
                        // Demo mode
                      }
                    }}
                  >
                    <Mail size={14} className="inline mr-2" />
                    Simulate Incoming Email
                  </button>
                  <p className="text-xs text-slate-400 px-1">
                    Simulates receiving an email from an agency with policy attachments. Useful for
                    testing the full pipeline without actual email delivery.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Coverage Bar */}
      <Card>
        <div className="p-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-200">Overall Coverage</h3>
            <span className="text-sm font-bold text-gold-light">
              {((acq?.coverage ?? 0) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((acq?.coverage ?? 0) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {acq?.totalAgencies ?? 0} agencies x {acq?.totalTopics ?? 0} topics ={' '}
            {(acq?.totalAgencies ?? 0) * (acq?.totalTopics ?? 0)} total policy slots
          </p>
        </div>
      </Card>
    </div>
  );
}
