// ============================================================================
// Credit Purchase Page
// Requirement #4: Straightforward, simplified credit purchase flow.
// Select pack → Confirm → Stripe checkout.
//
// ACU credits are consumed per-analysis and can be purchased as add-ons
// on top of the monthly subscription allotment.
// ============================================================================

import { useState } from 'react';
import { Card } from '../../components/common/Card';
import { LegalDisclaimer } from '../../components/common/LegalDisclaimer';
import {
  Zap,
  CreditCard,
  Check,
  ArrowLeft,
  ShoppingCart,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Credit Pack Configuration
// ---------------------------------------------------------------------------

interface CreditPack {
  id: string;
  credits: number;
  priceCents: number;
  perCreditCents: number;
  popular: boolean;
  savings: string;
}

const CREDIT_PACKS: CreditPack[] = [
  { id: 'pack_50', credits: 50, priceCents: 2250, perCreditCents: 45, popular: false, savings: '' },
  { id: 'pack_150', credits: 150, priceCents: 5250, perCreditCents: 35, popular: true, savings: '30% off' },
  { id: 'pack_500', credits: 500, priceCents: 15000, perCreditCents: 30, popular: false, savings: '40% off' },
  { id: 'pack_1500', credits: 1500, priceCents: 37500, perCreditCents: 25, popular: false, savings: '50% off' },
];

// ---------------------------------------------------------------------------
// Pack Card Component
// ---------------------------------------------------------------------------

function PackCard({
  pack,
  isSelected,
  onSelect,
}: {
  pack: CreditPack;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`relative w-full text-left rounded-xl border-2 p-5 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
      }`}
    >
      {pack.popular && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
          Most Popular
        </span>
      )}

      <div className="text-center">
        <div className="flex items-center justify-center gap-1 mb-2">
          <Zap size={20} className={isSelected ? 'text-blue-600' : 'text-purple-500'} />
          <span className="text-3xl font-bold text-gray-900">{pack.credits}</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">AI Credits</p>

        <p className="text-xl font-bold text-gray-900 mb-1">
          ${(pack.priceCents / 100).toFixed(2)}
        </p>
        <p className="text-[10px] text-gray-500">
          ${(pack.perCreditCents / 100).toFixed(2)} per credit
        </p>

        {pack.savings && (
          <span className="inline-block mt-2 text-[10px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            {pack.savings}
          </span>
        )}
      </div>

      {isSelected && (
        <div className="absolute top-3 right-3">
          <Check size={18} className="text-blue-600" />
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Purchase Summary
// ---------------------------------------------------------------------------

function PurchaseSummary({
  pack,
  onPurchase,
  onCancel,
  isProcessing,
}: {
  pack: CreditPack;
  onPurchase: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}) {
  return (
    <Card>
      <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-purple-500" />
            <span className="text-sm text-gray-700">{pack.credits} AI Credits</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            ${(pack.priceCents / 100).toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Per-credit cost</span>
          <span>${(pack.perCreditCents / 100).toFixed(2)}</span>
        </div>

        <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">Total</span>
          <span className="text-lg font-bold text-gray-900">
            ${(pack.priceCents / 100).toFixed(2)}
          </span>
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mb-4">
        <p className="text-[11px] text-purple-800">
          Purchased credits are added to your balance immediately and roll over for 90 days.
          They are consumed before your monthly subscription credits.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          onClick={onPurchase}
          disabled={isProcessing}
          className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isProcessing ? 'Processing...' : (
            <>
              <ShoppingCart size={14} />
              Purchase Credits
            </>
          )}
        </button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function CreditPurchasePage() {
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<{ success: boolean; message: string } | null>(null);

  const selectedPack = CREDIT_PACKS.find(p => p.id === selectedPackId) ?? null;

  const handlePurchase = async () => {
    if (!selectedPack) return;
    setIsProcessing(true);
    setPurchaseResult(null);

    try {
      const res = await fetch('/api/billing/purchase-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('court-access-token') ?? ''}`,
        },
        body: JSON.stringify({
          packId: selectedPack.id,
          credits: selectedPack.credits,
          priceCents: selectedPack.priceCents,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        setPurchaseResult({
          success: true,
          message: data.message ?? `${selectedPack.credits} credits added to your balance.`,
        });
      } else {
        setPurchaseResult({
          success: false,
          message: 'Unable to process purchase. Please try again or contact support.',
        });
      }
    } catch {
      setPurchaseResult({
        success: false,
        message: 'Network error. Please check your connection and try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 py-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <a href="/billing" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <ArrowLeft size={14} />
            Back to Billing
          </a>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Purchase AI Credits</h1>
        <p className="text-sm text-gray-500 mt-1">
          Add credits to your account instantly. Credits are consumed per analysis operation.
        </p>
      </div>

      {/* Purchase Result */}
      {purchaseResult && (
        <div className={`p-4 rounded-lg border ${
          purchaseResult.success
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {purchaseResult.success ? <Check size={16} /> : <CreditCard size={16} />}
            <p className="text-sm font-medium">{purchaseResult.message}</p>
          </div>
        </div>
      )}

      {/* Credit Packs */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Credit Pack</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {CREDIT_PACKS.map(pack => (
            <PackCard
              key={pack.id}
              pack={pack}
              isSelected={pack.id === selectedPackId}
              onSelect={() => {
                setSelectedPackId(pack.id);
                setPurchaseResult(null);
              }}
            />
          ))}
        </div>
      </div>

      {/* Custom Amount Info */}
      <Card>
        <div className="flex items-start gap-3">
          <CreditCard size={18} className="text-gray-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Need a custom amount?</h3>
            <p className="text-xs text-gray-500 mt-1">
              For enterprise-level credit needs or custom pricing, contact your account manager
              or email support@courtaccess.com.
            </p>
          </div>
        </div>
      </Card>

      {/* How Credits Work */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-3">How ACU Credits Work</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-sm font-bold text-purple-700">1</span>
            </div>
            <p className="text-xs font-medium text-gray-900">Select & Purchase</p>
            <p className="text-[10px] text-gray-500 mt-1">Choose a credit pack and complete checkout via Stripe</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-sm font-bold text-purple-700">2</span>
            </div>
            <p className="text-xs font-medium text-gray-900">Credits Added Instantly</p>
            <p className="text-[10px] text-gray-500 mt-1">Credits appear in your balance immediately after payment</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-sm font-bold text-purple-700">3</span>
            </div>
            <p className="text-xs font-medium text-gray-900">Use for Analysis</p>
            <p className="text-[10px] text-gray-500 mt-1">Credits consumed per analysis — purchased credits used first</p>
          </div>
        </div>
      </Card>

      {/* Purchase Summary */}
      {selectedPack && (
        <PurchaseSummary
          pack={selectedPack}
          onPurchase={handlePurchase}
          onCancel={() => setSelectedPackId(null)}
          isProcessing={isProcessing}
        />
      )}

      {/* Credit Usage Rates */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-3">Credit Usage Rates</h3>
        <div className="space-y-2">
          {[
            { operation: 'CALCRIM Defense Analysis', credits: 5, description: 'Full charge-by-charge element analysis' },
            { operation: 'Evidence Timeline Analysis', credits: 3, description: 'Temporal mapping and inconsistency detection' },
            { operation: 'Contradiction Detection', credits: 4, description: 'Cross-document narrative conflict analysis' },
            { operation: 'Doctrine Analysis', credits: 2, description: 'POST training doctrine comparison' },
            { operation: 'Video Processing', credits: 8, description: 'Body camera and surveillance video analysis' },
            { operation: 'Reliability Scoring', credits: 2, description: 'Witness and evidence reliability assessment' },
          ].map(item => (
            <div key={item.operation} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.operation}</p>
                <p className="text-[10px] text-gray-500">{item.description}</p>
              </div>
              <div className="flex items-center gap-1">
                <Zap size={12} className="text-purple-500" />
                <span className="text-sm font-bold text-purple-700">{item.credits}</span>
                <span className="text-[10px] text-gray-500">credits</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Legal Disclaimer */}
      <LegalDisclaimer variant="compact" />
    </div>
  );
}
