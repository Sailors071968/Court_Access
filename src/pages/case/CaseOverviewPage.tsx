// ============================================
// Court Access — Case Overview Tab
// Connected to real backend API
// ============================================

import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Scale, Calendar, Lightbulb, TrendingUp, Loader2 } from 'lucide-react';
import { Card, StatCard } from '../../components/common/Card';
import { AIStatusBadge } from '../../components/common/StatusBadge';
import { ROLE_PERMISSIONS } from '../../constants';
import { useCase, useDocuments } from '../../hooks/useApi';
import { useAuthStore } from '../../stores/authStore';

export function CaseOverviewPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: currentCase, isLoading: caseLoading } = useCase(caseId);
  const { data: documents, isLoading: docsLoading } = useDocuments(caseId);

  if (!user) return null;

  const permissions = ROLE_PERMISSIONS[user.role];
  const isLoading = caseLoading || docsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading...</span>
      </div>
    );
  }

  if (!currentCase) {
    return <p className="text-gray-500 text-center py-8">Case not found.</p>;
  }

  const docList = documents || [];

  const showIntelligence = user.role !== 'client';

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={<FileText size={28} className="text-blue-500" />} value={docList.length} label="Documents Filed" />
        <StatCard icon={<Scale size={28} className="text-amber-600" />} value={0} label="Charges" />
        <StatCard icon={<Calendar size={28} className="text-blue-500" />} value="TBD" label="Next Hearing" />
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
              <div><span className="text-gray-500">Case #:</span> <span className="font-medium text-gray-900 ml-2">{currentCase.caseNumber || 'N/A'}</span></div>
              <div><span className="text-gray-500">Status:</span> <span className="font-medium text-gray-900 ml-2 capitalize">{currentCase.status}</span></div>
              <div><span className="text-gray-500">Created:</span> <span className="font-medium text-gray-900 ml-2">{new Date(currentCase.createdAt).toLocaleDateString()}</span></div>
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
                {docList.slice(0, 3).map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium text-gray-900">{doc.fileName}</td>
                    <td className="py-3 px-2 text-gray-500">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                    <td className="py-3 px-2 text-gray-500">Document</td>
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
            <p className="text-sm text-gray-500">No recent activity.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
