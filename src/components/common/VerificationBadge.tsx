// ============================================================================
// Verification Badge Component
// Requirement #2: Visual indicator of AI verification status on all
// analysis outputs. Shows whether findings are evidence-corroborated,
// single-source, or require review.
//
// Ensures users always know the verification level of every finding.
// ============================================================================

import { CheckCircle, AlertCircle, Eye, XCircle, HelpCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BadgeStatus = 'verified' | 'corroborated' | 'single_source' | 'review_needed' | 'rejected' | 'unverified';
type BadgeSize = 'sm' | 'md' | 'lg';

interface VerificationBadgeProps {
  status: BadgeStatus;
  size?: BadgeSize;
  showLabel?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BADGE_CONFIG: Record<BadgeStatus, {
  label: string;
  description: string;
  icon: typeof CheckCircle;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  verified: {
    label: 'Evidence Verified',
    description: 'Corroborated by multiple evidence sources',
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
  },
  corroborated: {
    label: 'Corroborated',
    description: 'Supported by 2+ evidence documents',
    icon: CheckCircle,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
  },
  single_source: {
    label: 'Single Source',
    description: 'Based on one evidence document only',
    icon: Eye,
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
  review_needed: {
    label: 'Review Needed',
    description: 'Requires professional review and corroboration',
    icon: AlertCircle,
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
  },
  rejected: {
    label: 'Unsubstantiated',
    description: 'Failed verification — not displayed',
    icon: XCircle,
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
  },
  unverified: {
    label: 'Unverified',
    description: 'Insufficient evidence to verify',
    icon: HelpCircle,
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-200',
  },
};

const SIZE_CONFIG: Record<BadgeSize, {
  iconSize: number;
  textSize: string;
  padding: string;
}> = {
  sm: { iconSize: 10, textSize: 'text-[9px]', padding: 'px-1.5 py-0.5' },
  md: { iconSize: 14, textSize: 'text-xs', padding: 'px-2 py-1' },
  lg: { iconSize: 16, textSize: 'text-sm', padding: 'px-3 py-1.5' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VerificationBadge({
  status,
  size = 'md',
  showLabel = true,
  className = '',
}: VerificationBadgeProps) {
  const config = BADGE_CONFIG[status];
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 ${sizeConfig.padding} rounded-full border ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}
      title={config.description}
    >
      <Icon size={sizeConfig.iconSize} />
      {showLabel && (
        <span className={`${sizeConfig.textSize} font-medium whitespace-nowrap`}>
          {config.label}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Guardrail Status Banner
// Shows aggregate verification status for an entire analysis section.
// ============================================================================

interface GuardrailStatusBannerProps {
  totalClaims: number;
  verifiedClaims: number;
  rejectedClaims: number;
  overallConfidence: number;
  className?: string;
}

export function GuardrailStatusBanner({
  totalClaims,
  verifiedClaims,
  rejectedClaims,
  overallConfidence,
  className = '',
}: GuardrailStatusBannerProps) {
  const passRate = totalClaims > 0 ? Math.round((verifiedClaims / totalClaims) * 100) : 0;
  const isHealthy = passRate >= 80 && rejectedClaims === 0;
  const hasWarnings = rejectedClaims > 0 || passRate < 80;

  return (
    <div className={`rounded-lg border p-3 ${isHealthy ? 'bg-green-50 border-green-200' : hasWarnings ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isHealthy ? (
            <CheckCircle size={16} className="text-green-600" />
          ) : (
            <AlertCircle size={16} className="text-amber-600" />
          )}
          <span className={`text-xs font-semibold ${isHealthy ? 'text-green-800' : 'text-amber-800'}`}>
            AI Verification Status
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-600">
            {verifiedClaims}/{totalClaims} findings verified
          </span>
          {rejectedClaims > 0 && (
            <span className="text-[10px] text-red-600 font-medium">
              {rejectedClaims} blocked
            </span>
          )}
          <span className="text-[10px] text-gray-500">
            {overallConfidence}% avg confidence
          </span>
        </div>
      </div>
      {rejectedClaims > 0 && (
        <p className="text-[10px] text-amber-700 mt-1">
          {rejectedClaims} finding{rejectedClaims !== 1 ? 's' : ''} blocked by AI guardrails — unsubstantiated or unsourced assertions are never reported.
        </p>
      )}
    </div>
  );
}
