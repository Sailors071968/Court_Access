// ============================================================================
// Analysis Output Wrapper
// Requirement #3: Every analysis output MUST be wrapped with legal disclaimers.
// This component enforces the "no legal advice" mandate system-wide.
//
// Usage: Wrap any analysis page content with <AnalysisOutputWrapper>.
// It automatically adds:
//   1. Banner disclaimer at top
//   2. Compact disclaimer at bottom
//   3. Guardrail status indicator (Req #2)
// ============================================================================

import { type ReactNode } from 'react';
import { LegalDisclaimer } from './LegalDisclaimer';
import { Shield } from 'lucide-react';

// ---------------------------------------------------------------------------
// Enhanced Disclaimer Text (Requirement #3)
// ---------------------------------------------------------------------------

const ANALYSIS_DISCLAIMER_TEXT =
  'IMPORTANT: This analysis is generated from uploaded evidence documents only and is intended solely as a tool to assist legal professionals. ' +
  'This output does NOT constitute legal advice, legal opinion, or legal representation. ' +
  'No attorney-client relationship is created by use of this platform. ' +
  'All findings, observations, and identified patterns require independent professional legal evaluation. ' +
  'Defense professionals should exercise independent judgment regarding all case strategy decisions.';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AnalysisOutputWrapperProps {
  children: ReactNode;
  className?: string;
}

export function AnalysisOutputWrapper({
  children,
  className = '',
}: AnalysisOutputWrapperProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top: Banner disclaimer (Requirement #3) */}
      <LegalDisclaimer variant="banner" />

      {/* AI Guardrail Notice (Requirement #2) */}
      <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <Shield size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            <span className="font-semibold">AI Verification Active:</span>{' '}
            All analysis findings are sourced exclusively from uploaded evidence documents.
            Unsubstantiated assertions, unsourced claims, and speculative conclusions are
            automatically blocked by the verification system and never reported.
          </p>
        </div>
      </div>

      {/* Analysis content */}
      {children}

      {/* Bottom: Enhanced disclaimer (Requirement #3) */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6">
        <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
          {ANALYSIS_DISCLAIMER_TEXT}
        </p>
      </div>

      {/* Footer: Compact disclaimer */}
      <LegalDisclaimer variant="compact" />
    </div>
  );
}
