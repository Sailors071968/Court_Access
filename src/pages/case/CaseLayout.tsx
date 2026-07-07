// ============================================
// Court Access — Case Layout with Tab Navigation
// ============================================

import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { CASE_TABS, ROLE_PERMISSIONS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { CaseStatusBadge } from '../../components/common/StatusBadge';
import { fetchCase, type ApiCase } from '../../services/caseApi';

export function CaseLayout() {
  const { caseId } = useParams<{ caseId: string }>();
  const { user } = useAuthStore();
  const [currentCase, setCurrentCase] = useState<ApiCase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const c = await fetchCase(caseId).catch(() => null);
        if (!cancelled) setCurrentCase(c);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  if (!user) return null;
  if (loading) return <div className="max-w-7xl mx-auto text-center py-12"><Loader2 size={24} className="animate-spin text-slate-500 mx-auto mb-2" /><p className="text-slate-400">Loading case...</p></div>;
  if (!currentCase) return <div className="max-w-7xl mx-auto p-8 text-center text-slate-400">No cases found.</div>;
  const permissions = ROLE_PERMISSIONS[user.role];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Case Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{currentCase.title}</h1>
          <p className="text-sm text-slate-400 mt-1">
            Case #{currentCase.caseNumber} &middot; {currentCase.jurisdiction}{currentCase.court ? `, ${currentCase.court}` : ''}
          </p>
        </div>
        <CaseStatusBadge status={currentCase.status} />
      </div>

      {/* Tab Navigation — deterministic order */}
      <div className="border-b border-white/10">
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
                      ? 'border-blue-600 text-gold-light'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-white/10'
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
