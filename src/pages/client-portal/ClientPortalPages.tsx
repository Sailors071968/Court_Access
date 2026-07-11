// ============================================================================
// Sprint 1 — Client Portal pages (shell integrating existing capabilities)
// ============================================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Calendar, MessageSquare, FileText, Bell } from 'lucide-react';
import { DefendantWorkspace } from './DefendantWorkspace';
import { useAuthStore } from '../../stores/authStore';
import { fetchCases, type ApiCase } from '../../services/caseApi';
import { fetchMembershipAccount } from '../../services/membershipApi';

export function ClientPortalDashboardPage() {
  return <DefendantWorkspace />;
}

export function ClientPortalCourtDatesPage() {
  const [cases, setCases] = useState<ApiCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCases()
      .then((cases) => setCases(cases ?? []))
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <Calendar size={22} /> Court Dates
      </h2>
      {cases.length === 0 ? (
        <p className="text-slate-400">No cases with scheduled hearings yet.</p>
      ) : (
        cases.map((c) => (
          <div key={c.caseId} className="bg-white/5 rounded-xl border border-white/10 p-5">
            <h3 className="font-semibold text-white">{c.title}</h3>
            <p className="text-sm text-slate-400">{c.caseNumber}</p>
            {c.nextHearing && (
              <p className="mt-2 text-amber-300 font-medium">
                Next hearing: {new Date(c.nextHearing).toLocaleDateString()}
              </p>
            )}
            <Link
              to={`/cases/${c.caseId}/overview`}
              className="inline-block mt-3 text-sm text-amber-600 hover:text-amber-300"
            >
              View case details
            </Link>
          </div>
        ))
      )}
    </div>
  );
}

export function ClientPortalMessagesPage() {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <MessageSquare size={22} /> Secure Messages
      </h2>
      <p className="text-slate-400">
        Open a case to view secure messages with your legal team.
      </p>
      <Link to="/cases" className="text-amber-600 hover:text-amber-300 font-medium">
        Go to My Cases
      </Link>
      {user?.email && (
        <p className="text-sm text-slate-400">Signed in as {user.email}</p>
      )}
    </div>
  );
}

export function ClientPortalDocumentsPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <FileText size={22} /> Shared Documents
      </h2>
      <p className="text-slate-400">
        Documents shared with you through disclosure packages appear in each case.
      </p>
      <Link to="/shared-access" className="text-amber-600 hover:text-amber-300 font-medium">
        View Shared Access
      </Link>
    </div>
  );
}

export function ClientPortalEvidencePage() {
  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-xl font-bold text-white">Evidence</h2>
      <p className="text-slate-400">Select a case to view or upload evidence.</p>
      <Link to="/cases" className="text-amber-600 hover:text-amber-300 font-medium">
        Browse Cases
      </Link>
    </div>
  );
}

export function ClientPortalTimelinePage() {
  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-xl font-bold text-white">Case Timeline</h2>
      <p className="text-slate-400">Timeline events are available within each case.</p>
      <Link to="/cases" className="text-amber-600 hover:text-amber-300 font-medium">
        Open a Case
      </Link>
    </div>
  );
}

export function ClientPortalTasksPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-xl font-bold text-white">Your Tasks</h2>
      <p className="text-slate-400">
        Investigative suggestions and tasks from your dashboard are tracked per case.
      </p>
      <Link to="/client-portal/dashboard" className="text-amber-600 hover:text-amber-300 font-medium">
        View Dashboard Tasks
      </Link>
    </div>
  );
}

export function ClientPortalBillingPage() {
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    fetchMembershipAccount()
      .then((a) => setStatus(a.subscription?.status ?? 'none'))
      .catch(() => setStatus('unknown'));
  }, []);

  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-xl font-bold text-white">Billing</h2>
      <div className="bg-white/5 rounded-xl border border-white/10 p-5">
        <p className="text-sm text-slate-400">Subscription status</p>
        <p className="text-lg font-semibold text-white capitalize">{status || 'Loading...'}</p>
      </div>
      <Link to="/settings" className="text-amber-600 hover:text-amber-300 font-medium">
        Manage Account & Billing
      </Link>
    </div>
  );
}

export function ClientPortalNotificationsPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <Bell size={22} /> Notifications
      </h2>
      <Link to="/notifications" className="text-amber-600 hover:text-amber-300 font-medium">
        Open Notifications Center
      </Link>
    </div>
  );
}

export function ClientPortalUploadsPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-xl font-bold text-white">Upload Evidence</h2>
      <p className="text-slate-400">Upload evidence files from within a case evidence tab.</p>
      <Link to="/cases" className="text-amber-600 hover:text-amber-300 font-medium">
        Select Case to Upload
      </Link>
    </div>
  );
}
