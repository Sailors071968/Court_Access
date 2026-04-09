// ============================================
// Court Access — Dashboard Page
// ============================================

import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { FileText, Scale, Calendar, Lightbulb, TrendingUp, Loader2, Briefcase } from 'lucide-react';
import { Card, StatCard } from '../components/common/Card';
import { useAuthStore } from '../stores/authStore';
import { fetchCases, fetchCaseEvidence, type ApiCase, type ApiEvidence } from '../services/caseApi';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [cases, setCases] = useState<ApiCase[]>([]);
  const [primaryCase, setPrimaryCase] = useState<ApiCase | null>(null);
  const [evidence, setEvidence] = useState<ApiEvidence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const allCases = await fetchCases().catch(() => []);
        if (cancelled) return;
        setCases(allCases ?? []);
        const first = allCases?.[0] ?? null;
        setPrimaryCase(first);
        if (first) {
          const docs = await fetchCaseEvidence(first.caseId).catch(() => []);
          if (!cancelled) setEvidence(docs ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto text-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  // No cases available — show welcome state
  if (!primaryCase) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name}</p>
        </div>
        <Card>
          <div className="text-center py-12">
            <FileText className="mx-auto mb-4 text-gray-300" size={48} />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Cases Yet</h3>
            <p className="text-sm text-gray-500 mb-4">Create your first case to get started with evidence management and AI-powered analysis.</p>
            <button
              onClick={() => navigate('/cases')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              Go to Cases
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Case Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {primaryCase.title} - Case #{primaryCase.caseNumber}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name}</p>
        </div>
        <div className="flex items-center gap-2">
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
          value={evidence.length}
          label="Evidence Filed"
        />
        <StatCard
          icon={<Scale size={28} className="text-amber-600" />}
          value={primaryCase.caseType || '—'}
          label="Case Type"
        />
        <StatCard
          icon={<Calendar size={28} className="text-blue-500" />}
          value="Next Hearing:"
          label={primaryCase.nextHearing || 'TBD'}
        />
        <StatCard
          icon={<Briefcase size={28} className="text-amber-500" />}
          value={cases.length}
          label="Total Cases"
        />
        <StatCard
          icon={<Lightbulb size={28} className="text-amber-500" />}
          value="Active"
          label="AI Analysis"
          highlight
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Documents */}
        <div className="lg:col-span-2">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Evidence</h2>
            <div className="overflow-x-auto">
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
                  {evidence.slice(0, 3).map((doc) => (
                    <tr key={doc.evidenceId} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/cases/${primaryCase.caseId}/evidence`)}>
                      <td className="py-3 px-2 font-medium text-gray-900">{doc.fileName}</td>
                      <td className="py-3 px-2 text-gray-500">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                      <td className="py-3 px-2 text-gray-500">{doc.evidenceType}</td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          doc.processingStatus === 'completed' ? 'bg-green-100 text-green-700' :
                          doc.processingStatus === 'processing' ? 'bg-blue-100 text-blue-700' :
                          doc.processingStatus === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {doc.processingStatus}
                        </span>
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
              Upload evidence and process cases to see AI-powered analysis, contradiction detection, and timeline reconstruction.
            </p>
            <button
              onClick={() => navigate(`/cases/${primaryCase.caseId}/contradictions`)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
            >
              <TrendingUp size={16} />
              View Contradiction Analysis
            </button>
          </Card>

          {/* Cases List */}
          <Card className="mt-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Cases</h2>
            <div className="space-y-3">
              {cases.slice(0, 3).map((c) => (
                <div key={c.caseId} className="flex gap-3 pb-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 rounded-lg p-2" onClick={() => navigate(`/cases/${c.caseId}/overview`)}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100 text-blue-600">
                    <Briefcase size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.title || c.caseNumber}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.status} — {new Date(c.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
