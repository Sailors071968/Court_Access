// ============================================
// Court Access — Client Dashboard
// Transparency + reassurance. Simplified view.
// No internal analysis mechanics exposed.
// ============================================

import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, Download, Clock, CheckCircle, User, Scale } from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { DemoModeBadge } from '../../components/common/DemoModeBadge';
import { STATUS_COLORS } from '../../constants/designTokens';
import { caseDataProvider } from '../../services/caseDataProvider';
import { useAuthStore } from '../../stores/authStore';

// Case phase for client view
type CasePhase = 'preliminary' | 'pretrial' | 'trial' | 'sentencing' | 'closed';

const CASE_PHASE_CONFIG: Record<CasePhase, { label: string; bgColor: string; textColor: string }> = {
  preliminary: { label: 'Preliminary', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  pretrial: { label: 'Pretrial', bgColor: 'bg-amber-100', textColor: 'text-amber-800' },
  trial: { label: 'Trial', bgColor: 'bg-red-100', textColor: 'text-red-800' },
  sentencing: { label: 'Sentencing', bgColor: 'bg-purple-100', textColor: 'text-purple-800' },
  closed: { label: 'Closed', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },
};

export function ClientDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { getPrimaryCase, getDocuments } = caseDataProvider;
  const primaryCase = getPrimaryCase();
  const documents = getDocuments(primaryCase.id);
  const currentPhase: CasePhase = 'pretrial';
  const phaseConfig = CASE_PHASE_CONFIG[currentPhase];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Your case information and updates</p>
        </div>
        <DemoModeBadge />
      </div>

      {/* 1. Case Status Overview */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Case Status</h2>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${phaseConfig.bgColor} ${phaseConfig.textColor}`}>
            {phaseConfig.label}
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Case</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{primaryCase.title}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Case Number</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">#{primaryCase.caseNumber}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Next Court Date</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{primaryCase.nextHearing || 'TBD'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Assigned Attorney</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">Jane Doe, Esq.</p>
          </div>
        </div>

        {/* Case Progress Timeline */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Case Progress</p>
          <div className="flex items-center gap-1">
            {(['preliminary', 'pretrial', 'trial', 'sentencing'] as CasePhase[]).map((phase, i) => {
              const isComplete = ['preliminary'].includes(phase);
              const isCurrent = phase === currentPhase;
              return (
                <div key={phase} className="flex-1 flex items-center gap-1">
                  <div className={`flex-1 h-2 rounded-full ${
                    isComplete ? 'bg-green-500' :
                    isCurrent ? 'bg-amber-400' :
                    'bg-gray-200'
                  }`} />
                  {i < 3 && <div className="w-1" />}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            {['Preliminary', 'Pretrial', 'Trial', 'Sentencing'].map((label) => (
              <span key={label} className="text-[10px] text-gray-400">{label}</span>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 2. Document Center */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
            <button
              onClick={() => navigate(`/app/cases/${primaryCase.id}/documents`)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View All
            </button>
          </div>
          <div className="space-y-2">
            {documents.slice(0, 4).map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/app/cases/${primaryCase.id}/documents`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${STATUS_COLORS.info}`}>
                    <FileText size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-500">{doc.filedDate}</p>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1">
                  <Download size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate(`/app/cases/${primaryCase.id}/documents`)}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            <FileText size={16} />
            Upload Document
          </button>
        </Card>

        {/* 3. Upcoming Events */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Events</h2>
          <div className="space-y-3">
            {[
              { type: 'court', label: 'Court Hearing', date: 'Feb 15, 2024', time: '9:00 AM', location: 'Dept. 24', icon: Calendar, color: STATUS_COLORS.danger },
              { type: 'meeting', label: 'Attorney Meeting', date: 'Feb 10, 2024', time: '2:00 PM', location: 'Video Call', icon: User, color: STATUS_COLORS.info },
              { type: 'action', label: 'Submit Character References', date: 'Feb 18, 2024', time: 'Before 5:00 PM', location: '', icon: CheckCircle, color: STATUS_COLORS.warning },
              { type: 'deadline', label: 'Document Review Deadline', date: 'Feb 22, 2024', time: 'EOD', location: '', icon: Clock, color: STATUS_COLORS.neutral },
            ].map((event, i) => {
              const Icon = event.icon;
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${event.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{event.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{event.date} at {event.time}</p>
                    {event.location && <p className="text-xs text-gray-400 mt-0.5">{event.location}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 5. Case Summary (AI-Sanitized) */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Case Summary</h2>
        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <StatCard
            icon={<Scale size={24} className="text-gray-600" />}
            value={primaryCase.chargesCount}
            label="Charges"
          />
          <StatCard
            icon={<Clock size={24} className="text-amber-600" />}
            value={phaseConfig.label}
            label="Current Stage"
          />
          <StatCard
            icon={<Calendar size={24} className="text-blue-600" />}
            value={primaryCase.nextHearing || 'TBD'}
            label="Next Date"
          />
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            Your case is currently in the <strong>{phaseConfig.label}</strong> phase.
            Your attorney is reviewing the evidence and preparing for the next court date.
            If you have any questions, please contact your assigned attorney.
          </p>
        </div>
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-blue-700">
            This summary is generated for informational purposes only.
            It does not constitute legal advice. Please consult your attorney for guidance.
          </p>
        </div>
      </Card>

      {/* 4. Messaging Panel Placeholder (Phase 2) */}
      <Card className="opacity-60">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Secure Messages</h2>
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full">Coming Soon</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Secure messaging with your legal team will be available in a future update.
        </p>
      </Card>
    </div>
  );
}
