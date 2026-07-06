// ============================================================================
// Program 1 — Self-Service Account Settings
// ============================================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User, Lock, CreditCard, Users, Bell, Shield, Loader2, ExternalLink,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { useAuthStore } from '../../stores/authStore';
import {
  fetchMembershipAccount,
  updateMembershipSettings,
  type MembershipAccount,
} from '../../services/membershipApi';
import { createBillingPortalSession } from '../../services/caseApi';

export function AccountSettingsPage() {
  const { user, setSubscriptionStatus } = useAuthStore();
  const [account, setAccount] = useState<MembershipAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchMembershipAccount()
      .then((data) => {
        setAccount(data);
        if (data.subscription?.status) {
          setSubscriptionStatus(data.subscription.status as 'active' | 'trial' | 'past_due' | 'cancelled' | 'none');
        }
      })
      .catch(() => setMessage('Failed to load account'))
      .finally(() => setLoading(false));
  }, [setSubscriptionStatus]);

  const handleSaveSettings = async () => {
    if (!account?.settings) return;
    setSaving(true);
    try {
      await updateMembershipSettings(account.settings as Record<string, boolean | string>);
      setMessage('Settings saved');
    } catch {
      setMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const openBillingPortal = async () => {
    try {
      const { url } = await createBillingPortalSession();
      if (url) window.location.href = url;
    } catch {
      setMessage('Billing portal unavailable — configure Stripe');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  const sub = account?.subscription;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
          {message}
        </div>
      )}

      <Card>
        <div className="flex items-center gap-3 mb-6">
          <User size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Name</span>
            <p className="font-medium">{user?.name}</p>
          </div>
          <div>
            <span className="text-gray-500">Email</span>
            <p className="font-medium">{user?.email}</p>
            {account?.user.emailVerified ? (
              <span className="text-green-600 text-xs">Verified</span>
            ) : (
              <Link to="/verify-email" className="text-amber-600 text-xs hover:underline">Verify email</Link>
            )}
          </div>
          <div>
            <span className="text-gray-500">Role</span>
            <p className="font-medium capitalize">{user?.role}</p>
          </div>
          <div>
            <span className="text-gray-500">MFA</span>
            <p className="font-medium">{account?.user.mfaEnabled ? 'Enabled' : 'Not enabled'}</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-6">
          <CreditCard size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Subscription & Billing</h2>
        </div>
        <div className="space-y-3 text-sm mb-4">
          <p>
            <span className="text-gray-500">Plan: </span>
            <span className="font-medium capitalize">{sub?.planId?.toLowerCase().replace(/_/g, ' ') ?? 'Trial'}</span>
          </p>
          <p>
            <span className="text-gray-500">Status: </span>
            <span className="font-medium capitalize">{sub?.status ?? 'trial'}</span>
          </p>
          {sub?.trialEndsAt && (
            <p>
              <span className="text-gray-500">Trial ends: </span>
              {new Date(sub.trialEndsAt).toLocaleDateString()}
            </p>
          )}
          <p className="text-gray-600">
            Universal membership — full platform access on every plan. Authorization is controlled by delegated permissions.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/pricing"
            className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg text-sm font-semibold hover:bg-amber-400"
          >
            View Plans
          </Link>
          <button
            type="button"
            onClick={openBillingPortal}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
          >
            Manage Billing <ExternalLink size={14} />
          </button>
          <Link to="/dashboard/usage" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Usage & Credits
          </Link>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-6">
          <Users size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Delegated Access</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {account?.delegatedUserLimit == null
            ? 'Invite unlimited users with individual permissions.'
            : `Invite up to ${account.delegatedUserLimit} additional users with individual permissions.`}
          Currently: {account?.delegatedUsers ?? 0} delegated user(s).
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/organization/settings"
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700"
          >
            Manage Invitations
          </Link>
          <Link to="/shared-access" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            My Shared Access
          </Link>
          <Link to="/firm" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Permissions & Firm Platform
          </Link>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-6">
          <Bell size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
        </div>
        <div className="space-y-3">
          {[
            { key: 'notifyEmail', label: 'Email notifications' },
            { key: 'notifyCaseUpdates', label: 'Case updates' },
            { key: 'notifyBilling', label: 'Billing alerts' },
            { key: 'notifyInvitations', label: 'Invitation notifications' },
            { key: 'aiInsightsEnabled', label: 'AI insights' },
            { key: 'autoDocumentAnalysis', label: 'Automatic document analysis' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{label}</span>
              <input
                type="checkbox"
                checked={Boolean((account?.settings as Record<string, boolean>)?.[key] ?? true)}
                onChange={(e) => {
                  if (!account) return;
                  setAccount({
                    ...account,
                    settings: { ...account.settings, [key]: e.target.checked },
                  });
                }}
                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={saving}
          className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Shield size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Security & Legal</h2>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link to="/forgot-password" className="text-blue-600 hover:underline flex items-center gap-1">
            <Lock size={14} /> Change password
          </Link>
          <Link to="/privacy" className="text-gray-600 hover:text-gray-900">Privacy Policy</Link>
          <Link to="/terms" className="text-gray-600 hover:text-gray-900">Terms of Service</Link>
        </div>
        {account?.user.termsAcceptedAt && (
          <p className="text-xs text-gray-400 mt-3">
            Terms accepted {new Date(account.user.termsAcceptedAt).toLocaleDateString()}
          </p>
        )}
      </Card>
    </div>
  );
}
