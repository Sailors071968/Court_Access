// ============================================================================
// CourtAccess — Usage Dashboard
// Shows page usage, AI credit balance, progress bars, purchase modal.
// ============================================================================

import { useState } from 'react';
import { Card } from '../../components/common/Card';
import {
  FileText,
  Cpu,
  AlertTriangle,
  ShoppingCart,
  TrendingUp,
  Zap,
  X,
  Check,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsageData {
  plan: { id: string; name: string; priceCents: number };
  pages: { used: number; limit: number; remaining: number; percentUsed: number; warningLevel: string };
  credits: { used: number; limit: number; available: number; percentUsed: number; warningLevel: string };
  billingPeriod: { start: string; end: string };
}

interface CreditPack {
  packId: string;
  credits: number;
  priceCents: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Sample Data
// ---------------------------------------------------------------------------

const SAMPLE_USAGE: UsageData = {
  plan: { id: 'PROFESSIONAL', name: 'Professional', priceCents: 12900 },
  pages: { used: 1650, limit: 2000, remaining: 350, percentUsed: 83, warningLevel: 'approaching' },
  credits: { used: 72, limit: 100, available: 28, percentUsed: 72, warningLevel: 'none' },
  billingPeriod: {
    start: '2026-03-01T00:00:00Z',
    end: '2026-04-01T00:00:00Z',
  },
};

const CREDIT_PACKS: CreditPack[] = [
  { packId: 'pack_50', credits: 50, priceCents: 2500, description: '50 AI Credits' },
  { packId: 'pack_150', credits: 150, priceCents: 6000, description: '150 AI Credits' },
  { packId: 'pack_500', credits: 500, priceCents: 17500, description: '500 AI Credits' },
  { packId: 'pack_1500', credits: 1500, priceCents: 45000, description: '1,500 AI Credits' },
];

// ---------------------------------------------------------------------------
// Progress Bar Component
// ---------------------------------------------------------------------------

function UsageProgressBar({
  label,
  used,
  limit,
  percentUsed,
  warningLevel,
  icon,
  unit,
}: {
  label: string;
  used: number;
  limit: number;
  percentUsed: number;
  warningLevel: string;
  icon: React.ReactNode;
  unit: string;
}) {
  const barColor =
    warningLevel === 'exceeded'
      ? 'bg-red-500'
      : warningLevel === 'approaching'
        ? 'bg-amber-500'
        : 'bg-blue-600';

  const textColor =
    warningLevel === 'exceeded'
      ? 'text-red-600'
      : warningLevel === 'approaching'
        ? 'text-amber-600'
        : 'text-gray-700';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        <span className={`text-sm font-bold ${textColor}`}>
          {used.toLocaleString()} / {limit.toLocaleString()} {unit}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`${barColor} h-3 rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{percentUsed}% used</span>
        <span>{(limit - used).toLocaleString()} remaining</span>
      </div>
      {warningLevel === 'approaching' && (
        <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
          <AlertTriangle size={12} />
          Approaching limit — consider upgrading or purchasing add-ons
        </div>
      )}
      {warningLevel === 'exceeded' && (
        <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
          <AlertTriangle size={12} />
          Limit exceeded — uploads/analyses blocked until upgraded
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Purchase Modal Component
// ---------------------------------------------------------------------------

function PurchaseModal({
  isOpen,
  onClose,
  packs,
}: {
  isOpen: boolean;
  onClose: () => void;
  packs: CreditPack[];
}) {
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState(false);

  if (!isOpen) return null;

  const handlePurchase = () => {
    if (!selectedPack) return;
    setPurchasing(true);
    // Simulate purchase
    setTimeout(() => {
      setPurchasing(false);
      setPurchased(true);
      setTimeout(() => {
        setPurchased(false);
        setSelectedPack(null);
        onClose();
      }, 1500);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Purchase AI Credits</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Purchased credits roll over for 90 days and are consumed before monthly credits.
        </p>

        <div className="space-y-3 mb-6">
          {packs.map((pack) => (
            <button
              key={pack.packId}
              onClick={() => setSelectedPack(pack.packId)}
              className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                selectedPack === pack.packId
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <Zap size={20} className={selectedPack === pack.packId ? 'text-blue-600' : 'text-gray-400'} />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{pack.description}</p>
                  <p className="text-xs text-gray-500">
                    ${(pack.priceCents / pack.credits).toFixed(0)}c per credit
                  </p>
                </div>
              </div>
              <span className="text-lg font-bold text-gray-900">
                ${(pack.priceCents / 100).toFixed(0)}
              </span>
            </button>
          ))}
        </div>

        {purchased ? (
          <div className="flex items-center justify-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
            <Check size={20} />
            Credits added successfully!
          </div>
        ) : (
          <button
            onClick={handlePurchase}
            disabled={!selectedPack || purchasing}
            className={`w-full py-3 rounded-lg font-medium text-white transition-all ${
              selectedPack && !purchasing
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {purchasing ? 'Processing...' : 'Purchase Credits'}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

export function UsageDashboard() {
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const usage = SAMPLE_USAGE;

  const billingEnd = new Date(usage.billingPeriod.end);
  const daysLeft = Math.max(
    0,
    Math.ceil((billingEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usage & Billing</h1>
          <p className="text-sm text-gray-500 mt-1">
            {usage.plan.name} Plan — {daysLeft} days remaining in billing period
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPurchaseModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <ShoppingCart size={16} />
            Buy Credits
          </button>
        </div>
      </div>

      {/* Plan Summary */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{usage.plan.name} Plan</h3>
              <p className="text-sm text-gray-500">
                ${(usage.plan.priceCents / 100).toFixed(0)}/month
              </p>
            </div>
          </div>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Upgrade Plan
          </button>
        </div>
      </Card>

      {/* Usage Meters */}
      <div className="grid gap-6">
        <Card>
          <UsageProgressBar
            label="Pages Uploaded"
            used={usage.pages.used}
            limit={usage.pages.limit}
            percentUsed={usage.pages.percentUsed}
            warningLevel={usage.pages.warningLevel}
            icon={<FileText size={16} className="text-blue-500" />}
            unit="pages"
          />
        </Card>

        <Card>
          <UsageProgressBar
            label="AI Credits"
            used={usage.credits.used}
            limit={usage.credits.limit}
            percentUsed={usage.credits.percentUsed}
            warningLevel={usage.credits.warningLevel}
            icon={<Cpu size={16} className="text-purple-500" />}
            unit="credits"
          />
        </Card>
      </div>

      {/* Credit Usage Breakdown */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Credit Usage by Analysis Type</h3>
        <div className="space-y-3">
          {[
            { type: 'Contradiction Engine', credits: 35, icon: '🔍' },
            { type: 'Doctrine Analysis', credits: 15, icon: '📚' },
            { type: 'Litigation Intelligence', credits: 12, icon: '⚖️' },
            { type: 'Reliability Scoring', credits: 7, icon: '📊' },
            { type: 'Video Processing', credits: 3, icon: '🎥' },
          ].map((item) => (
            <div key={item.type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span>{item.icon}</span>
                <span className="text-sm text-gray-700">{item.type}</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{item.credits} credits</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Credit Pack Pricing */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Credit Pack Add-ons</h3>
          <span className="text-xs text-gray-500">Purchased credits roll over for 90 days</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.packId}
              onClick={() => setShowPurchaseModal(true)}
              className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-center"
            >
              <p className="text-2xl font-bold text-gray-900">{pack.credits}</p>
              <p className="text-xs text-gray-500 mb-2">credits</p>
              <p className="text-sm font-semibold text-blue-600">
                ${(pack.priceCents / 100).toFixed(0)}
              </p>
            </button>
          ))}
        </div>
      </Card>

      {/* Purchase Modal */}
      <PurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        packs={CREDIT_PACKS}
      />
    </div>
  );
}
