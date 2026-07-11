// ============================================================================
// CourtAccess — Government Outreach Dashboard (/dashboard/government-outreach)
// Phase 215: Government sales tracking for institutional outreach
// ============================================================================

import { useState, useEffect } from 'react';
import {
  Building2,
  UserPlus,
  Phone,
  Calendar,
  CheckCircle2,
  XCircle,
  Rocket,
  FileText,
  MapPin,
  Mail,
  ChevronRight,
  Plus,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

interface GovernmentLeadRecord {
  id: string;
  agencyName: string;
  contactName: string;
  role: string;
  email: string;
  county: string;
  status: string;
  notes: string;
  agencyType: string;
  seatEstimate: number;
  createdAt: string;
}

const STATUS_PIPELINE: { key: string; label: string; color: string; icon: React.ElementType }[] = [
  { key: 'new', label: 'New', color: 'bg-blue-500/15 text-blue-300', icon: UserPlus },
  { key: 'contacted', label: 'Contacted', color: 'bg-amber-500/15 text-amber-300', icon: Phone },
  { key: 'demo_scheduled', label: 'Demo Scheduled', color: 'bg-violet-500/15 text-violet-300', icon: Calendar },
  { key: 'demo_completed', label: 'Demo Completed', color: 'bg-indigo-100 text-indigo-300', icon: CheckCircle2 },
  { key: 'contract_discussion', label: 'Contract Discussion', color: 'bg-cyan-100 text-cyan-700', icon: FileText },
  { key: 'pilot_active', label: 'Pilot Active', color: 'bg-emerald-500/15 text-emerald-300', icon: Rocket },
  { key: 'closed_won', label: 'Closed Won', color: 'bg-emerald-500/15 text-emerald-300', icon: CheckCircle2 },
  { key: 'closed_lost', label: 'Closed Lost', color: 'bg-red-500/15 text-red-300', icon: XCircle },
];

const STORAGE_KEY = 'courtaccess_government_leads';

export function GovernmentOutreachDashboard() {
  const [leads, setLeads] = useState<GovernmentLeadRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({
    agencyName: '',
    contactName: '',
    role: '',
    email: '',
    county: '',
    agencyType: 'District Attorney Office',
    seatEstimate: 10,
    notes: '',
    status: 'new',
  });

  const loadLeads = () => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as GovernmentLeadRecord[];
    setLeads(stored.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  useEffect(() => { loadLeads(); }, []);

  const handleAddLead = (e: React.FormEvent) => {
    e.preventDefault();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as GovernmentLeadRecord[];
    stored.push({
      ...form,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setShowForm(false);
    setForm({ agencyName: '', contactName: '', role: '', email: '', county: '', agencyType: 'District Attorney Office', seatEstimate: 10, notes: '', status: 'new' });
    loadLeads();
  };

  const updateStatus = (id: string, newStatus: string) => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as GovernmentLeadRecord[];
    const updated = stored.map((l) => l.id === id ? { ...l, status: newStatus } : l);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    loadLeads();
  };

  const filtered = filter === 'all' ? leads : leads.filter((l) => l.status === filter);
  const statusCounts = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  const totalSeats = leads.reduce((sum, l) => sum + l.seatEstimate, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Government Outreach</h1>
          <p className="text-sm text-slate-400 mt-1">Track institutional sales pipeline and agency contacts</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadLeads} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-200 bg-white/5 border border-white/10 rounded-lg hover:bg-white/5">
            <RefreshCw size={14} />
            Refresh
          </button>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-400">
            <Plus size={14} />
            Add Lead
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={14} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-400">Total Leads</span>
          </div>
          <p className="text-2xl font-bold text-white">{leads.length}</p>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Rocket size={14} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-400">Active Pilots</span>
          </div>
          <p className="text-2xl font-bold text-white">{statusCounts['pilot_active'] || 0}</p>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-400">Seat Pipeline</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalSeats}</p>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-400">Closed Won</span>
          </div>
          <p className="text-2xl font-bold text-white">{statusCounts['closed_won'] || 0}</p>
        </div>
      </div>

      {/* Pipeline Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            filter === 'all' ? 'bg-amber-500/10 border-amber-300 text-amber-300' : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/10'
          }`}
        >
          All ({leads.length})
        </button>
        {STATUS_PIPELINE.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(filter === s.key ? 'all' : s.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filter === s.key ? 'bg-amber-500/10 border-amber-300 text-amber-300' : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/10'
            }`}
          >
            {s.label} ({statusCounts[s.key] || 0})
          </button>
        ))}
      </div>

      {/* Add Lead Form Modal */}
      {showForm && (
        <div className="bg-white/5 rounded-xl border border-white/10 p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Add Government Lead</h3>
          <form onSubmit={handleAddLead} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Agency Name *</label>
              <input type="text" value={form.agencyName} onChange={(e) => setForm({ ...form, agencyName: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Contact Name *</label>
              <input type="text" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Role</label>
              <input type="text" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">County</label>
              <input type="text" value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Agency Type</label>
              <select value={form.agencyType} onChange={(e) => setForm({ ...form, agencyType: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm bg-white/5">
                <option>District Attorney Office</option>
                <option>Public Defender Office</option>
                <option>Criminal Defense Firm</option>
                <option>State Agency</option>
                <option>Federal Defender Office</option>
                <option>Investigation Agency</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Estimated Seats</label>
              <input type="number" value={form.seatEstimate} onChange={(e) => setForm({ ...form, seatEstimate: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm" min="1" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-200 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-white/10 text-sm resize-none" rows={2} />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-400">Add Lead</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-slate-300 bg-white/10 rounded-lg hover:bg-gray-200">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Leads List */}
      {filtered.length === 0 ? (
        <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
          <Building2 className="mx-auto mb-4 text-gray-300" size={48} />
          <h3 className="text-lg font-semibold text-slate-200 mb-2">No Government Leads</h3>
          <p className="text-sm text-slate-400">Add leads to track your government outreach pipeline.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => {
            const statusInfo = STATUS_PIPELINE.find((s) => s.key === lead.status) || STATUS_PIPELINE[0];
            return (
              <div key={lead.id} className="bg-white/5 rounded-xl border border-white/10 p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-base font-semibold text-white truncate">{lead.agencyName}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <UserPlus size={13} className="text-slate-400" />
                        <span className="truncate">{lead.contactName}</span>
                      </div>
                      {lead.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail size={13} className="text-slate-400" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      )}
                      {lead.county && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-slate-400" />
                          <span className="truncate">{lead.county}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Building2 size={13} className="text-slate-400" />
                        <span className="truncate">{lead.seatEstimate} seats</span>
                      </div>
                    </div>
                    {lead.notes && (
                      <p className="mt-2 text-xs text-slate-400 bg-white/5 rounded p-2">{lead.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {STATUS_PIPELINE.filter((s) => s.key !== lead.status).slice(0, 3).map((s) => (
                      <button
                        key={s.key}
                        onClick={() => updateStatus(lead.id, s.key)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
                      >
                        <ChevronRight size={10} />
                        {s.label}
                      </button>
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
