// ============================================
// Court Access — Beta Management Page (Phase 20: Beta Launch)
// Invite-based signup, user management, upload limits, onboarding status.
// ============================================

import { useState } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Copy,
  Search,
  Download,
  BarChart3,
  HardDrive,
  FileText,
  AlertTriangle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
type UserStatus = 'active' | 'onboarding' | 'inactive' | 'suspended';

interface BetaInvite {
  id: string;
  email: string;
  role: string;
  status: InviteStatus;
  inviteCode: string;
  sentAt: string;
  acceptedAt: string | null;
  expiresAt: string;
}

interface BetaUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: UserStatus;
  joinedAt: string;
  lastActive: string;
  casesCreated: number;
  evidenceUploaded: number;
  storageMB: number;
  onboardingComplete: boolean;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const INVITES: BetaInvite[] = [
  { id: 'inv-1', email: 'johnson@defensefirm.com', role: 'Attorney', status: 'accepted', inviteCode: 'CA-M1A2B3', sentAt: '2026-02-28', acceptedAt: '2026-03-01', expiresAt: '2026-03-07' },
  { id: 'inv-2', email: 'garcia@investigations.com', role: 'Investigator', status: 'accepted', inviteCode: 'CA-N4C5D6', sentAt: '2026-03-01', acceptedAt: '2026-03-02', expiresAt: '2026-03-08' },
  { id: 'inv-3', email: 'thompson@legalresearch.edu', role: 'Researcher', status: 'pending', inviteCode: 'CA-P7E8F9', sentAt: '2026-03-04', acceptedAt: null, expiresAt: '2026-03-11' },
  { id: 'inv-4', email: 'williams@publicdefender.gov', role: 'Attorney', status: 'pending', inviteCode: 'CA-Q0G1H2', sentAt: '2026-03-05', acceptedAt: null, expiresAt: '2026-03-12' },
  { id: 'inv-5', email: 'chen@lawoffice.com', role: 'Attorney', status: 'expired', inviteCode: 'CA-R3I4J5', sentAt: '2026-02-20', acceptedAt: null, expiresAt: '2026-02-27' },
];

const USERS: BetaUser[] = [
  { id: 'u-1', name: 'Robert Johnson', email: 'johnson@defensefirm.com', role: 'Attorney', status: 'active', joinedAt: '2026-03-01', lastActive: '2026-03-05T18:30:00Z', casesCreated: 3, evidenceUploaded: 28, storageMB: 245, onboardingComplete: true },
  { id: 'u-2', name: 'Maria Garcia', email: 'garcia@investigations.com', role: 'Investigator', status: 'active', joinedAt: '2026-03-02', lastActive: '2026-03-05T16:00:00Z', casesCreated: 1, evidenceUploaded: 15, storageMB: 180, onboardingComplete: true },
  { id: 'u-3', name: 'Demo Attorney', email: 'demo@courtaccess.net', role: 'Attorney', status: 'active', joinedAt: '2026-02-15', lastActive: '2026-03-05T12:00:00Z', casesCreated: 2, evidenceUploaded: 12, storageMB: 89, onboardingComplete: true },
];

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: InviteStatus | UserStatus }) {
  const config: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'bg-amber-100', text: 'text-amber-700' },
    accepted: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    expired: { bg: 'bg-slate-100', text: 'text-slate-500' },
    revoked: { bg: 'bg-red-100', text: 'text-red-700' },
    active: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    onboarding: { bg: 'bg-blue-100', text: 'text-blue-700' },
    inactive: { bg: 'bg-slate-100', text: 'text-slate-500' },
    suspended: { bg: 'bg-red-100', text: 'text-red-700' },
  };
  const c = config[status] ?? { bg: 'bg-slate-100', text: 'text-slate-500' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function MetricCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500">{label}</span>
        <Icon size={18} className="text-slate-400" />
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function StorageBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100);
  const color = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500">{used}/{limit} MB</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BetaManagementPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'invites' | 'limits'>('users');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Attorney');

  const filteredUsers = USERS.filter(
    (u) => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Beta Management</h1>
            <p className="text-sm text-slate-500 mt-1">Manage beta testers, invitations, and usage limits</p>
          </div>
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            <UserPlus size={14} />
            Invite Beta Tester
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard icon={Users} label="Active Beta Users" value={String(USERS.filter((u) => u.status === 'active').length)} sub={`of ${INVITES.filter((i) => i.status === 'accepted').length} accepted invites`} />
          <MetricCard icon={Mail} label="Pending Invites" value={String(INVITES.filter((i) => i.status === 'pending').length)} sub={`${INVITES.length} total sent`} />
          <MetricCard icon={FileText} label="Total Evidence" value={String(USERS.reduce((s, u) => s + u.evidenceUploaded, 0))} sub={`across ${USERS.reduce((s, u) => s + u.casesCreated, 0)} cases`} />
          <MetricCard icon={HardDrive} label="Storage Used" value={`${(USERS.reduce((s, u) => s + u.storageMB, 0) / 1024).toFixed(1)} GB`} sub="of 10 GB beta allocation" />
        </div>

        {/* Invite Form */}
        {showInviteForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Send Beta Invite</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="attorney@lawfirm.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option>Attorney</option>
                  <option>Investigator</option>
                  <option>Researcher</option>
                </select>
              </div>
              <div className="flex items-end">
                <button className="w-full px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
                  Send Invite
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Invite expires in 7 days. The recipient will receive an email with a unique invite code to create their beta account.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg border border-slate-200 p-1 w-fit">
          {[
            { id: 'users' as const, label: 'Beta Users' },
            { id: 'invites' as const, label: 'Invitations' },
            { id: 'limits' as const, label: 'Usage Limits' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Beta Users</h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
                <button className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
                  <Download size={12} />
                  Export
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">User</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Role</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Cases</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Evidence</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Storage</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Last Active</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <div className="text-sm font-medium text-slate-900">{user.name}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm text-slate-600">{user.role}</span>
                      </td>
                      <td className="px-6 py-3"><StatusBadge status={user.status} /></td>
                      <td className="px-6 py-3 text-sm text-slate-600">{user.casesCreated}</td>
                      <td className="px-6 py-3 text-sm text-slate-600">{user.evidenceUploaded}</td>
                      <td className="px-6 py-3 w-40">
                        <StorageBar used={user.storageMB} limit={500} />
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        {new Date(user.lastActive).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3">
                        <button className="p-1 hover:bg-slate-100 rounded">
                          <MoreHorizontal size={14} className="text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Invites Tab */}
        {activeTab === 'invites' && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Invitations</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Email</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Role</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Code</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Sent</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Expires</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {INVITES.map((invite) => (
                    <tr key={invite.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-6 py-3 text-sm text-slate-900">{invite.email}</td>
                      <td className="px-6 py-3 text-sm text-slate-600">{invite.role}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">{invite.inviteCode}</code>
                          <button className="p-0.5 hover:bg-slate-100 rounded">
                            <Copy size={10} className="text-slate-400" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-3"><StatusBadge status={invite.status} /></td>
                      <td className="px-6 py-3 text-xs text-slate-500">{invite.sentAt}</td>
                      <td className="px-6 py-3 text-xs text-slate-500">{invite.expiresAt}</td>
                      <td className="px-6 py-3">
                        {invite.status === 'pending' && (
                          <div className="flex items-center gap-1">
                            <button className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50">Resend</button>
                            <button className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50">Revoke</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Limits Tab */}
        {activeTab === 'limits' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Beta Usage Limits</h2>
              <p className="text-sm text-slate-500 mb-6">These limits apply to all beta users. Limits can be adjusted per-user if needed.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: 'Max Cases per User', value: '5', desc: 'Maximum number of active cases' },
                  { label: 'Max Evidence per Case', value: '50', desc: 'Maximum evidence items per case' },
                  { label: 'Max Storage per User', value: '500 MB', desc: 'Total file storage allocation' },
                  { label: 'Max Collaborators per Case', value: '3', desc: 'Team members per case' },
                  { label: 'Max File Upload Size', value: '200 MB', desc: 'Single file upload limit' },
                  { label: 'Daily Upload Limit', value: '1 GB', desc: 'Total uploads per day' },
                ].map((limit) => (
                  <div key={limit.label} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{limit.label}</div>
                      <div className="text-xs text-slate-500">{limit.desc}</div>
                    </div>
                    <div className="text-lg font-bold text-slate-900">{limit.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Enabled Features</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { name: 'Evidence Upload', enabled: true },
                  { name: 'Document Analysis', enabled: true },
                  { name: 'Audio Transcription', enabled: true },
                  { name: 'Video Analysis', enabled: true },
                  { name: 'Image OCR', enabled: true },
                  { name: 'Evidence Search', enabled: true },
                  { name: 'Timeline Builder', enabled: true },
                  { name: 'Case Export', enabled: true },
                  { name: 'Collaboration', enabled: true },
                  { name: 'Annotations', enabled: true },
                  { name: 'AI Summaries', enabled: false },
                  { name: 'Relationship Graph', enabled: false },
                ].map((feature) => (
                  <div
                    key={feature.name}
                    className={`flex items-center gap-2 p-3 rounded-lg border ${
                      feature.enabled
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    {feature.enabled ? (
                      <CheckCircle size={14} className="text-emerald-500" />
                    ) : (
                      <XCircle size={14} className="text-slate-400" />
                    )}
                    <span className={`text-xs font-medium ${feature.enabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {feature.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Beta Launch Checklist */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Beta Launch Checklist</h2>
              <div className="space-y-3">
                {[
                  { task: 'Upload pipeline stable', done: true },
                  { task: 'Document analysis working', done: true },
                  { task: 'Audio transcription working', done: true },
                  { task: 'Search functionality verified', done: true },
                  { task: 'Case dashboard rendering correctly', done: true },
                  { task: 'Invite-based signup system active', done: true },
                  { task: 'Upload limits enforced', done: true },
                  { task: 'Error monitoring active', done: true },
                  { task: 'Terms of Service page published', done: true },
                  { task: 'Privacy Policy page published', done: true },
                  { task: 'Onboarding flow tested', done: true },
                  { task: 'Mobile layout verified', done: true },
                  { task: 'Video analysis pipeline stable', done: false },
                  { task: 'Relationship graph visualization', done: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {item.done ? (
                      <CheckCircle size={16} className="text-emerald-500" />
                    ) : (
                      <AlertTriangle size={16} className="text-amber-500" />
                    )}
                    <span className={`text-sm ${item.done ? 'text-slate-700' : 'text-amber-700 font-medium'}`}>
                      {item.task}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <BarChart3 size={14} className="text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">
                    Beta Readiness: 86% (12/14 items complete)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
