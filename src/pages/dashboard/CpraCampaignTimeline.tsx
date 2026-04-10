// ============================================================================
// Phase 266 — Policy Acquisition Campaign Visibility: CPRA Timeline
// Tracks CPRA request lifecycle per agency with visual timeline
// ============================================================================

import { useState, useMemo, useEffect } from 'react';
import { Search, Mail, Clock, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '../../components/common/Card';

type CpraStatus = 'draft' | 'sent' | 'acknowledged' | 'partial_response' | 'complete' | 'overdue' | 'denied' | 'appeal';

interface CpraRequest {
  id: string;
  agencyName: string;
  agencyId: string;
  requestDate: string;
  acknowledgedDate: string | null;
  dueDate: string;
  responseDate: string | null;
  status: CpraStatus;
  daysSinceSent: number;
  daysUntilDue: number;
  documentsReceived: number;
  totalExpected: number;
  notes: string;
}

interface TimelineEvent {
  date: string;
  label: string;
  status: 'complete' | 'pending' | 'overdue';
}

const STATUS_CONFIG: Record<CpraStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: <Clock size={14} /> },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: <Mail size={14} /> },
  acknowledged: { label: 'Acknowledged', color: 'bg-indigo-100 text-indigo-700', icon: <CheckCircle size={14} /> },
  partial_response: { label: 'Partial Response', color: 'bg-yellow-100 text-yellow-700', icon: <AlertTriangle size={14} /> },
  complete: { label: 'Complete', color: 'bg-green-100 text-green-700', icon: <CheckCircle size={14} /> },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: <XCircle size={14} /> },
  denied: { label: 'Denied', color: 'bg-red-100 text-red-700', icon: <XCircle size={14} /> },
  appeal: { label: 'Appeal Filed', color: 'bg-orange-100 text-orange-700', icon: <AlertTriangle size={14} /> },
};


export function CpraCampaignTimeline()export function CpraCampaignTimeline() {
  const [allRequests, setAllRequests] = useState<CpraRequest[]>([]);

  useEffect(() => {
    async function fetchRequests() {
      try {
        const res = await fetch('/api/operations/cpra-requests');
        if (res.ok) {
          const json = await res.json();
          if (json.data) setAllRequests(json.data);
        }
      } catch {
        // API not available yet
      }
    }
    fetchRequests();
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredRequests = useMemo(() => {
    let result = allRequests;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => r.agencyName.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }
    return result;
  }, [allRequests, searchQuery, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allRequests.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  }, [allRequests]);

  function getTimeline(req: CpraRequest): TimelineEvent[] {
    const events: TimelineEvent[] = [
      { date: req.requestDate, label: 'Request Sent', status: 'complete' },
    ];
    if (req.acknowledgedDate) {
      events.push({ date: req.acknowledgedDate, label: 'Acknowledged', status: 'complete' });
    }
    if (req.responseDate) {
      events.push({ date: req.responseDate, label: 'Response Received', status: 'complete' });
    }
    if (req.status === 'overdue') {
      events.push({ date: req.dueDate, label: 'Due Date (Overdue)', status: 'overdue' });
    } else if (!req.responseDate) {
      events.push({ date: req.dueDate, label: 'Due Date', status: 'pending' });
    }
    return events;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CPRA Campaign Timeline</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track California Public Records Act request lifecycle for {allRequests.length} agencies
        </p>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).slice(0, 8).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
            className={`p-3 rounded-lg text-left transition-all ${statusFilter === key ? 'ring-2 ring-blue-500' : ''} ${config.color}`}
          >
            <div className="flex items-center gap-2">
              {config.icon}
              <span className="text-xs font-medium">{config.label}</span>
            </div>
            <p className="text-xl font-bold mt-1">{statusCounts[key] || 0}</p>
          </button>
        ))}
      </div>

      {/* Search & Filter */}
      <Card>
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search agencies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Request List */}
      <div className="space-y-3">
        {filteredRequests.map((req) => {
          const config = STATUS_CONFIG[req.status];
          const isExpanded = expandedId === req.id;
          const timeline = getTimeline(req);

          return (
            <Card key={req.id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : req.id)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      {config.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{req.agencyName}</h3>
                      <p className="text-xs text-gray-500">
                        Sent {req.requestDate} &middot; Due {req.dueDate}
                        {req.daysUntilDue < 0 && (
                          <span className="text-red-600 font-medium ml-2">
                            {Math.abs(req.daysUntilDue)} days overdue
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                      {config.label}
                    </span>
                    {req.totalExpected > 0 && (
                      <span className="text-xs text-gray-500">
                        {req.documentsReceived}/{req.totalExpected} docs
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {/* Timeline */}
                  <div className="flex items-center gap-2 mb-4">
                    {timeline.map((event, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                          event.status === 'complete' ? 'bg-green-50 text-green-700' :
                          event.status === 'overdue' ? 'bg-red-50 text-red-700' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {event.status === 'complete' ? <CheckCircle size={12} /> :
                           event.status === 'overdue' ? <XCircle size={12} /> :
                           <Clock size={12} />}
                          <span>{event.label}</span>
                          <span className="font-medium">{event.date}</span>
                        </div>
                        {idx < timeline.length - 1 && (
                          <div className="w-8 h-0.5 bg-gray-200" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  {req.totalExpected > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Documents Received</span>
                        <span className="font-medium">{req.documentsReceived} / {req.totalExpected}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${(req.documentsReceived / req.totalExpected) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {req.notes && (
                    <p className="text-xs text-gray-600 bg-yellow-50 p-2 rounded">
                      <span className="font-medium">Note:</span> {req.notes}
                    </p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {filteredRequests.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Mail size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No CPRA requests match your filter criteria.</p>
        </div>
      )}
    </div>
  );
}
