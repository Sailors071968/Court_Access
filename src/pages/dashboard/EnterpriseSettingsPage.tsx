// ============================================================================
// Program 141 — Enterprise Settings Workspace (Principal/Admin only)
// Role management, permission matrix, case-assignment matrix, billing ownership,
// redaction settings, and audit history. Backed by /api/enterprise/overview
// (principal/admin-gated). Read-oriented: displays the deterministic permission
// policy and real membership/audit data; nothing is fabricated.
// ============================================================================

import { useEffect, useState } from 'react';
import {
  Building2, ShieldCheck, Users, Grid3x3, DollarSign, EyeOff, ScrollText,
  CheckCircle2, Circle, Crown, Loader2, Info,
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';

const API = '/api';
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('court-access-token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Overview {
  principal: { userId: string; email: string; name: string } | null;
  billingOwnership: { ownerEmail: string; note: string; ownedItems: string[] };
  permissions: string[];
  roles: string[];
  permissionMatrix: Record<string, Record<string, boolean>>;
  members: Array<{ userId: string; email: string; name: string; memberRole: string; enterpriseRole: string; status: string; isPrincipal: boolean; caseAssignment: string }>;
  redactionModes: string[];
  audit: Array<{ event: string; userId: string; ip: string | null; details: string | null; at: string }>;
  auditedEvents: string[];
}

const humanize = (s: string) => s.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function EnterpriseSettingsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/enterprise/overview`, { headers: authHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 403 ? ' — Principal/Administrator access required' : ''}`);
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load enterprise settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Loading enterprise settings…</span></div>;
  if (error) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Building2 size={24} className="text-indigo-600" /> Enterprise Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Role management, permission matrix, case assignments, billing ownership, redaction, and audit history. Principal/Administrator access only.</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>Every permission defaults to <strong>OFF</strong>. The permission matrix below is the deterministic role policy; membership and audit data are read live. Supports both individual defendant subscribers and enterprise law firms without architecture changes.</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Users size={20} />} value={data.members.length} label="Members" />
        <StatCard icon={<Grid3x3 size={20} />} value={data.permissions.length} label="Permissions" />
        <StatCard icon={<Crown size={20} />} value={data.principal ? 1 : 0} label="Principal account" />
        <StatCard icon={<ScrollText size={20} />} value={data.audit.length} label="Recent audit events" />
      </div>

      {/* Billing ownership */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><DollarSign size={18} className="text-emerald-600" /> Principal &amp; Billing Ownership</h3>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Crown size={16} className="text-amber-500" />
          <span className="font-medium">Principal Account:</span> {data.principal ? `${data.principal.name} (${data.principal.email})` : 'UNKNOWN'}
        </div>
        <p className="mt-2 text-sm text-gray-600">{data.billingOwnership.note}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.billingOwnership.ownedItems.map((i) => <span key={i} className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700">{i}</span>)}
        </div>
      </Card>

      {/* Role management + case assignment */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><Users size={18} className="text-indigo-600" /> Role Management &amp; Case Assignments</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3">Member</th><th className="py-2 px-2">Role</th><th className="py-2 px-2">Enterprise role</th><th className="py-2 px-2">Case assignment</th><th className="py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.userId} className="border-b border-gray-100">
                  <td className="py-2 pr-3"><span className="font-medium text-gray-800 flex items-center gap-1.5">{m.isPrincipal && <Crown size={12} className="text-amber-500" />}{m.name}</span><span className="block text-xs text-gray-400">{m.email}</span></td>
                  <td className="py-2 px-2 text-gray-600">{m.memberRole}</td>
                  <td className="py-2 px-2"><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{humanize(m.enterpriseRole)}</span></td>
                  <td className="py-2 px-2 text-gray-600">{m.caseAssignment}</td>
                  <td className="py-2 px-2"><span className={`text-xs font-medium ${m.status === 'active' ? 'text-emerald-600' : 'text-gray-500'}`}>{m.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Permission matrix */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><Grid3x3 size={18} className="text-indigo-600" /> Permission Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 pr-3 text-left uppercase tracking-wide text-gray-500 sticky left-0 bg-white">Permission</th>
                {data.roles.map((r) => <th key={r} className="py-2 px-2 text-center text-gray-500">{humanize(r)}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.permissions.map((p) => (
                <tr key={p} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-1.5 pr-3 font-medium text-gray-700 sticky left-0 bg-white">{humanize(p)}</td>
                  {data.roles.map((r) => (
                    <td key={r} className="py-1.5 px-2 text-center">
                      {data.permissionMatrix[r]?.[p]
                        ? <CheckCircle2 size={14} className="mx-auto text-emerald-500" />
                        : <Circle size={12} className="mx-auto text-gray-300" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-400">Green = enabled by the deterministic role policy; empty = OFF (default). The Principal account holds all permissions; designees hold only role-appropriate permissions.</p>
      </Card>

      {/* Redaction */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><EyeOff size={18} className="text-purple-600" /> Redaction Settings</h3>
        <p className="text-sm text-gray-600 mb-2">Every uploaded document supports these redaction modes, selectable per user and per case:</p>
        <div className="flex flex-wrap gap-2">
          {data.redactionModes.map((m) => <span key={m} className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs text-purple-700">{humanize(m)}</span>)}
        </div>
      </Card>

      {/* Audit history */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><ScrollText size={18} className="text-gray-700" /> Audit History</h3>
        {data.audit.length === 0 ? <p className="text-sm text-gray-500">No audit events recorded yet.</p> : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="text-left uppercase tracking-wide text-gray-500 border-b border-gray-200"><th className="py-2 pr-3">Event</th><th className="py-2 px-2">Details</th><th className="py-2 px-2">When</th></tr></thead>
              <tbody>
                {data.audit.map((a, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1.5 pr-3 font-medium text-gray-700">{a.event}</td>
                    <td className="py-1.5 px-2 text-gray-500">{a.details ?? '—'}</td>
                    <td className="py-1.5 px-2 text-gray-400">{new Date(a.at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400"><ShieldCheck size={13} /> Audited events: {data.auditedEvents.join(', ')}</div>
      </Card>
    </div>
  );
}
