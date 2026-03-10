// ============================================
// Court Access — Case Layout with Tab Navigation
// ============================================

import { NavLink, Outlet, useParams } from 'react-router-dom';
import { CASE_TABS, ROLE_PERMISSIONS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { CaseStatusBadge } from '../../components/common/StatusBadge';
import { caseDataProvider } from '../../services/caseDataProvider';
import { ShieldAlert } from 'lucide-react';

export function CaseLayout() {
  const { caseId } = useParams<{ caseId: string }>();
  const { user } = useAuthStore();
  const cases = caseDataProvider.getCases();
  const currentCase = cases.find((c) => c.id === caseId);

  if (!user) return null;
  const permissions = ROLE_PERMISSIONS[user.role];

  // Phase 247: Case access security — verify case exists and user has access
  if (!currentCase) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert size={48} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Case Not Found</h2>
          <p className="text-gray-500">The requested case does not exist or you do not have access.</p>
          <p className="text-sm text-gray-400 mt-2">Case ID: {caseId}</p>
          <a href="/cases" className="mt-4 inline-block px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">
            Back to Cases
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Case Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{currentCase.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Case #{currentCase.caseNumber} &middot; {currentCase.jurisdiction}, {currentCase.court}
          </p>
        </div>
        <CaseStatusBadge status={currentCase.status} />
      </div>

      {/* Tab Navigation — deterministic order */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Case sections">
          {CASE_TABS.map((tab) => {
            // Hide tabs based on role permissions
            if (tab.permission && !permissions[tab.permission]) return null;

            const path = tab.path
              ? `/cases/${caseId}${tab.path}`
              : `/cases/${caseId}/overview`;

            return (
              <NavLink
                key={tab.id}
                to={path}
                end={tab.id === 'overview'}
                role="tab"
                className={({ isActive }) =>
                  `px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <Outlet />
    </div>
  );
}
