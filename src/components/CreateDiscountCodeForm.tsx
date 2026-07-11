// ============================================================================
// CourtAccess — Create / Edit Discount Code Form
// Phase 225: Reusable form for admin dashboard + edit modal
// ============================================================================

import { useState } from 'react';
import { Tag, Percent, DollarSign, Calendar, Hash, CheckCircle2 } from 'lucide-react';

export interface DiscountCodeFormData {
  codeName: string;
  codeValue: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  expiresAt: string;
  usageLimit: number | null;
  active: boolean;
}

interface Props {
  initial?: Partial<DiscountCodeFormData>;
  onSubmit: (data: DiscountCodeFormData) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export function CreateDiscountCodeForm({ initial, onSubmit, onCancel, submitLabel = 'Create Code' }: Props) {
  const [codeName, setCodeName] = useState(initial?.codeName || '');
  const [codeValue, setCodeValue] = useState(initial?.codeValue || '');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>(initial?.discountType || 'percent');
  const [discountValue, setDiscountValue] = useState(initial?.discountValue ?? 10);
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt || '');
  const [usageLimitEnabled, setUsageLimitEnabled] = useState(initial?.usageLimit !== null && initial?.usageLimit !== undefined);
  const [usageLimit, setUsageLimit] = useState(initial?.usageLimit ?? 100);
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!codeName.trim()) { setError('Code name is required'); return; }
    if (!codeValue.trim()) { setError('Code value is required'); return; }
    if (!/^[A-Za-z0-9_-]+$/.test(codeValue.trim())) { setError('Code value must be alphanumeric (dashes and underscores allowed)'); return; }
    if (discountValue <= 0) { setError('Discount value must be greater than 0'); return; }
    if (discountType === 'percent' && discountValue > 100) { setError('Percentage cannot exceed 100%'); return; }

    onSubmit({
      codeName: codeName.trim(),
      codeValue: codeValue.trim().toUpperCase(),
      discountType,
      discountValue,
      expiresAt: expiresAt || '',
      usageLimit: usageLimitEnabled ? usageLimit : null,
      active,
    });
    setSuccess(true);
    if (!initial) {
      setCodeName('');
      setCodeValue('');
      setDiscountValue(10);
      setExpiresAt('');
      setUsageLimit(100);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 size={14} /> Discount code saved successfully
        </div>
      )}

      {/* Code Name */}
      <div>
        <label className="block text-sm font-medium text-slate-200 mb-1">Campaign Name</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Tag className="text-slate-400" size={14} />
          </div>
          <input
            type="text"
            value={codeName}
            onChange={(e) => setCodeName(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-gold-light"
            placeholder="e.g. Early Access Promotion"
            required
          />
        </div>
      </div>

      {/* Code Value */}
      <div>
        <label className="block text-sm font-medium text-slate-200 mb-1">Code Value</label>
        <input
          type="text"
          value={codeValue}
          onChange={(e) => setCodeValue(e.target.value.toUpperCase())}
          className="w-full px-4 py-2.5 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-gold-light uppercase font-mono"
          placeholder="e.g. EARLYACCESS50"
          required
        />
        <p className="text-xs text-slate-400 mt-1">Alphanumeric, dashes, and underscores only</p>
      </div>

      {/* Discount Type */}
      <div>
        <label className="block text-sm font-medium text-slate-200 mb-1">Discount Type</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDiscountType('percent')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              discountType === 'percent'
                ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/5'
            }`}
          >
            <Percent size={14} /> Percentage
          </button>
          <button
            type="button"
            onClick={() => setDiscountType('fixed')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              discountType === 'fixed'
                ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/5'
            }`}
          >
            <DollarSign size={14} /> Fixed Amount
          </button>
        </div>
      </div>

      {/* Discount Value */}
      <div>
        <label className="block text-sm font-medium text-slate-200 mb-1">
          {discountType === 'percent' ? 'Discount Percentage' : 'Discount Amount ($)'}
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {discountType === 'percent' ? <Percent className="text-slate-400" size={14} /> : <DollarSign className="text-slate-400" size={14} />}
          </div>
          <input
            type="number"
            min={1}
            max={discountType === 'percent' ? 100 : undefined}
            value={discountValue}
            onChange={(e) => setDiscountValue(Number(e.target.value))}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-gold-light"
            required
          />
        </div>
      </div>

      {/* Expiration Date */}
      <div>
        <label className="block text-sm font-medium text-slate-200 mb-1">Expiration Date <span className="text-slate-400 font-normal">(optional)</span></label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Calendar className="text-slate-400" size={14} />
          </div>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-gold-light"
          />
        </div>
      </div>

      {/* Usage Limit */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            id="usage-limit-toggle"
            checked={usageLimitEnabled}
            onChange={(e) => setUsageLimitEnabled(e.target.checked)}
            className="w-4 h-4 text-gold-light rounded border-white/10"
          />
          <label htmlFor="usage-limit-toggle" className="text-sm font-medium text-slate-200">Set usage limit</label>
        </div>
        {usageLimitEnabled && (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Hash className="text-slate-400" size={14} />
            </div>
            <input
              type="number"
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(Number(e.target.value))}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-gold-light"
              placeholder="Max number of uses"
            />
          </div>
        )}
      </div>

      {/* Active Toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setActive(!active)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${active ? 'bg-emerald-500' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white/5 transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className="text-sm font-medium text-slate-200">{active ? 'Active' : 'Inactive'}</span>
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="flex-1 bg-slate-800 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-slate-700 transition-colors"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-lg border border-white/10 text-sm font-medium text-slate-200 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
