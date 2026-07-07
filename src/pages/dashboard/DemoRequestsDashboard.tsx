// ============================================================================
// CourtAccess — Demo Requests Dashboard (/dashboard/demo-requests)
// Phase 211: Admin dashboard for managing government demo requests
// ============================================================================

import { useState, useEffect } from 'react';
import {
  Send,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Mail,
  Building2,
  MapPin,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

interface DemoRequestRecord {
  id: string;
  name: string;
  organization: string;
  role: string;
  email: string;
  county: string;
  agencyType: string;
  message: string;
  status: string;
  submittedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-700', icon: Send },
  contacted: { label: 'Contacted', color: 'bg-amber-100 text-amber-700', icon: Mail },
  scheduled: { label: 'Scheduled', color: 'bg-purple-100 text-purple-700', icon: Calendar },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export function DemoRequestsDashboard() {
  const [requests, setRequests] = useState<DemoRequestRecord[]>([]);
  const [filter, setFilter] = useState<string>('all');

  const loadRequests = () => {
    const stored = JSON.parse(localStorage.getItem('courtaccess_demo_requests') || '[]') as DemoRequestRecord[];
    setRequests(stored.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const updateStatus = (id: string, newStatus: string) => {
    const stored = JSON.parse(localStorage.getItem('courtaccess_demo_requests') || '[]') as DemoRequestRecord[];
    const updated = stored.map((r) => r.id === id ? { ...r, status: newStatus } : r);
    localStorage.setItem('courtaccess_demo_requests', JSON.stringify(updated));
    loadRequests();
  };

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);

  const statusCounts = requests.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Demo Requests</h1>
          <p className="text-sm text-slate-400 mt-1">Manage government and enterprise demonstration requests</p>
        </div>
        <button
          onClick={loadRequests}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-200 bg-white/5 border border-white/10 rounded-lg hover:bg-white/5"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const StatusIcon = config.icon;
          return (
            <button
              key={key}
              onClick={() => setFilter(filter === key ? 'all' : key)}
              className={`p-4 rounded-xl border text-left transition-colors ${
                filter === key ? 'border-amber-300 bg-amber-50' : 'border-white/10 bg-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <StatusIcon size={14} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-400">{config.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{statusCounts[key] || 0}</p>
            </button>
          );
        })}
      </div>

      {/* Requests List */}
      {filtered.length === 0 ? (
        <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
          <Send className="mx-auto mb-4 text-gray-300" size={48} />
          <h3 className="text-lg font-semibold text-slate-200 mb-2">No Demo Requests</h3>
          <p className="text-sm text-slate-400">
            {filter === 'all'
              ? 'Demo requests submitted through /demo will appear here.'
              : `No requests with status "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((req) => {
            const statusInfo = STATUS_CONFIG[req.status] || STATUS_CONFIG.new;
            return (
              <div key={req.id} className="bg-white/5 rounded-xl border border-white/10 p-6 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white truncate">{req.name}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-300 mb-3">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={14} className="text-slate-500" />
                        <span className="truncate">{req.organization}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Mail size={14} className="text-slate-500" />
                        <span className="truncate">{req.email}</span>
                      </div>
                      {req.county && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={14} className="text-slate-500" />
                          <span className="truncate">{req.county}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>{req.agencyType}</span>
                      <span>{req.role}</span>
                      <span><Clock size={12} className="inline mr-1" />{new Date(req.submittedAt).toLocaleDateString()}</span>
                    </div>
                    {req.message && (
                      <p className="mt-3 text-sm text-slate-400 bg-white/5 rounded-lg p-3 border border-white/10">
                        {req.message}
                      </p>
                    )}
                  </div>

                  {/* Status Actions */}
                  <div className="flex flex-col gap-1 shrink-0">
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                      key !== req.status && (
                        <button
                          key={key}
                          onClick={() => updateStatus(req.id, key)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                        >
                          <ChevronRight size={12} />
                          {config.label}
                        </button>
                      )
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
