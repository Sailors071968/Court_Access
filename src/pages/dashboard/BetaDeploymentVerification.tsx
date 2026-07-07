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
      case 'pending': return <Clock size={16} className="text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={24} className="text-gold-light" />
          <div>
            <h1 className="text-2xl font-bold text-white">Beta Deployment Verification</h1>
            <p className="text-sm text-slate-400">Pre-deployment checklist for beta.courtaccess.net</p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <RefreshCw size={14} /> Re-run All Checks
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{passed}</p>
          <p className="text-sm text-emerald-300 font-medium">Passed</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{failed}</p>
          <p className="text-sm text-red-300 font-medium">Failed</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-slate-300">{pending}</p>
          <p className="text-sm text-slate-200 font-medium">Pending</p>
        </div>
      </div>

      {/* Checks List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-400">Loading verification checks...</span>
        </div>
      ) : checks.length === 0 ? (
        <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
          <Shield size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-slate-400">No deployment checks available.</p>
          <p className="text-xs text-slate-400 mt-1">Run verification to check deployment readiness.</p>
        </div>
      ) : (
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="divide-y divide-white/10">
          {checks.map((check) => (
            <div key={check.id} className="px-4 py-3 flex items-center gap-4 hover:bg-white/5">
              {statusIcon(check.status)}
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{check.name}</p>
                <p className="text-xs text-slate-400">{check.description}</p>
                {check.details && (
                  <p className="text-xs text-slate-400 mt-0.5">{check.details}</p>
                )}
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                check.category === 'ui' ? 'bg-blue-500/15 text-blue-300' :
                check.category === 'pipeline' ? 'bg-violet-500/15 text-violet-300' :
                check.category === 'worker' ? 'bg-amber-500/15 text-amber-300' :
                'bg-emerald-500/15 text-emerald-300'
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
        failed === 0 ? 'bg-emerald-500/10 border-green-300' : 'bg-red-500/10 border-red-300'
      }`}>
        <p className={`text-lg font-bold ${failed === 0 ? 'text-emerald-300' : 'text-red-300'}`}>
          {failed === 0 ? 'ALL CHECKS PASSED — Ready for Beta Deployment' : `${failed} CHECK(S) FAILED — Review Required`}
        </p>
      </div>
    </div>
  );
}
