// ============================================
// Court Access — Case Overview Tab
// Wired to real backend API (Phase 4 — Product Completion)
// ============================================

import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { FileText, Scale, Calendar, Lightbulb, TrendingUp, Loader2 } from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { DefenseOpportunityDashboard } from '../../components/case/DefenseOpportunityDashboard';
import { DoctrineCompliancePanel } from '../../components/case/DoctrineCompliancePanel';
import { ROLE_PERMISSIONS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
// CaseAnalysisSection and LitigationIntelligencePanel removed:
// Backend routes (/api/cases/:id/analysis, /api/cases/:id/recommendations)
// are not implemented in the repo — data was served by EC2-only files.
import { fetchCase, fetchCaseEvidence, type ApiCase, type ApiEvidence } from '../../services/caseApi';

export function CaseOverviewPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [currentCase, setCurrentCase] = useState<ApiCase | null>(null);
  const [evidence, setEvidence] = useState<ApiEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [caseData, evidenceData] = await Promise.all([
          fetchCase(caseId),
          fetchCaseEvidence(caseId).catch(() => []),
        ]);
        if (!cancelled) {
          setCurrentCase(caseData);
          setEvidence(evidenceData ?? []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load case');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  if (!user) return null;

  const permissions = ROLE_PERMISSIONS[user.role];
  const showIntelligence = user.role !== 'defendant';

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">Loading case...</p>
      </div>
    );
  }

  if (error || !currentCase) {
    return <div className="p-8 text-center text-gray-500">{error || 'No cases found. Create a case to get started.'}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Defense Opportunity Dashboard — first thing visible on every case (Program 134) */}
      {showIntelligence && caseId && (
        <DefenseOpportunityDashboard caseId={caseId} compact />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={<FileText size={28} className="text-blue-500" />} value={evidence.length} label="Evidence Items" />
        <StatCard icon={<Scale size={28} className="text-amber-600" />} value={currentCase.caseType} label="Case Type" />
        <StatCard icon={<Calendar size={28} className="text-blue-500" />} value={currentCase.nextHearing || 'TBD'} label={currentCase.nextHearingNote || 'Next Hearing'} />
        {showIntelligence && (
          <>
            <StatCard icon={<Lightbulb size={28} className="text-amber-500" />} value={currentCase.phase} label="Phase" />
            <StatCard icon={<Lightbulb size={28} className="text-amber-500" />} value={currentCase.status} label="Status" />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Case Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Case Information</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Case #:</span> <span className="font-medium text-gray-900 ml-2">{currentCase.caseNumber}</span></div>
              <div><span className="text-gray-500">Judge:</span> <span className="font-medium text-gray-900 ml-2">{currentCase.judge || 'TBD'}</span></div>
              <div><span className="text-gray-500">Jurisdiction:</span> <span className="font-medium text-gray-900 ml-2">{currentCase.jurisdiction}</span></div>
              <div><span className="text-gray-500">Court:</span> <span className="font-medium text-gray-900 ml-2">{currentCase.court || 'TBD'}</span></div>
              <div><span className="text-gray-500">Department:</span> <span className="font-medium text-gray-900 ml-2">{currentCase.department || 'TBD'}</span></div>
              <div><span className="text-gray-500">Status:</span> <span className="font-medium text-gray-900 ml-2 capitalize">{currentCase.status}</span></div>
            </div>
          </Card>

          {/* Recent Evidence */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Evidence</h2>
              <button onClick={() => navigate(`/cases/${currentCase.caseId}/evidence`)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">View all</button>
            </div>
            {evidence.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No evidence uploaded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">File Name</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">Uploaded</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">Type</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence.slice(0, 5).map((ev) => (
                    <tr key={ev.evidenceId} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-2 font-medium text-gray-900">{ev.fileName}</td>
                      <td className="py-3 px-2 text-gray-500">{new Date(ev.uploadedAt).toLocaleDateString()}</td>
                      <td className="py-3 px-2 text-gray-500 capitalize">{ev.evidenceType.replace(/_/g, ' ')}</td>
                      <td className="py-3 px-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ev.processingStatus === 'analyzed' ? 'bg-green-100 text-green-700' :
                          ev.processingStatus === 'processing' ? 'bg-blue-100 text-blue-700' :
                          ev.processingStatus === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {ev.processingStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Side Column */}
        <div className="space-y-6">
          {showIntelligence ? (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Case Intelligence Overview</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Upload evidence and run analysis to generate intelligence signals.
              </p>
              {permissions.canViewCharges && (
                <button
                  onClick={() => navigate(`/cases/${currentCase.caseId}/charges`)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
                >
                  <TrendingUp size={16} />
                  View Charges
                </button>
              )}
            </Card>
          ) : (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Case Updates</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                This overview provides your case status, recent evidence, and upcoming activity.
              </p>
            </Card>
          )}

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Case Timeline</h2>
            <div className="text-sm text-gray-500">
              <p>Created: {new Date(currentCase.createdAt).toLocaleDateString()}</p>
              <p className="mt-1">Updated: {new Date(currentCase.updatedAt).toLocaleDateString()}</p>
              {currentCase.nextHearing && (
                <p className="mt-1">Next Hearing: {currentCase.nextHearing}</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Phase 257: Case Analysis + Phase 282: Litigation Intelligence removed.
         Backend analysis routes are not wired in the repo yet.
         Re-enable when /api/cases/:id/analysis and /api/cases/:id/recommendations are implemented. */}

      {/* Police Training Doctrine Compliance */}
      {showIntelligence && (
        <DoctrineCompliancePanel />
      )}
    </div>
  );
}
