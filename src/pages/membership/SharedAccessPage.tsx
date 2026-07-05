// ============================================================================
// Program 1 — My Shared Access Dashboard
// ============================================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, FolderOpen, FileText, Shield, Loader2 } from 'lucide-react';
import { fetchSharedAccess, type SharedWorkspace } from '../../services/membershipApi';

export function SharedAccessPage() {
  const [workspaces, setWorkspaces] = useState<SharedWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSharedAccess()
      .then((data) => setWorkspaces(data.workspaces))
      .catch(() => setError('Unable to load shared access'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">{error}</div>;
  }

  if (workspaces.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <Users className="mx-auto text-slate-300 mb-4" size={48} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">My Shared Access</h1>
        <p className="text-gray-500 mb-6">
          When someone invites you to their organization, shared cases and documents appear here.
        </p>
        <Link to="/dashboard" className="text-amber-600 hover:text-amber-700 font-medium">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Shared Access</h1>
        <p className="text-gray-500 mt-1">Workspaces and information shared with you by account owners.</p>
      </div>

      {workspaces.map((ws) => (
        <div key={ws.organizationId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">{ws.sharedBy}</h2>
              <p className="text-sm text-gray-500 capitalize">Your role: {ws.role}</p>
            </div>
            <Shield className="text-amber-500" size={20} />
          </div>

          <div className="p-6 grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FolderOpen size={16} /> Cases
              </h3>
              {ws.cases.length === 0 ? (
                <p className="text-sm text-gray-400">No cases shared</p>
              ) : (
                <ul className="space-y-2">
                  {ws.cases.map((c) => (
                    <li key={c.caseId}>
                      <Link
                        to={`/cases/${c.caseId}/overview`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {c.title || c.caseNumber}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FileText size={16} /> Shared Documents
              </h3>
              {ws.disclosures.length === 0 ? (
                <p className="text-sm text-gray-400">No published documents</p>
              ) : (
                <ul className="space-y-2">
                  {ws.disclosures.filter((d) => d.status === 'published').map((d) => (
                    <li key={d.packageId} className="text-sm text-gray-600">
                      {d.recipientType} version — Case {d.caseId.slice(0, 8)}…
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              {ws.permissions.length} permission grant(s) — you only see authorized information.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
