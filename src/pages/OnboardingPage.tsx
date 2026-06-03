// ============================================================================
// CourtAccess — Attorney Onboarding Flow
// Guides new users through: Welcome → Plan Selection → First Case Creation
// ============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scale, ArrowRight, ArrowLeft, CheckCircle2, Upload, FileText,
  Briefcase, Loader2, Search,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { createCase, type CreateCasePayload, CASE_TYPES } from '../services/caseApi';
import { createCheckoutSession } from '../services/caseApi';

type Step = 'welcome' | 'plan' | 'first-case' | 'done';

const PLAN_ID_MAP: Record<string, string> = {
  'Starter': 'STARTER',
  'Professional': 'PROFESSIONAL',
  'Advanced Investigator': 'ADVANCED_INVESTIGATOR',
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState<Step>('welcome');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [creatingCase, setCreatingCase] = useState(false);
  const [caseForm, setCaseForm] = useState<CreateCasePayload>({
    title: '',
    caseNumber: '',
    jurisdiction: 'California',
    caseType: 'felony',
  });
  const [error, setError] = useState<string | null>(null);

  const handlePlanSelect = async (planName: string) => {
    if (planName === 'Free') {
      setSelectedPlan('Free');
      setStep('first-case');
      return;
    }
    const planId = PLAN_ID_MAP[planName];
    if (!planId) return;
    setCheckingOut(true);
    setError(null);
    try {
      const result = await createCheckoutSession(planId);
      if (result.url) {
        window.location.href = result.url;
      } else {
        setError('Unable to start checkout. Please try again.');
      }
    } catch {
      setError('Checkout failed. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleCreateCase = async () => {
    if (!caseForm.title.trim() || !caseForm.caseNumber.trim()) {
      setError('Please fill in the case title and case number.');
      return;
    }
    setCreatingCase(true);
    setError(null);
    try {
      const newCase = await createCase(caseForm);
      setStep('done');
      setTimeout(() => {
        navigate(`/cases/${newCase.caseId}/overview`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create case');
    } finally {
      setCreatingCase(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <Scale className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold text-white">CourtAccess</span>
          </div>
          <div className="flex items-center gap-2">
            {(['welcome', 'plan', 'first-case', 'done'] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  s === step ? 'bg-amber-400' :
                  (['welcome', 'plan', 'first-case', 'done'].indexOf(step) > i ? 'bg-emerald-400' : 'bg-white/20')
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Welcome */}
        {step === 'welcome' && (
          <div className="text-center max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <Scale className="text-amber-400" size={40} />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">
              Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-xl text-slate-300 mb-8 leading-relaxed">
              You're about to transform how you analyze criminal case evidence.
              Let's get you set up in under 2 minutes.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              {[
                { icon: Upload, label: 'Upload Evidence', desc: 'Reports, bodycam, witness statements' },
                { icon: Search, label: 'Find Contradictions', desc: 'Automated cross-reference analysis' },
                { icon: FileText, label: 'Export for Trial', desc: 'Impeachment-ready materials' },
              ].map((item) => (
                <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <item.icon className="text-amber-400 mb-3" size={24} />
                  <h3 className="text-white font-semibold mb-1">{item.label}</h3>
                  <p className="text-slate-400 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep('plan')}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 py-3.5 rounded-xl text-lg transition-colors"
            >
              Choose Your Plan
              <ArrowRight size={20} />
            </button>
            <button
              onClick={() => {
                setSelectedPlan('Free');
                setStep('first-case');
              }}
              className="block mx-auto mt-4 text-slate-400 hover:text-white text-sm transition-colors"
            >
              Skip — start with Free plan
            </button>
          </div>
        )}

        {/* Step 2: Plan Selection */}
        {step === 'plan' && (
          <div>
            <button
              onClick={() => setStep('welcome')}
              className="flex items-center gap-1 text-slate-400 hover:text-white mb-6 text-sm transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <h2 className="text-3xl font-bold text-white mb-2 text-center">Choose Your Plan</h2>
            <p className="text-slate-400 text-center mb-8">Start free, upgrade anytime. All plans include core evidence analysis.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  name: 'Free',
                  price: '$0',
                  period: 'forever',
                  features: ['10 pages lifetime', '1 case', 'Evidence graph view', 'Watermarked exports'],
                  highlight: false,
                },
                {
                  name: 'Starter',
                  price: '$39',
                  period: '/month',
                  features: ['300 pages/mo', '20 AI credits/mo', 'Contradiction detection', 'Timeline reconstruction', 'Clean exports'],
                  highlight: false,
                },
                {
                  name: 'Professional',
                  price: '$129',
                  period: '/month',
                  features: ['2,000 pages/mo', '100 AI credits/mo', 'Narrative deconstruction', 'Doctrine matching', 'Priority support'],
                  highlight: true,
                },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-2xl p-6 border transition-all cursor-pointer ${
                    plan.highlight
                      ? 'bg-amber-500/10 border-amber-500/40 ring-2 ring-amber-500/20'
                      : 'bg-white/5 border-white/10 hover:border-white/30'
                  }`}
                  onClick={() => handlePlanSelect(plan.name)}
                >
                  {plan.highlight && (
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 block">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                    <span className="text-slate-400 text-sm">{plan.period}</span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                        <CheckCircle2 className="text-emerald-400 shrink-0" size={14} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    disabled={checkingOut}
                    className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                      plan.highlight
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {checkingOut ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Processing...
                      </span>
                    ) : (
                      plan.name === 'Free' ? 'Start Free' : `Choose ${plan.name}`
                    )}
                  </button>
                </div>
              ))}
            </div>

            <p className="text-center text-slate-500 text-sm mt-6">
              Need more? <a href="/pricing" className="text-amber-400 hover:underline">View all plans</a> including Advanced Investigator, Litigation Pro, and Enterprise.
            </p>
          </div>
        )}

        {/* Step 3: First Case Creation */}
        {step === 'first-case' && (
          <div className="max-w-xl mx-auto">
            <button
              onClick={() => setStep('plan')}
              className="flex items-center gap-1 text-slate-400 hover:text-white mb-6 text-sm transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Briefcase className="text-emerald-400" size={32} />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Create Your First Case</h2>
              <p className="text-slate-400">
                {selectedPlan === 'Free'
                  ? 'You can start with the Free plan. Create a case to begin.'
                  : 'Great choice! Now let\'s set up your first case.'}
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Case Title</label>
                <input
                  type="text"
                  value={caseForm.title}
                  onChange={(e) => setCaseForm({ ...caseForm, title: e.target.value })}
                  placeholder="e.g. People v. Smith — DUI Defense"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Case Number</label>
                <input
                  type="text"
                  value={caseForm.caseNumber}
                  onChange={(e) => setCaseForm({ ...caseForm, caseNumber: e.target.value })}
                  placeholder="e.g. 2025-CR-12345"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Jurisdiction</label>
                  <input
                    type="text"
                    value={caseForm.jurisdiction}
                    onChange={(e) => setCaseForm({ ...caseForm, jurisdiction: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Case Type</label>
                  <select
                    value={caseForm.caseType}
                    onChange={(e) => setCaseForm({ ...caseForm, caseType: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none"
                  >
                    {CASE_TYPES.map((t) => (
                      <option key={t.value} value={t.value} className="bg-slate-800">{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleCreateCase}
                disabled={creatingCase}
                className="w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-3 rounded-xl text-lg transition-colors disabled:opacity-50"
              >
                {creatingCase ? (
                  <><Loader2 size={20} className="animate-spin" /> Creating...</>
                ) : (
                  <>Create Case <ArrowRight size={20} /></>
                )}
              </button>

              <button
                onClick={() => navigate('/dashboard')}
                className="w-full text-slate-400 hover:text-white text-sm transition-colors py-2"
              >
                Skip — I'll create a case later
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <div className="text-center max-w-lg mx-auto">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="text-emerald-400" size={40} />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">You're All Set!</h2>
            <p className="text-slate-300 text-lg mb-6">
              Your case is ready. Upload your evidence — reports, bodycam footage, witness statements —
              and CourtAccess will find the contradictions.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-6 py-3 rounded-xl transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
