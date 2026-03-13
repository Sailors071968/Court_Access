// ============================================
// Court Access — Case Layout with Tab Navigation
// ============================================

import { useState, useEffect } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { CASE_TABS, ROLE_PERMISSIONS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { CaseStatusBadge } from '../../components/common/StatusBadge';
import { caseDataProvider } from '../../services/caseDataProvider';
import type { CaseEntity } from '../../models/CaseModel';

export function CaseLayout() {
  const { caseId } = useParams<{ caseId: string }>();
  const { user } = useAuthStore();
  const [currentCase, setCurrentCase] = useState<CaseEntity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    caseDataProvider.getCases().then((cases) => {
      const found = cases.find((c) => c.id === caseId);
      if (found) {
        setCurrentCase(found);
      } else {
        caseDataProvider.getPrimaryCase().then((pc) => setCurrentCase(pc));
      }
    }).finally(() => setLoading(false));
  }, [caseId]);

  if (!user) return null;
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8 text-center">
        <p className="text-gray-500">Loading case...</p>
      </div>
    );
  }
  if (!currentCase) {
    return (
      <div className="max-w-7xl mx-auto p-8 text-center">
        <p className="text-gray-500">Case not found.</p>
      </div>
    );
  }
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
