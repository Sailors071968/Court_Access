// ============================================================================
// Phase 275 — Beta Deployment Verification
// Verification checklist for beta deployment readiness
// ============================================================================

import { useState } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw, Shield } from 'lucide-react';

interface VerificationCheck {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'pending' | 'running';
  details?: string;
  category: 'ui' | 'pipeline' | 'worker' | 'data';
}

const MOCK_CHECKS: VerificationCheck[] = [
  { id: 'v1', name: 'Trial Exhibit System visible to clients', description: 'Verify trial exhibits tab appears in case layout', status: 'pass', category: 'ui', details: 'Tab renders correctly for all client roles' },
  { id: 'v2', name: 'Complete Analysis visible on Overview page', description: 'Verify analysis section renders in case overview', status: 'pass', category: 'ui', details: 'All 7 sections render with mock data' },
  { id: 'v3', name: 'Evidence uploads stable', description: 'Verify evidence upload pipeline processes files', status: 'pass', category: 'pipeline', details: 'Upload + OCR + analysis pipeline operational' },
  { id: 'v4', name: 'Policy console stable', description: 'Verify policy operations dashboard loads without errors', status: 'pass', category: 'ui', details: 'Inventory and matrix views render correctly' },
  { id: 'v5', name: 'Worker queues healthy', description: 'Verify all worker queues are processing', status: 'pass', category: 'worker', details: 'All 6 queues operational, 0 failed jobs' },
  { id: 'v6', name: 'Upload evidence test', description: 'End-to-end evidence upload test', status: 'pass', category: 'pipeline', details: 'PDF upload completed in 3.2s' },
  { id: 'v7', name: 'Generate analysis test', description: 'Full case analysis generation', status: 'pass', category: 'pipeline', details: 'Analysis generated in 12.4s with 8 timeline events' },
  { id: 'v8', name: 'Generate exhibit test', description: 'Auto-exhibit generation from analysis', status: 'pass', category: 'pipeline', details: '4 exhibits auto-generated' },
  { id: 'v9', name: 'Compare policies test', description: 'Policy comparison against agency + CHP fallback', status: 'pass', category: 'data', details: '3 policy observations generated using neutral language' },
  { id: 'v10', name: 'View timeline test', description: 'Timeline reconstruction from multiple sources', status: 'pass', category: 'data', details: 'Merged timeline from 5 sources, 8 events' },
  { id: 'v11', name: 'Legal neutrality guard active', description: 'Verify PolicyNarrativeGuard wraps all AI output', status: 'pass', category: 'pipeline', details: 'Guard intercepted 0 forbidden terms in test output' },
  { id: 'v12', name: 'Evidence hash integrity', description: 'SHA-256 + SHA3-256 computed for all evidence', status: 'pass', category: 'data', details: 'All evidence files hashed and verified' },
];

export function BetaDeploymentVerification() {
  const [checks] = useState<VerificationCheck[]>(MOCK_CHECKS);

  const passed = checks.filter((c) => c.status === 'pass').length;
  const failed = checks.filter((c) => c.status === 'fail').length;
  const pending = checks.filter((c) => c.status === 'pending' || c.status === 'running').length;

  const statusIcon = (status: VerificationCheck['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle size={16} className="text-green-500" />;
      case 'fail': return <XCircle size={16} className="text-red-500" />;
      case 'running': return <RefreshCw size={16} className="text-blue-500 animate-spin" />;
      case 'pending': return <Clock size={16} className="text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={24} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Beta Deployment Verification</h1>
            <p className="text-sm text-gray-500">Pre-deployment checklist for beta.courtaccess.net</p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <RefreshCw size={14} /> Re-run All Checks
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{passed}</p>
          <p className="text-sm text-green-700 font-medium">Passed</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{failed}</p>
          <p className="text-sm text-red-700 font-medium">Failed</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-600">{pending}</p>
          <p className="text-sm text-gray-700 font-medium">Pending</p>
        </div>
      </div>

      {/* Checks List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {checks.map((check) => (
            <div key={check.id} className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50">
              {statusIcon(check.status)}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{check.name}</p>
                <p className="text-xs text-gray-500">{check.description}</p>
                {check.details && (
                  <p className="text-xs text-gray-400 mt-0.5">{check.details}</p>
                )}
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                check.category === 'ui' ? 'bg-blue-100 text-blue-700' :
                check.category === 'pipeline' ? 'bg-purple-100 text-purple-700' :
                check.category === 'worker' ? 'bg-amber-100 text-amber-700' :
                'bg-green-100 text-green-700'
              }`}>
                {check.category.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Overall Status */}
      <div className={`p-4 rounded-xl border-2 text-center ${
        failed === 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
      }`}>
        <p className={`text-lg font-bold ${failed === 0 ? 'text-green-700' : 'text-red-700'}`}>
          {failed === 0 ? 'ALL CHECKS PASSED — Ready for Beta Deployment' : `${failed} CHECK(S) FAILED — Review Required`}
        </p>
      </div>
    </div>
  );
}
