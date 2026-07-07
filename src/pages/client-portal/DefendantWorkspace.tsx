// ============================================================================
// CourtAccess — Defendant Workspace (Program 22)
// Dramatically simpler than the attorney workspace. Reassuring, friendly,
// professional. Always answers: what happened, what's next, what to do today.
// Reuses the master component library — no duplicated code.
// ============================================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ProgressBar } from '../../components/ui/progress';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/icons/registry';
import { useAuthStore } from '../../stores/authStore';
import { fetchCases, type ApiCase } from '../../services/caseApi';

const CASE_PHASES = ['Intake', 'Discovery', 'Review', 'Pre-Trial', 'Resolution'];

function phaseIndex(phase?: string): number {
  if (!phase) return 1;
  const p = phase.toLowerCase();
  if (p.includes('intake')) return 0;
  if (p.includes('discovery')) return 1;
  if (p.includes('review')) return 2;
  if (p.includes('trial')) return 3;
  if (p.includes('resol') || p.includes('closed')) return 4;
  return 1;
}

export function DefendantWorkspace() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [cases, setCases] = useState<ApiCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCases()
      .then((c) => !cancelled && setCases(c ?? []))
      .catch(() => !cancelled && setCases([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spinner label="Loading your case…" />;

  const primaryCase = cases[0] ?? null;
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  if (!primaryCase) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <EmptyState
            icon={<Icon name="upload" size={24} />}
            title={`Welcome, ${firstName}`}
            description="Your attorney will connect your case here. When they do, you'll see your progress, upcoming court dates, and anything you need to do."
            action={<Button variant="primary" onClick={() => navigate('/client-portal/uploads')}>Upload a Document</Button>}
          />
        </Card>
      </div>
    );
  }

  const currentPhase = phaseIndex(primaryCase.phase);
  const progressPct = Math.round(((currentPhase + 1) / CASE_PHASES.length) * 100);

  const primaryActions = [
    { label: 'Upload Evidence', icon: 'upload' as const, to: '/client-portal/uploads' },
    { label: 'Send Message', icon: 'messages' as const, to: '/client-portal/messages' },
    { label: 'Review Timeline', icon: 'timeline' as const, to: '/client-portal/timeline' },
    { label: 'Complete Tasks', icon: 'tasks' as const, to: '/client-portal/tasks' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Warm, reassuring header */}
      <div className="ca-panel p-6">
        <p className="text-sm text-gold-light font-medium">Welcome back, {firstName}</p>
        <h1 className="text-2xl font-bold text-white mt-1">Here's where your case stands</h1>
        <p className="text-sm text-slate-400 mt-2">
          {primaryCase.title || primaryCase.caseNumber} · {primaryCase.jurisdiction}
        </p>

        {/* Visual progress */}
        <div className="mt-5">
          <ProgressBar value={progressPct} tone="gold" />
          <div className="flex justify-between mt-3">
            {CASE_PHASES.map((phase, i) => (
              <div key={phase} className="flex flex-col items-center gap-1.5 flex-1">
                {i <= currentPhase ? (
                  <CheckCircle2 size={18} className="text-gold-light" />
                ) : (
                  <Circle size={18} className="text-slate-300" />
                )}
                <span className={`text-[11px] text-center ${i === currentPhase ? 'text-white font-medium' : 'text-slate-400'}`}>
                  {phase}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Primary actions — big, obvious, never overwhelming */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {primaryActions.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.to)}
            className="ca-panel ca-panel-hover flex flex-col items-center gap-3 py-6 text-slate-200 hover:text-white"
          >
            <span className="w-12 h-12 rounded-2xl ca-icon-gold text-gold-light flex items-center justify-center">
              <Icon name={action.icon} size={22} />
            </span>
            <span className="text-sm font-medium">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Three reassuring answers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* What happened */}
        <Card>
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="timeline" size={16} variant="selected" /> What's happened
          </h2>
          <EmptyState
            icon={<Icon name="timeline" size={20} />}
            title="Your case activity will appear here"
            description="As your attorney works your case, updates show up in this space."
          />
        </Card>

        {/* What's next */}
        <Card>
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="calendar" size={16} variant="selected" /> What happens next
          </h2>
          <div className="space-y-3">
            {primaryCase.nextHearing ? (
              <div className="p-3 rounded-lg bg-white/[0.03]">
                <p className="text-sm font-medium text-white">{primaryCase.nextHearingNote ?? 'Upcoming Court Date'}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(primaryCase.nextHearing).toLocaleString()}</p>
              </div>
            ) : (
              <EmptyState icon={<Icon name="calendar" size={20} />} title="No court dates scheduled" description="Your next court date will appear here when set." />
            )}
            <button
              onClick={() => navigate('/client-portal/court-dates')}
              className="text-sm text-gold-light hover:text-gold-bright flex items-center gap-1"
            >
              View all court dates <ArrowRight size={14} />
            </button>
          </div>
        </Card>

        {/* What to do today */}
        <Card>
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="tasks" size={16} variant="selected" /> What to do today
          </h2>
          <EmptyState
            icon={<Icon name="tasks" size={20} />}
            title="No tasks assigned yet"
            description="When your attorney requests something, it will appear here."
            action={<Button variant="secondary" size="sm" onClick={() => navigate('/client-portal/tasks')}>Open tasks</Button>}
          />
        </Card>
      </div>

      {/* Requests & messages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Icon name="documents" size={16} variant="selected" /> Documents Requested
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/client-portal/documents')}>
              View all
            </Button>
          </div>
          <EmptyState
            icon={<Icon name="documents" size={20} />}
            title="No document requests"
            description="Documents your attorney needs will be listed here."
          />
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Icon name="messages" size={16} variant="selected" /> Questions from your Attorney
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/client-portal/messages')}>
              Open messages
            </Button>
          </div>
          <EmptyState
            icon={<Icon name="messages" size={20} />}
            title="No new questions"
            description="Secure messages from your attorney will appear here."
          />
        </Card>
      </div>
    </div>
  );
}
