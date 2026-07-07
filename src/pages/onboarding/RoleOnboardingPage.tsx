// ============================================================================
// Program 2A — Role-Based Onboarding Page
// ============================================================================

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Shield, BookOpen, Workflow } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { getDefaultDashboardForRole, type DefaultRole } from '../../config/roleOnboarding';

interface OnboardingPayload {
  defaultRole?: string;
  onboardingSteps?: string[];
  recommendedWorkflows?: string[];
  navigationHighlights?: string[];
  label?: string;
}

export function RoleOnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [config, setConfig] = useState<OnboardingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('court-access-token');
    fetch('/api/membership/onboarding', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setConfig(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const steps = config?.onboardingSteps ?? ['welcome', 'platform_overview'];
  const currentStep = steps[stepIndex] ?? 'welcome';
  const isLast = stepIndex >= steps.length - 1;

  const finish = () => {
    const role = (config?.defaultRole ?? user?.defaultRole ?? 'other') as DefaultRole;
    navigate(getDefaultDashboardForRole(role));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-slate-400">
        Loading your onboarding...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Welcome to CourtAccess</h1>
            <p className="text-slate-400 text-sm">
              {config?.label ? `Configured for ${config.label}` : 'Full platform access for every subscriber'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-8">
          {steps.map((step, i) => (
            <div
              key={step}
              className={`h-1 flex-1 rounded-full ${i <= stepIndex ? 'bg-amber-500' : 'bg-slate-700'}`}
            />
          ))}
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 mb-8">
          <p className="text-amber-400 text-sm font-medium uppercase tracking-wide mb-2">
            Step {stepIndex + 1} of {steps.length}
          </p>
          <h2 className="text-xl font-bold mb-4 capitalize">{currentStep.replace(/_/g, ' ')}</h2>
          <p className="text-slate-300 leading-relaxed mb-6">
            CourtAccess provides the complete platform to every subscriber. Your role configures your default
            dashboard and recommended workflows — it does not restrict any capability. Permissions control
            what you can see in each case.
          </p>

          {config?.recommendedWorkflows && stepIndex === steps.length - 2 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Workflow size={16} /> Recommended Workflows
              </h3>
              <ul className="space-y-2">
                {config.recommendedWorkflows.map((w) => (
                  <li key={w} className="flex items-center gap-2 text-sm text-slate-400">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span className="capitalize">{w.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {config?.navigationHighlights && stepIndex === steps.length - 1 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <BookOpen size={16} /> Your Navigation
              </h3>
              <div className="flex flex-wrap gap-2">
                {config.navigationHighlights.map((n) => (
                  <span key={n} className="px-3 py-1 bg-slate-700 rounded-full text-xs capitalize">
                    {n.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={() => setStepIndex((i) => i - 1)}
              className="text-slate-400 hover:text-white text-sm"
            >
              Back
            </button>
          ) : (
            <Link to="/pricing" className="text-slate-400 hover:text-white text-sm">
              View pricing
            </Link>
          )}
          <button
            type="button"
            onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-6 py-2.5 rounded-lg"
          >
            {isLast ? 'Go to Dashboard' : 'Continue'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
