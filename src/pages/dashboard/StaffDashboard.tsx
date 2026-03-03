// ============================================
// Court Access — Staff Dashboard
// Operational control center for legal professionals
// ============================================

import { useNavigate } from 'react-router-dom';
import {
  FileText, Scale, Calendar, Lightbulb, AlertTriangle, Search as SearchIcon,
  Plus, Upload, BarChart3, Users, Clock, TrendingUp, Briefcase
} from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { AIStatusBadge } from '../../components/common/StatusBadge';
import { DemoModeBadge } from '../../components/common/DemoModeBadge';
import { STATUS_COLORS, TEXT_COLORS } from '../../constants/designTokens';
import { caseDataProvider } from '../../services/caseDataProvider';
import { useAuthStore } from '../../stores/authStore';

export function StaffDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { getPrimaryCase, getDocuments, getActivity, getDocumentTypeLabels } = caseDataProvider;
  const primaryCase = getPrimaryCase();
  const documents = getDocuments(primaryCase.id);
  const activity = getActivity(primaryCase.id);
  const documentTypeLabels = getDocumentTypeLabels();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name}</p>
        </div>
        <DemoModeBadge />
      </div>

      {/* 1. Case Overview Panel */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<Briefcase size={28} className={TEXT_COLORS.info} />}
          value={3}
          label="Active Cases"
          onClick={() => navigate('/cases?status=active')}
        />
        <StatCard
          icon={<Plus size={28} className={TEXT_COLORS.success} />}
          value={1}
          label="New Cases (7 Days)"
          trend="+1 this week"
          onClick={() => navigate('/cases?sort=newest')}
        />
        <StatCard
          icon={<AlertTriangle size={28} className={TEXT_COLORS.danger} />}
          value={2}
          label="Action Required"
          highlight
          onClick={() => navigate('/cases?filter=action-needed')}
        />
        <StatCard
          icon={<Calendar size={28} className={TEXT_COLORS.info} />}
          value="Feb 15"
          label="Next Hearing"
          onClick={() => navigate(`/cases/${primaryCase.id}/activity`)}
        />
        <StatCard
          icon={<Lightbulb size={28} className={TEXT_COLORS.warning} />}
          value={8}
          label="Intelligence Signals"
          highlight
          onClick={() => navigate(`/cases/${primaryCase.id}/charges`)}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 2. Alerts & Action Queue */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Alerts & Action Queue</h2>
              <span className="text-xs text-gray-400">Sorted by urgency</span>
            </div>
            <div className="space-y-3">
              {[
                { type: 'high', icon: AlertTriangle, color: STATUS_COLORS.danger, label: 'Evidence dispute added — People v. Smith', time: '2 hours ago' },
                { type: 'high', icon: Lightbulb, color: STATUS_COLORS.warning, label: 'Motion recommendation signal: Motion to Suppress (HIGH)', time: '4 hours ago' },
                { type: 'medium', icon: Upload, color: STATUS_COLORS.info, label: 'New client upload — 3 documents pending review', time: '6 hours ago' },
                { type: 'medium', icon: Users, color: STATUS_COLORS.accent, label: 'Expert recommendation flagged: Forensic Toxicologist', time: '1 day ago' },
                { type: 'low', icon: Clock, color: STATUS_COLORS.neutral, label: 'Discovery deadline approaching — Case #2024-CF-001234', time: '2 days ago' },
              ].map((alert, i) => {
                const Icon = alert.icon;
                return (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${alert.color}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{alert.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{alert.time}</p>
                    </div>
                    {alert.type === 'high' && (
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium flex-shrink-0">Urgent</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Recent Documents */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Documents</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">Document Name</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">Filed Date</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">Type</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">AI Status</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.slice(0, 3).map((doc) => (
                    <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/cases/${primaryCase.id}/documents`)}>
                      <td className="py-3 px-2 font-medium text-gray-900">{doc.name}</td>
                      <td className="py-3 px-2 text-gray-500">{doc.filedDate}</td>
                      <td className="py-3 px-2 text-gray-500">{documentTypeLabels[doc.type]}</td>
                      <td className="py-3 px-2"><AIStatusBadge status={doc.aiStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* 3. Case Intelligence Overview */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Case Intelligence Overview</h2>
            <div className="space-y-3">
              {[
                { label: 'Priority cases', value: '1', color: TEXT_COLORS.danger },
                { label: 'Prosecution Vulnerabilities', value: '3', color: TEXT_COLORS.warning },
                { label: 'Sentencing Exposure Flags', value: '2', color: TEXT_COLORS.orange },
                { label: 'Procedural deadline warnings', value: '1', color: TEXT_COLORS.info },
              ].map((insight, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                  <span className="text-sm text-gray-700">{insight.label}</span>
                  <span className={`text-sm font-bold ${insight.color}`}>{insight.value}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate(`/cases/${primaryCase.id}/charges`)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors w-full justify-center"
            >
              <TrendingUp size={16} />
              View Full Analysis
            </button>
          </Card>

          {/* 4. Calendar Widget */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Schedule</h2>
            <div className="space-y-3">
              {[
                { type: 'hearing', label: 'Hearing — People v. Smith', date: 'Feb 15, 2024', icon: Scale },
                { type: 'deadline', label: 'Filing Deadline — Motion to Suppress', date: 'Feb 20, 2024', icon: Clock },
                { type: 'discovery', label: 'Discovery Deadline', date: 'Mar 1, 2024', icon: FileText },
              ].map((event, i) => {
                const Icon = event.icon;
                return (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-50 text-blue-600">
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{event.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{event.date}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 6. Quick Actions */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'New Case', icon: Plus, action: () => navigate('/cases') },
                { label: 'Upload Evidence', icon: Upload, action: () => navigate(`/cases/${primaryCase.id}/evidence`) },
                { label: 'Charge Analysis', icon: BarChart3, action: () => navigate(`/cases/${primaryCase.id}/charges`) },
                { label: 'Expert Review', icon: Users, action: () => navigate(`/cases/${primaryCase.id}/experts`) },
              ].map((action, i) => {
                const Icon = action.icon;
                return (
                  <button
                    key={i}
                    onClick={action.action}
                    className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    <Icon size={16} className="text-gray-500" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {activity.slice(0, 3).map((item) => (
                <div key={item.id} className="flex gap-3 pb-3 border-b border-gray-50 last:border-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.type === 'document' ? 'bg-orange-100 text-orange-600' :
                    item.type === 'hearing' ? 'bg-blue-100 text-blue-600' :
                    'bg-green-100 text-green-600'
                  }`}>
                    {item.type === 'document' ? <FileText size={14} /> :
                     item.type === 'hearing' ? <Calendar size={14} /> :
                     <Lightbulb size={14} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* 5. Global Search Prompt */}
      <Card>
        <div className="flex items-center gap-3">
          <SearchIcon size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search cases, documents, statutes, motions, evidence..."
            className="flex-1 text-sm text-gray-700 bg-transparent outline-none placeholder-gray-400"
            onFocus={() => navigate('/search')}
            readOnly
          />
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Ctrl+K</span>
        </div>
      </Card>
    </div>
  );
}
