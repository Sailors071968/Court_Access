// ============================================================================
// CourtAccess — Neutral Legal Disclaimer Component
// Phase 214: Standardized disclaimer block for analysis outputs
// ============================================================================

import { AlertTriangle } from 'lucide-react';

interface LegalDisclaimerProps {
  variant?: 'inline' | 'banner' | 'compact';
  className?: string;
}

const DISCLAIMER_TEXT =
  'CourtAccess provides analytical tools designed to assist legal professionals in reviewing evidence and identifying potential procedural inconsistencies. The platform does not determine guilt, innocence, or policy violations. All findings require professional legal evaluation.';

export function LegalDisclaimer({ variant = 'inline', className = '' }: LegalDisclaimerProps) {
  if (variant === 'compact') {
    return (
      <p className={`text-xs text-gray-400 italic ${className}`}>
        {DISCLAIMER_TEXT}
      </p>
    );
  }

  if (variant === 'banner') {
    return (
      <div className={`bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 ${className}`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
          <p className="text-sm text-amber-800 leading-relaxed">
            {DISCLAIMER_TEXT}
          </p>
        </div>
      </div>
    );
  }

  // Default: inline
  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <AlertTriangle className="text-amber-600" size={16} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-1">Legal Disclaimer</h4>
          <p className="text-sm text-slate-500 leading-relaxed">
            {DISCLAIMER_TEXT}
          </p>
        </div>
      </div>
    </div>
  );
}
