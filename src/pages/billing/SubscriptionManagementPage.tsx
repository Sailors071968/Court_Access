// ============================================================================
// Subscription Management Page
// Requirement #4: Simplified signup/subscription flow. Route out duplicity,
// make sign-up simple and straightforward.
//
// Flow: View current plan → Select new plan → Confirm → Stripe checkout
// ACU credits + subscription displayed as dual hybrid system.
// ============================================================================

import { useState } from 'react';
import { Card } from '../../components/common/Card';
import { LegalDisclaimer } from '../../components/common/LegalDisclaimer';
import { BillingNotificationBanner } from '../../components/common/BillingNotificationBanner';
import { CreditWarningWidget } from '../../components/common/BillingNotificationBanner';
import {
  getSubscriptionTierRegistry,
  type SubscriptionTierConfig,
  type SubscriptionTierId,
} from '../../models/SubscriptionTierModel';
import {
  getBillingOverview,
} from '../../services/billingNotificationEngine';
import {
  Check,
  ArrowRight,
  CreditCard,
  Zap,
  FileText,
  Crown,
  Shield,
  Star,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Tier display configuration
// ---------------------------------------------------------------------------

const TIER_ICONS: Record<string, typeof Star> = {
  FREE: Shield,
  STARTER: Star,
  PROFESSIONAL: Zap,
  ADVANCED_INVESTIGATOR: Crown,
  LITIGATION_INTELLIGENCE_PRO: Crown,
  ENTERPRISE_FIRM: Crown,
};

const TIER_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  FREE: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-600' },
  STARTER: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-600' },
  PROFESSIONAL: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
  ADVANCED_INVESTIGATOR: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  LITIGATION_INTELLIGENCE_PRO: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700' },
  ENTERPRISE_FIRM: { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-800', badge: 'bg-slate-200 text-slate-700' },
};

// ---------------------------------------------------------------------------
// Sample current subscription state
// ---------------------------------------------------------------------------

const CURRENT_PLAN_ID: SubscriptionTierId = 'PROFESSIONAL';
const CURRENT_CREDIT_BALANCE = 28;
const RENEWAL_DATE = '2026-04-01T00:00:00Z';

// ---------------------------------------------------------------------------
// Plan Card Component
// ---------------------------------------------------------------------------

function PlanCard({
  tier,
  isCurrentPlan,
  isSelected,
  onSelect,
}: {
  tier: SubscriptionTierConfig;
  isCurrentPlan: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const colors = TIER_COLORS[tier.id] ?? TIER_COLORS.FREE;
  const Icon = TIER_ICONS[tier.id] ?? Shield;
  const isFree = tier.monthlyPriceCents === 0;

  return (
    <button
      onClick={onSelect}
      disabled={isCurrentPlan}
      className={`w-full text-left rounded-xl border-2 p-5 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
          : isCurrentPlan
            ? `${colors.border} ${colors.bg} opacity-75`
            : `border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white`
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className={isSelected ? 'text-blue-600' : colors.text} />
          <h3 className="font-bold text-gray-900">{tier.name}</h3>
        </div>
        {isCurrentPlan && (
          <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            Current Plan
          </span>
        )}
        {isSelected && !isCurrentPlan && (
          <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            Selected
          </span>
        )}
      </div>

      {/* Price */}
      <div className="mb-3">
        {isFree ? (
          <p className="text-2xl font-bold text-gray-900">Free</p>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900">
              ${(tier.monthlyPriceCents / 100).toFixed(0)}
            </span>
            <span className="text-sm text-gray-500">/month</span>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 mb-4">{tier.description}</p>

      {/* Features */}
      <div className="space-y-2">
        <Feature icon={<FileText size={12} />} text={`${tier.monthlyPageLimit.toLocaleString()} pages/month`} />
        <Feature icon={<Zap size={12} />} text={`${tier.monthlyAiCredits} AI credits/month`} />
        <Feature icon={<CreditCard size={12} />} text={
          tier.creditPriceCents > 0
            ? `Additional credits: $${(tier.creditPriceCents / 100).toFixed(2)}/credit`
            : 'No additional credit purchases'
        } />
        <Feature icon={<Shield size={12} />} text={`${tier.maxUploadMB}MB max upload`} />
        {tier.archiveEligible && (
          <Feature icon={<Check size={12} />} text={`${tier.retentionDays}-day retention`} />
        )}
      </div>
    </button>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-700">
      <span className="text-gray-400">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkout Confirmation Modal
// ---------------------------------------------------------------------------

function CheckoutConfirmation({
  tier,
  onConfirm,
  onCancel,
  isProcessing,
}: {
  tier: SubscriptionTierConfig;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Plan Change</h3>
        <p className="text-sm text-gray-600 mb-4">
          You are switching to the <span className="font-semibold">{tier.name}</span> plan
          at <span className="font-semibold">${(tier.monthlyPriceCents / 100).toFixed(0)}/month</span>.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Monthly pages</span>
            <span className="font-medium">{tier.monthlyPageLimit.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Monthly AI credits</span>
            <span className="font-medium">{tier.monthlyAiCredits}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Add-on credit price</span>
            <span className="font-medium">${(tier.creditPriceCents / 100).toFixed(2)}/credit</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? 'Processing...' : (
              <>
                Proceed to Checkout
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function SubscriptionManagementPage() {
  const [selectedTierId, setSelectedTierId] = useState<SubscriptionTierId | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  const tiers = getSubscriptionTierRegistry();
  const displayTiers = tiers.filter(t => !t.isLifetime && !t.id.startsWith('TIER_')); // Exclude legacy lifetime and TIER_N tiers

  const billingOverview = getBillingOverview(
    'current-tenant',
    CURRENT_CREDIT_BALANCE,
    CURRENT_PLAN_ID,
    RENEWAL_DATE,
  );

  const handleProceedToCheckout = async () => {
    if (!selectedTierId) return;
    setIsProcessing(true);

    try {
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('court-access-token') ?? ''}`,
        },
        body: JSON.stringify({ planId: selectedTierId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCheckoutMessage(data.message ?? 'Unable to process plan change. Please try again or contact support.');
        setShowConfirmation(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutMessage(data.message ?? 'Checkout session created. Configure Stripe keys for live checkout.');
        setShowConfirmation(false);
      }
    } catch {
      setCheckoutMessage('Unable to connect to billing server. Please try again.');
      setShowConfirmation(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 py-8">
      {/* Notifications */}
      <BillingNotificationBanner notifications={billingOverview.notifications} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription & Billing</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your plan, AI credits, and billing preferences
          </p>
        </div>
        <CreditWarningWidget
          currentBalance={billingOverview.creditStatus.currentBalance}
          monthlyAllotment={billingOverview.creditStatus.monthlyAllotment}
          renewalDate={RENEWAL_DATE}
          daysUntilRenewal={billingOverview.subscriptionStatus.daysUntilRenewal}
          className="w-64"
        />
      </div>

      {/* Checkout message */}
      {checkoutMessage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">{checkoutMessage}</p>
        </div>
      )}

      {/* Plan Selection Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose Your Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayTiers.map(tier => (
            <PlanCard
              key={tier.id}
              tier={tier}
              isCurrentPlan={tier.id === CURRENT_PLAN_ID}
              isSelected={tier.id === selectedTierId}
              onSelect={() => {
                setSelectedTierId(tier.id);
                setCheckoutMessage(null);
              }}
            />
          ))}
        </div>
      </div>

      {/* Action */}
      {selectedTierId && selectedTierId !== CURRENT_PLAN_ID && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowConfirmation(true)}
            className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg"
          >
            <CreditCard size={18} />
            Upgrade to {displayTiers.find(t => t.id === selectedTierId)?.name ?? selectedTierId}
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* ACU Hybrid System Explanation */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-3">ACU Credit & Subscription Hybrid System</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-purple-600" />
              <h4 className="text-sm font-semibold text-purple-900">Monthly AI Credits (ACU)</h4>
            </div>
            <ul className="space-y-1 text-xs text-purple-800">
              <li>- Credits replenish monthly on your renewal date</li>
              <li>- Each analysis operation consumes credits based on complexity</li>
              <li>- Additional credits can be purchased at any time</li>
              <li>- Purchased add-on credits roll over for 90 days</li>
              <li>- Credit balance visible on dashboard at all times</li>
            </ul>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard size={16} className="text-blue-600" />
              <h4 className="text-sm font-semibold text-blue-900">Monthly Subscription</h4>
            </div>
            <ul className="space-y-1 text-xs text-blue-800">
              <li>- Fixed monthly fee billed via Stripe</li>
              <li>- Includes base page limit and AI credit allotment</li>
              <li>- Automatic renewal with email notification 7 days prior</li>
              <li>- Upgrade or downgrade at any time</li>
              <li>- Email alerts when credits are nearly exhausted</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Legal Disclaimer */}
      <LegalDisclaimer variant="compact" />

      {/* Checkout Confirmation Modal */}
      {showConfirmation && selectedTierId && (
        <CheckoutConfirmation
          tier={displayTiers.find(t => t.id === selectedTierId)!}
          onConfirm={handleProceedToCheckout}
          onCancel={() => setShowConfirmation(false)}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
}
