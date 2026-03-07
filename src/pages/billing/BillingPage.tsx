// ============================================
// Court Access — Billing & Subscription Page (Phase 23)
// Displays current plan, invoices, and subscription management.
// ============================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  Calendar,
  CheckCircle,
  AlertCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  Receipt,
  Shield,
  Zap,
  Users,
  X,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import type { SubscriptionRecord, SubscriptionPlan, InvoiceRecord } from '../../models/SubscriptionModel';
import {
  PLAN_CONFIGS,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_COLORS,
} from '../../models/SubscriptionModel';
import {
  getCurrentSubscription,
  getInvoiceHistory,
  cancelSubscription,
  reactivateSubscription,
  changePlan,
  formatAmount,
} from '../../services/subscriptionService';

// ---------------------------------------------------------------------------
// Plan Card
// ---------------------------------------------------------------------------

function PlanCard({
  plan,
  isCurrent,
  onSelect,
  isLoading,
}: {
  plan: typeof PLAN_CONFIGS.professional;
  isCurrent: boolean;
  onSelect: () => void;
  isLoading: boolean;
}) {
  return (
    <div
      className={`border rounded-xl p-5 transition-all ${
        isCurrent
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
        {isCurrent && (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            Current Plan
          </span>
        )}
      </div>
      <div className="mb-4">
        <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
        {plan.price > 0 && <span className="text-gray-500 text-sm">/month</span>}
      </div>
      <ul className="space-y-2 mb-5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
            <CheckCircle size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
      <div className="text-xs text-gray-400 mb-4 space-y-1">
        <p>Storage: {plan.limits.maxStorageGB >= 1 ? `${plan.limits.maxStorageGB} GB` : `${Math.round(plan.limits.maxStorageGB * 1024)} MB`}</p>
        <p>Team: {plan.limits.maxTeamMembers} member{plan.limits.maxTeamMembers > 1 ? 's' : ''}</p>
        <p>Pages/doc: {plan.limits.maxPagesPerDocument}</p>
      </div>
      {!isCurrent && plan.price > 0 && (
        <button
          onClick={onSelect}
          disabled={isLoading}
          className="w-full py-2.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : isCurrent ? null : (
            <>
              <Zap size={14} />
              Switch to {plan.name}
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Billing Page
// ---------------------------------------------------------------------------

export function BillingPage() {
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    // Load subscription data
    const sub = getCurrentSubscription();
    const invs = getInvoiceHistory();
    setSubscription(sub);
    setInvoices(invs);
    setLoading(false);
  }, []);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will retain access until the end of the billing period.')) return;
    setActionLoading(true);
    setError(null);
    const result = await cancelSubscription();
    if (result.success) {
      setSubscription(getCurrentSubscription());
      setSuccessMsg('Subscription will cancel at the end of the billing period.');
    } else {
      setError(result.error);
    }
    setActionLoading(false);
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    setError(null);
    const result = await reactivateSubscription();
    if (result.success) {
      setSubscription(getCurrentSubscription());
      setSuccessMsg('Subscription reactivated successfully.');
    } else {
      setError(result.error);
    }
    setActionLoading(false);
  };

  const handleChangePlan = async (plan: SubscriptionPlan) => {
    setActionLoading(true);
    setError(null);
    const result = await changePlan(plan);
    if (result.success) {
      setSubscription(getCurrentSubscription());
      setSuccessMsg(`Plan changed to ${PLAN_CONFIGS[plan].name} successfully.`);
      setShowChangePlan(false);
    } else {
      setError(result.error);
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your plan, payment method, and billing history</p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700">{successMsg}</p>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-green-400 hover:text-green-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Current Plan */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <CreditCard size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
        </div>

        {subscription ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {PLAN_CONFIGS[subscription.plan]?.name ?? subscription.plan}
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mt-2 ${
                    SUBSCRIPTION_STATUS_COLORS[subscription.status]
                  }`}
                >
                  {SUBSCRIPTION_STATUS_LABELS[subscription.status]}
                </span>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">
                  ${PLAN_CONFIGS[subscription.plan]?.price ?? 0}
                  <span className="text-base font-normal text-gray-500">/mo</span>
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 py-4 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Current Period</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(subscription.currentPeriodStart).toLocaleDateString()} —{' '}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Next Renewal</p>
                  <p className="text-sm font-medium text-gray-900">
                    {subscription.cancelAtPeriodEnd
                      ? 'Cancels on ' + new Date(subscription.renewalDate).toLocaleDateString()
                      : new Date(subscription.renewalDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Shield size={16} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Member Since</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(subscription.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => setShowChangePlan(!showChangePlan)}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <ArrowUpCircle size={14} />
                Change Plan
              </button>
              {subscription.cancelAtPeriodEnd ? (
                <button
                  onClick={handleReactivate}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Reactivate Subscription
                </button>
              ) : (
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownCircle size={14} />}
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No active subscription</p>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-xl font-medium text-sm hover:bg-slate-700 transition-colors"
            >
              <Zap size={16} />
              View Plans
            </Link>
          </div>
        )}
      </Card>

      {/* Change Plan Modal */}
      {showChangePlan && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Choose a Plan</h2>
            <button onClick={() => setShowChangePlan(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {Object.values(PLAN_CONFIGS).map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={subscription?.plan === plan.id}
                onSelect={() => handleChangePlan(plan.id)}
                isLoading={actionLoading}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Usage */}
      {subscription && (
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <Users size={20} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Usage</h2>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Documents Analyzed', current: 47, max: PLAN_CONFIGS[subscription.plan]?.limits.maxDocuments ?? 1 },
              { label: 'Storage Used', current: 2.3, max: PLAN_CONFIGS[subscription.plan]?.limits.maxStorageGB ?? 0.1, unit: 'GB' },
              { label: 'Team Members', current: 1, max: PLAN_CONFIGS[subscription.plan]?.limits.maxTeamMembers ?? 1 },
            ].map(({ label, current, max, unit }) => {
              const isUnlimited = max === -1;
              const percentage = isUnlimited ? 10 : Math.min(100, (current / max) * 100);
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-700">{label}</span>
                    <span className="text-sm text-gray-500">
                      {current}{unit ? ` ${unit}` : ''} / {isUnlimited ? 'Unlimited' : `${max}${unit ? ` ${unit}` : ''}`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        percentage > 80 ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Invoice History */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <Receipt size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Billing History</h2>
        </div>

        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Invoice</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Period</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Amount</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.invoiceId} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-xs text-gray-700">{inv.stripeInvoiceId}</td>
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(inv.periodStart).toLocaleDateString()} — {new Date(inv.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{formatAmount(inv.amount, inv.currency)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center py-8 text-gray-400 text-sm">No invoices yet</p>
        )}
      </Card>
    </div>
  );
}
