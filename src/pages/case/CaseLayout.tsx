// ============================================
// Court Access — Case Layout with Tab Navigation
// ============================================

import { NavLink, Outlet, useParams } from 'react-router-dom';
import { CASE_TABS, ROLE_PERMISSIONS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { CaseStatusBadge } from '../../components/common/StatusBadge';
import { caseDataProvider } from '../../services/caseDataProvider';

export function CaseLayout() {
  const { caseId } = useParams<{ caseId: string }>();
  const { user } = useAuthStore();
  const cases = caseDataProvider.getCases();
  const currentCase = cases.find((c) => c.id === caseId) || caseDataProvider.getPrimaryCase();

  if (!user) return null;
  if (!currentCase) return <div className="max-w-7xl mx-auto p-8 text-center text-gray-500">No cases found.</div>;
  const permissions = ROLE_PERMISSIONS[user.role];

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
