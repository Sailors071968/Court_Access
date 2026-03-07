// ============================================
// Court Access — Admin Controls Page (Phase 26)
// User management, storage monitoring, job queue.
// ============================================

import { useState } from 'react';
import {
  Users,
  Briefcase,
  HardDrive,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Shield,
  Clock,
  RefreshCw,
  Ban,
  Eye,
  Database,
  Cpu,
  Wifi,
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'disabled';
  lastLogin: string;
  casesCount: number;
  storageUsedMB: number;
  createdAt: string;
}

interface ProcessingJob {
  jobId: string;
  evidenceId: string;
  fileName: string;
  type: 'document' | 'image' | 'audio' | 'video';
  status: 'queued' | 'processing' | 'complete' | 'failed';
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  userId: string;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_USERS: AdminUser[] = [
  { id: '1', name: 'Attorney Jane Doe', email: 'attorney@courtaccess.com', role: 'Attorney', status: 'active', lastLogin: '2026-03-05T18:00:00Z', casesCount: 5, storageUsedMB: 1240, createdAt: '2026-01-05T00:00:00Z' },
  { id: '2', name: 'Agent J. Doe', email: 'investigator@courtaccess.com', role: 'Investigator', status: 'active', lastLogin: '2026-03-05T16:30:00Z', casesCount: 3, storageUsedMB: 890, createdAt: '2026-01-10T00:00:00Z' },
  { id: '3', name: 'Admin User', email: 'admin@courtaccess.com', role: 'Admin', status: 'active', lastLogin: '2026-03-05T19:45:00Z', casesCount: 0, storageUsedMB: 50, createdAt: '2026-01-01T00:00:00Z' },
  { id: '4', name: 'Staff Member', email: 'staff@courtaccess.com', role: 'Staff', status: 'inactive', lastLogin: '2026-02-28T12:00:00Z', casesCount: 2, storageUsedMB: 430, createdAt: '2026-01-15T00:00:00Z' },
  { id: '5', name: 'John Smith', email: 'client@courtaccess.com', role: 'Client', status: 'active', lastLogin: '2026-03-04T09:00:00Z', casesCount: 1, storageUsedMB: 320, createdAt: '2026-02-01T00:00:00Z' },
  { id: '6', name: 'Sarah Johnson', email: 'sarah.j@example.com', role: 'Attorney', status: 'active', lastLogin: '2026-03-03T14:20:00Z', casesCount: 8, storageUsedMB: 2100, createdAt: '2026-01-20T00:00:00Z' },
  { id: '7', name: 'Test User', email: 'test@example.com', role: 'Client', status: 'disabled', lastLogin: '2026-02-15T10:00:00Z', casesCount: 0, storageUsedMB: 5, createdAt: '2026-02-15T00:00:00Z' },
];

const MOCK_JOBS: ProcessingJob[] = [
  { jobId: 'job-001', evidenceId: 'ev-abc123', fileName: 'Police_Report.pdf', type: 'document', status: 'complete', progress: 100, startedAt: '2026-03-05T18:30:00Z', completedAt: '2026-03-05T18:31:15Z', error: null, userId: '1' },
  { jobId: 'job-002', evidenceId: 'ev-def456', fileName: 'Interview_Recording.mp3', type: 'audio', status: 'processing', progress: 65, startedAt: '2026-03-05T19:00:00Z', completedAt: null, error: null, userId: '2' },
  { jobId: 'job-003', evidenceId: 'ev-ghi789', fileName: 'Crime_Scene_Photo.jpg', type: 'image', status: 'queued', progress: 0, startedAt: null, completedAt: null, error: null, userId: '1' },
  { jobId: 'job-004', evidenceId: 'ev-jkl012', fileName: 'Surveillance_Video.mp4', type: 'video', status: 'processing', progress: 30, startedAt: '2026-03-05T19:10:00Z', completedAt: null, error: null, userId: '6' },
  { jobId: 'job-005', evidenceId: 'ev-mno345', fileName: 'Damaged_Document.pdf', type: 'document', status: 'failed', progress: 45, startedAt: '2026-03-05T17:00:00Z', completedAt: '2026-03-05T17:02:30Z', error: 'OCR extraction failed: corrupted PDF structure on pages 3-5', userId: '1' },
  { jobId: 'job-006', evidenceId: 'ev-pqr678', fileName: 'Audio_Fragment.wav', type: 'audio', status: 'failed', progress: 10, startedAt: '2026-03-05T16:45:00Z', completedAt: '2026-03-05T16:45:30Z', error: 'Audio codec not supported: FLAC inside WAV container', userId: '2' },
];

// ---------------------------------------------------------------------------
// User Table
// ---------------------------------------------------------------------------

function UserTable({
  users,
  onToggleStatus,
}: {
  users: AdminUser[];
  onToggleStatus: (userId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left py-3 px-4 text-gray-500 font-medium">User</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Role</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Cases</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Storage</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Last Login</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-medium">{user.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 text-gray-600">{user.role}</td>
              <td className="py-3 px-4">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  user.status === 'active' ? 'bg-green-100 text-green-700' :
                  user.status === 'disabled' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {user.status === 'active' ? <CheckCircle size={10} /> :
                   user.status === 'disabled' ? <XCircle size={10} /> :
                   <Clock size={10} />}
                  {user.status}
                </span>
              </td>
              <td className="py-3 px-4 text-gray-600">{user.casesCount}</td>
              <td className="py-3 px-4 text-gray-600">
                {user.storageUsedMB >= 1024
                  ? `${(user.storageUsedMB / 1024).toFixed(1)} GB`
                  : `${user.storageUsedMB} MB`}
              </td>
              <td className="py-3 px-4 text-gray-500 text-xs">
                {new Date(user.lastLogin).toLocaleDateString()}{' '}
                {new Date(user.lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-1">
                  <button className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="View details">
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => onToggleStatus(user.id)}
                    className={`p-1.5 rounded ${
                      user.status === 'disabled'
                        ? 'text-green-400 hover:text-green-600'
                        : 'text-gray-400 hover:text-red-600'
                    }`}
                    title={user.status === 'disabled' ? 'Enable account' : 'Disable account'}
                  >
                    {user.status === 'disabled' ? <CheckCircle size={14} /> : <Ban size={14} />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Job Queue
// ---------------------------------------------------------------------------

function JobQueueTable({ jobs, filter }: { jobs: ProcessingJob[]; filter: 'all' | 'active' | 'failed' }) {
  const filtered = jobs.filter((j) => {
    if (filter === 'active') return j.status === 'queued' || j.status === 'processing';
    if (filter === 'failed') return j.status === 'failed';
    return true;
  });

  const typeColors: Record<string, string> = {
    document: 'bg-slate-100 text-slate-700',
    image: 'bg-purple-100 text-purple-700',
    audio: 'bg-amber-100 text-amber-700',
    video: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Job</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">File</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Type</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Progress</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Error</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-gray-400 text-sm">
                No {filter === 'all' ? '' : filter} jobs found
              </td>
            </tr>
          )}
          {filtered.map((job) => (
            <tr key={job.jobId} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-3 px-4 font-mono text-xs text-gray-600">{job.jobId}</td>
              <td className="py-3 px-4 font-medium text-gray-900 truncate max-w-xs">{job.fileName}</td>
              <td className="py-3 px-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[job.type] || 'bg-gray-100 text-gray-500'}`}>
                  {job.type}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  job.status === 'complete' ? 'bg-green-100 text-green-700' :
                  job.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                  job.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {job.status === 'processing' && <Loader2 size={10} className="animate-spin" />}
                  {job.status === 'complete' && <CheckCircle size={10} />}
                  {job.status === 'failed' && <XCircle size={10} />}
                  {job.status === 'queued' && <Clock size={10} />}
                  {job.status}
                </span>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        job.status === 'failed' ? 'bg-red-400' : 'bg-blue-500'
                      }`}
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{job.progress}%</span>
                </div>
              </td>
              <td className="py-3 px-4">
                {job.error ? (
                  <span className="text-xs text-red-600 truncate max-w-xs block" title={job.error}>
                    {job.error.length > 50 ? job.error.slice(0, 50) + '...' : job.error}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </td>
              <td className="py-3 px-4">
                {job.status === 'failed' && (
                  <button className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    <RefreshCw size={10} /> Retry
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Admin Controls Page
// ---------------------------------------------------------------------------

type AdminTab = 'users' | 'jobs' | 'storage' | 'system';

export function AdminControlsPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<AdminUser[]>(MOCK_USERS);
  const [userSearch, setUserSearch] = useState('');
  const [jobFilter, setJobFilter] = useState<'all' | 'active' | 'failed'>('all');

  const handleToggleStatus = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const newStatus = u.status === 'disabled' ? 'active' : 'disabled';
          return { ...u, status: newStatus };
        }
        return u;
      })
    );
  };

  const filteredUsers = users.filter(
    (u) =>
      !userSearch ||
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const totalStorage = users.reduce((sum, u) => sum + u.storageUsedMB, 0);
  const totalCases = users.reduce((sum, u) => sum + u.casesCount, 0);
  const activeJobs = MOCK_JOBS.filter((j) => j.status === 'queued' || j.status === 'processing').length;
  const failedJobs = MOCK_JOBS.filter((j) => j.status === 'failed').length;

  const TABS: { id: AdminTab; label: string; icon: typeof Users }[] = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'jobs', label: 'Job Queue', icon: Activity },
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'system', label: 'System', icon: Shield },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Controls</h1>
        <p className="text-sm text-gray-500 mt-1">User management, monitoring, and system administration</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard icon={<Users size={24} className="text-blue-500" />} value={users.length} label="Total Users" />
        <StatCard icon={<Briefcase size={24} className="text-amber-600" />} value={totalCases} label="Active Cases" />
        <StatCard
          icon={<HardDrive size={24} className="text-purple-500" />}
          value={`${(totalStorage / 1024).toFixed(1)} GB`}
          label="Storage Used"
        />
        <StatCard icon={<Activity size={24} className="text-blue-500" />} value={activeJobs} label="Active Jobs" />
        <StatCard
          icon={<AlertTriangle size={24} className="text-red-500" />}
          value={failedJobs}
          label="Failed Jobs"
          highlight={failedJobs > 0}
        />
        <StatCard icon={<CheckCircle size={24} className="text-green-500" />} value="99.8%" label="Uptime" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64"
                aria-label="Search users"
              />
            </div>
            <span className="text-sm text-gray-500">{filteredUsers.length} users</span>
          </div>
          <Card padding="none">
            <UserTable users={filteredUsers} onToggleStatus={handleToggleStatus} />
          </Card>
        </div>
      )}

      {/* Job Queue Tab */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {(['all', 'active', 'failed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setJobFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  jobFilter === f
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? 'All Jobs' : f === 'active' ? 'Active' : 'Failed'}
                {f === 'failed' && failedJobs > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px]">
                    {failedJobs}
                  </span>
                )}
              </button>
            ))}
          </div>
          <Card padding="none">
            <JobQueueTable jobs={MOCK_JOBS} filter={jobFilter} />
          </Card>
        </div>
      )}

      {/* Storage Tab */}
      {activeTab === 'storage' && (
        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Storage Usage by User</h3>
            <div className="space-y-3">
              {[...users]
                .sort((a, b) => b.storageUsedMB - a.storageUsedMB)
                .map((user) => {
                  const maxStorage = 10240; // 10GB max for display
                  const pct = Math.min(100, (user.storageUsedMB / maxStorage) * 100);
                  return (
                    <div key={user.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">{user.name}</span>
                          <span className="text-xs text-gray-400">({user.email})</span>
                        </div>
                        <span className="text-sm text-gray-600 font-medium">
                          {user.storageUsedMB >= 1024
                            ? `${(user.storageUsedMB / 1024).toFixed(1)} GB`
                            : `${user.storageUsedMB} MB`}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-blue-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>

          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Storage by Type</h3>
              <div className="space-y-3">
                {[
                  { type: 'Documents', size: 1850, color: 'bg-slate-500' },
                  { type: 'Images', size: 920, color: 'bg-purple-500' },
                  { type: 'Audio', size: 1430, color: 'bg-amber-500' },
                  { type: 'Video', size: 835, color: 'bg-blue-500' },
                ].map(({ type, size, color }) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${color}`} />
                      <span className="text-sm text-gray-700">{type}</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {size >= 1024 ? `${(size / 1024).toFixed(1)} GB` : `${size} MB`}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Storage Limits</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-600">Total Used</span>
                    <span className="text-sm font-medium text-gray-900">{(totalStorage / 1024).toFixed(1)} GB / 50 GB</span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min(100, (totalStorage / (50 * 1024)) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>R2 bucket: courtaccess-evidence</p>
                  <p>Region: us-east-1 (auto)</p>
                  <p>Encryption: AES-256 at rest</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && (
        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">System Services</h3>
            <div className="space-y-2">
              {[
                { name: 'API Server (Fastify)', status: 'operational', icon: Cpu, latency: '12ms' },
                { name: 'PostgreSQL Database', status: 'operational', icon: Database, latency: '3ms' },
                { name: 'Cloudflare R2 Storage', status: 'operational', icon: HardDrive, latency: '45ms' },
                { name: 'AI Analysis Engine', status: 'operational', icon: Activity, latency: '230ms' },
                { name: 'Search Index (Evidence)', status: 'operational', icon: Search, latency: '8ms' },
                { name: 'Email Service (SES)', status: 'operational', icon: Wifi, latency: '180ms' },
                { name: 'Stripe Payments', status: 'operational', icon: Shield, latency: '95ms' },
              ].map(({ name, status, icon: Icon, latency }) => (
                <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Icon size={16} className="text-gray-400" />
                    <span className="text-sm text-gray-700">{name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400">{latency}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCircle size={10} />
                      {status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Tenant Isolation Status</h3>
            <div className="space-y-2">
              {[
                { check: 'Storage Path Isolation', status: 'PASS', detail: 'All evidence stored under /evidence/{tenantId}/' },
                { check: 'Database Query Scoping', status: 'PASS', detail: 'All queries include tenantId WHERE clause' },
                { check: 'API Route Protection', status: 'PASS', detail: 'Tenant context extracted from JWT and validated' },
                { check: 'Search Index Isolation', status: 'PASS', detail: 'Search index scoped per tenant' },
                { check: 'Cross-Tenant Access Prevention', status: 'PASS', detail: 'No cross-tenant data leakage detected' },
              ].map(({ check, status, detail }) => (
                <div key={check} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-800">{check}</span>
                    <p className="text-xs text-gray-500">{detail}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-mono rounded">{status}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
