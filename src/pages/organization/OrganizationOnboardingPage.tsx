// ============================================
// Program 2 — Organization Onboarding
// ============================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { advanceOnboarding } from '../../services/organizationApi';

const STEPS = ['profile', 'offices', 'team', 'complete'] as const;

export function OrganizationOnboardingPage() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [officeName, setOfficeName] = useState('');
  const [error, setError] = useState('');

  const currentStep = STEPS[stepIndex];

  const next = async () => {
    setError('');
    try {
      if (currentStep === 'profile') {
        await advanceOnboarding({ step: 'profile', profile: { name, tagline } });
      } else if (currentStep === 'offices') {
        await advanceOnboarding({
          step: 'offices',
          primaryOffice: officeName ? { name: officeName, city: 'Los Angeles', state: 'CA' } : undefined,
        });
      } else if (currentStep === 'team') {
        await advanceOnboarding({ step: 'team' });
      } else {
        await advanceOnboarding({ step: 'complete' });
        navigate('/organization/settings');
        return;
      }
      setStepIndex((i) => i + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onboarding step failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-xl font-bold mb-2">Set up your law firm</h1>
        <p className="text-sm text-gray-600 mb-6">Step {stepIndex + 1} of {STEPS.length}: {currentStep}</p>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}

        {currentStep === 'profile' && (
          <div className="space-y-3">
            <input className="w-full border rounded-lg px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Law firm name" />
            <input className="w-full border rounded-lg px-3 py-2" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline (optional)" />
          </div>
        )}
        {currentStep === 'offices' && (
          <input className="w-full border rounded-lg px-3 py-2" value={officeName} onChange={(e) => setOfficeName(e.target.value)} placeholder="Primary office name" />
        )}
        {currentStep === 'team' && (
          <p className="text-sm text-gray-600">You can invite attorneys, investigators, and staff from Organization Settings after onboarding.</p>
        )}
        {currentStep === 'complete' && (
          <p className="text-sm text-gray-600">Your organization is ready. Complete setup to access the full platform.</p>
        )}

        <button type="button" onClick={next} className="mt-6 w-full bg-slate-800 text-white py-2.5 rounded-lg font-medium">
          {currentStep === 'complete' ? 'Finish' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
