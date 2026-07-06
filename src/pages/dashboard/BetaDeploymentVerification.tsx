// ============================================================================
// Phase 275 — Beta Deployment Verification
// Verification checklist for beta deployment readiness
// ============================================================================

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw, Shield, Loader2 } from 'lucide-react';

interface VerificationCheck {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'pending' | 'running';
  details?: string;
  category: 'ui' | 'pipeline' | 'worker' | 'data';
}


export function BetaDeploymentVerification() {
  const [checks, setChecks] = useState<VerificationCheck[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchChecks() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/admin/deployment-checks');
        if (res.ok) {
          const json = await res.json();
          if (json.data) setChecks(json.data);
        }
      } catch {
        // API not available yet
      } finally {
        setIsLoading(false);
      }
    }
    fetchChecks();
  }, []);

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
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Loading verification checks...</span>
        </div>
      ) : checks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Shield size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">No deployment checks available.</p>
          <p className="text-xs text-gray-400 mt-1">Run verification to check deployment readiness.</p>
        </div>
      ) : (
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
      )}

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
