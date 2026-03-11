// ============================================
// Court Access — Case Overview Tab
// ============================================

import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Scale, Calendar, Lightbulb, TrendingUp } from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { AIStatusBadge } from '../../components/common/StatusBadge';
import { ROLE_PERMISSIONS } from '../../constants';
import { caseDataProvider } from '../../services/caseDataProvider';
import { useAuthStore } from '../../stores/authStore';
import { CaseAnalysisSection } from '../../components/case/CaseAnalysisSection';
import { LitigationIntelligencePanel } from '../../components/case/LitigationIntelligencePanel';

export function CaseOverviewPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  if (!user) return null;

  const permissions = ROLE_PERMISSIONS[user.role];
  const cases = caseDataProvider.getCases();
  const currentCase = cases.find((c) => c.id === caseId) || caseDataProvider.getPrimaryCase();
  const documents = caseDataProvider.getDocuments(currentCase.id);
  const activity = caseDataProvider.getActivity(currentCase.id);
  const documentTypeLabels = caseDataProvider.getDocumentTypeLabels();

  const showIntelligence = user.role !== 'defendant';

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={<FileText size={28} className="text-blue-500" />} value={currentCase.documentsCount} label="Documents Filed" trend="+2 this week" />
        <StatCard icon={<Scale size={28} className="text-amber-600" />} value={currentCase.chargesCount} label="Charges" />
        <StatCard icon={<Calendar size={28} className="text-blue-500" />} value={currentCase.nextHearing || 'TBD'} label={currentCase.nextHearingLocation || 'Unresolved'} />
        {showIntelligence && (
          <>
            <StatCard icon={<Lightbulb size={28} className="text-amber-500" />} value="8 New" label="Intelligence Signals" highlight />
            <StatCard icon={<Lightbulb size={28} className="text-amber-500" />} value="3" label="Prosecution Vulnerabilities" highlight />
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
              <div><span className="text-gray-500">Judge:</span> <span className="font-medium text-gray-900 ml-2">{currentCase.judge}</span></div>
              <div><span className="text-gray-500">Jurisdiction:</span> <span className="font-medium text-gray-900 ml-2">{currentCase.jurisdiction}</span></div>
              <div><span className="text-gray-500">Court:</span> <span className="font-medium text-gray-900 ml-2">{currentCase.court}</span></div>
              <div><span className="text-gray-500">Department:</span> <span className="font-medium text-gray-900 ml-2">{currentCase.department}</span></div>
              <div><span className="text-gray-500">Status:</span> <span className="font-medium text-gray-900 ml-2 capitalize">{currentCase.status}</span></div>
            </div>
          </Card>

          {/* Recent Documents */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Documents</h2>
              <button onClick={() => navigate(`/cases/${currentCase.id}/documents`)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">View all</button>
            </div>
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
                  <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium text-gray-900">{doc.name}</td>
                    <td className="py-3 px-2 text-gray-500">{doc.filedDate}</td>
                    <td className="py-3 px-2 text-gray-500">{documentTypeLabels[doc.type]}</td>
                    <td className="py-3 px-2"><AIStatusBadge status={doc.analysisStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Side Column */}
        <div className="space-y-6">
          {showIntelligence ? (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Case Intelligence Overview</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Demo data only. Intelligence modeling will be implemented in Phase 1.
              </p>
              {permissions.canViewCharges && (
                <button
                  onClick={() => navigate(`/cases/${currentCase.id}/charges`)}
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
                This overview provides your case status, recent documents, and upcoming activity.
              </p>
            </Card>
          )}

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h2>
            <div className="space-y-3">
              {activity.slice(0, 4).map((item) => (
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
                    <p className="text-xs text-gray-500">{item.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{item.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Phase 257: Complete Case Analysis Section */}
      {showIntelligence && (
        <CaseAnalysisSection />
      )}

      {/* Phase 282: Litigation Intelligence Panel */}
      {showIntelligence && (
        <LitigationIntelligencePanel />
      )}
    </div>
  );
}
