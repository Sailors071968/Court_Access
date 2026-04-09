// ============================================
// Court Access — Defendant Dashboard
// Transparency + reassurance. Simplified view.
// No internal analysis mechanics exposed.
// ============================================

import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { FileText, Calendar, Download, Clock, CheckCircle, User, Scale, Archive, Loader2 } from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { STATUS_COLORS } from '../../constants/designTokens';
import { useAuthStore } from '../../stores/authStore';
import { fetchCases, fetchCaseEvidence, type ApiCase, type ApiEvidence } from '../../services/caseApi';

// Case phase for defendant view
type CasePhase = 'preliminary' | 'pretrial' | 'trial' | 'sentencing' | 'closed';

const CASE_PHASE_CONFIG: Record<CasePhase, { label: string; bgColor: string; textColor: string }> = {
  preliminary: { label: 'Preliminary', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  pretrial: { label: 'Pretrial', bgColor: 'bg-amber-100', textColor: 'text-amber-800' },
  trial: { label: 'Trial', bgColor: 'bg-red-100', textColor: 'text-red-800' },
  sentencing: { label: 'Sentencing', bgColor: 'bg-purple-100', textColor: 'text-purple-800' },
  closed: { label: 'Closed', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },
};

export function DefendantDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [primaryCase, setPrimaryCase] = useState<ApiCase | null>(null);
  const [documents, setDocuments] = useState<ApiEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const currentPhase: CasePhase = 'pretrial';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const allCases = await fetchCases().catch(() => []);
        if (cancelled) return;
        const first = allCases?.[0] ?? null;
        setPrimaryCase(first);
        if (first) {
          const docs = await fetchCaseEvidence(first.caseId).catch(() => []);
          if (!cancelled) setDocuments(docs ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const phaseConfig = CASE_PHASE_CONFIG[currentPhase];

  // Phase 234 — Client Disregard File feature
  const [disregardedDocs, setDisregardedDocs] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('courtaccess_defendant_disregarded');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  const handleDisregard = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = new Set(disregardedDocs);
    if (updated.has(docId)) {
      updated.delete(docId);
    } else {
      updated.add(docId);
    }
    setDisregardedDocs(updated);
    localStorage.setItem('courtaccess_defendant_disregarded', JSON.stringify([...updated]));

    // Also log to evidence audit trail (shared with admin Evidence Management)
    const auditKey = 'courtaccess_evidence_audit_log';
    const log = JSON.parse(localStorage.getItem(auditKey) || '[]');
    log.push({
      actionId: crypto.randomUUID(),
      adminUser: user?.name || 'Defendant',
      fileId: docId,
      fileName: documents.find((d) => d.evidenceId === docId)?.fileName || 'Unknown',
      actionType: updated.has(docId) ? 'disregard' : 'undo_disregard',
      timestamp: new Date().toISOString(),
      notes: `Defendant ${updated.has(docId) ? 'marked' : 'unmarked'} file as disregard`,
    });
    localStorage.setItem(auditKey, JSON.stringify(log));
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto text-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  if (!primaryCase) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
          <p className="text-sm text-gray-500 mt-1">No cases found. Your attorney will add your case shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Your case information and updates</p>
        </div>
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
              onClick={() => navigate(`/cases/${primaryCase.caseId}/evidence`)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View All
            </button>
          </div>
          <div className="space-y-2">
            {documents.slice(0, 4).map((doc) => {
              const isDisregarded = disregardedDocs.has(doc.evidenceId);
              return (
                <div
                  key={doc.evidenceId}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isDisregarded
                      ? 'border-gray-200 bg-gray-50 opacity-60'
                      : 'border-gray-100 hover:bg-gray-50 cursor-pointer'
                  }`}
                  onClick={() => !isDisregarded && navigate(`/cases/${primaryCase.caseId}/evidence`)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${STATUS_COLORS.info}`}>
                      <FileText size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isDisregarded ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{doc.fileName}</p>
                      <p className="text-xs text-gray-500">{new Date(doc.uploadedAt).toLocaleDateString()}</p>
                      {isDisregarded && (
                        <span className="text-[10px] text-gray-400 font-medium">DISREGARDED — will not be analyzed</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => handleDisregard(doc.evidenceId, e)}
                      title={isDisregarded ? 'Undo disregard' : 'Mark as Disregard'}
                      className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isDisregarded
                          ? 'text-emerald-600 hover:bg-emerald-50'
                          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                      }`}
                    >
                      <Archive size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); }}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => navigate(`/cases/${primaryCase.caseId}/evidence`)}
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
            value={primaryCase.caseType || '—'}
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
