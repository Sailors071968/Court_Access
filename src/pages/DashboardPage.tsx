// ============================================
// Court Access — Dashboard Page
// Connected to real backend API
// ============================================

import { useNavigate } from 'react-router-dom';
import { FileText, Scale, Calendar, Lightbulb, Search as SearchIcon, TrendingUp, Loader2 } from 'lucide-react';
import { Card, StatCard } from '../components/common/Card';
import { DemoModeBadge } from '../components/common/DemoModeBadge';
import { AIStatusBadge } from '../components/common/StatusBadge';
import { useCases, useDocuments } from '../hooks/useApi';
import { useAuthStore } from '../stores/authStore';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: cases, isLoading: casesLoading } = useCases();
  const primaryCase = (cases || [])[0] || null;
  const { data: documents, isLoading: docsLoading } = useDocuments(primaryCase?.id);
  const docList = documents || [];
  const isLoading = casesLoading || docsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Case Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {primaryCase ? `${primaryCase.title} - Case #${primaryCase.caseNumber || 'N/A'}` : 'No Cases Yet'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <DemoModeBadge />
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Active
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<FileText size={28} className="text-blue-500" />}
          value={docList.length}
          label="Documents Filed"
        />
        <StatCard
          icon={<Scale size={28} className="text-amber-600" />}
          value={0}
          label="Charges Pending"
        />
        <StatCard
          icon={<Calendar size={28} className="text-blue-500" />}
          value="Next Hearing:"
          label="TBD"
        />
        <StatCard
          icon={<Lightbulb size={28} className="text-amber-500" />}
          value="8 New"
          label="Intelligence Signals"
          highlight
        />
        <StatCard
          icon={<SearchIcon size={28} className="text-amber-500" />}
          value="8 New"
          label="Intelligence Signals"
          highlight
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Documents */}
        <div className="lg:col-span-2">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Documents</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">Document Name</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">Filed Date</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">Type</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">AI Analysis Status</th>
                  </tr>
                </thead>
                <tbody>
                  {docList.slice(0, 3).map((doc) => (
                    <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => primaryCase && navigate(`/cases/${primaryCase.id}/documents`)}>
                      <td className="py-3 px-2 font-medium text-gray-900">{doc.fileName}</td>
                      <td className="py-3 px-2 text-gray-500">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                      <td className="py-3 px-2 text-gray-500">Document</td>
                      <td className="py-3 px-2">
                        <AIStatusBadge status={doc.analysisStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Quick Insights */}
        <div>
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Insights</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              The prosecution's motion to exclude alibi witnesses may significantly impact your defense strategy.
              Review with your attorney.
            </p>
            <button
              onClick={() => primaryCase && navigate(`/cases/${primaryCase.id}/charges`)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
            >
              <TrendingUp size={16} />
              View Full Analysis
            </button>
          </Card>

          {/* Activity Feed */}
          <Card className="mt-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <p className="text-sm text-gray-500">No recent activity.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
