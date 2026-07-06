// =============================================================================
// CourtAccess — Domain Indicators (Program 18)
// Confidence, risk, status, OCR, evidence, human review, unknown, citation.
// =============================================================================

import { AlertTriangle, HelpCircle, Quote, UserCheck, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

// ── Confidence indicator ─────────────────────────────────────────────────────
type ConfidenceLevel = 'high' | 'medium' | 'low';

function confidenceFromScore(score: number): ConfidenceLevel {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

const CONFIDENCE_META: Record<ConfidenceLevel, { label: string; dot: string; text: string }> = {
  high: { label: 'High Confidence', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  medium: { label: 'Medium Confidence', dot: 'bg-gold-light', text: 'text-gold-light' },
  low: { label: 'Low Confidence', dot: 'bg-orange-400', text: 'text-orange-400' },
};

export function ConfidenceIndicator({
  score,
  level,
  showLabel = true,
  className,
}: {
  score?: number;
  level?: ConfidenceLevel;
  showLabel?: boolean;
  className?: string;
}) {
  const resolved = level ?? confidenceFromScore(score ?? 0);
  const meta = CONFIDENCE_META[resolved];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', meta.text, className)}>
      <span className={cn('w-2 h-2 rounded-full', meta.dot)} />
      {showLabel ? meta.label : `${score ?? ''}%`}
    </span>
  );
}

// ── Risk indicator ───────────────────────────────────────────────────────────
type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

const RISK_META: Record<RiskLevel, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  low: { label: 'Low Risk', variant: 'success' },
  moderate: { label: 'Moderate Risk', variant: 'warning' },
  high: { label: 'High Risk', variant: 'danger' },
  critical: { label: 'Critical Risk', variant: 'danger' },
};

export function RiskIndicator({ level, className }: { level: RiskLevel; className?: string }) {
  const meta = RISK_META[level];
  return (
    <Badge variant={meta.variant} className={className}>
      <AlertTriangle size={11} className="mr-1" />
      {meta.label}
    </Badge>
  );
}

// ── Generic domain status badge ──────────────────────────────────────────────
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  satisfied: 'success',
  completed: 'success',
  analyzed: 'success',
  active: 'success',
  disputed: 'warning',
  in_progress: 'info',
  processing: 'info',
  open: 'info',
  pending: 'default',
  unsatisfied: 'danger',
  failed: 'danger',
  unknown: 'default',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? 'default'} className={className}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

// ── OCR status ───────────────────────────────────────────────────────────────
type OcrState = 'queued' | 'processing' | 'complete' | 'failed';

const OCR_META: Record<OcrState, { label: string; icon: typeof Clock; className: string }> = {
  queued: { label: 'OCR Queued', icon: Clock, className: 'text-slate-400' },
  processing: { label: 'Running OCR', icon: Loader2, className: 'text-blue-400' },
  complete: { label: 'OCR Complete', icon: CheckCircle2, className: 'text-emerald-400' },
  failed: { label: 'OCR Failed', icon: XCircle, className: 'text-red-400' },
};

export function OcrStatus({ state, progress, className }: { state: OcrState; progress?: number; className?: string }) {
  const meta = OCR_META[state];
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', meta.className, className)}>
      <Icon size={13} className={state === 'processing' ? 'animate-spin' : undefined} />
      {meta.label}
      {state === 'processing' && progress !== undefined && <span className="tabular-nums">{progress}%</span>}
    </span>
  );
}

// ── Evidence status ──────────────────────────────────────────────────────────
export function EvidenceStatus({ status, className }: { status: string; className?: string }) {
  return <StatusBadge status={status} className={className} />;
}

// ── Human review banner ──────────────────────────────────────────────────────
export function HumanReviewBanner({
  count,
  onReview,
  className,
}: {
  count: number;
  onReview?: () => void;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-xl border border-gold/25 bg-gold/10 px-4 py-3',
        className,
      )}
      role="status"
    >
      <div className="flex items-center gap-3">
        <UserCheck size={18} className="text-gold-light flex-shrink-0" />
        <p className="text-sm text-gold-light">
          <span className="font-semibold">{count}</span> item{count === 1 ? '' : 's'} require human review
        </p>
      </div>
      {onReview && (
        <button onClick={onReview} className="text-xs font-semibold text-gold-light hover:text-gold-bright underline underline-offset-2">
          Review now
        </button>
      )}
    </div>
  );
}

// ── Unknown indicator ────────────────────────────────────────────────────────
export function UnknownIndicator({ label = 'Unknown', className }: { label?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-slate-400', className)}>
      <HelpCircle size={13} />
      {label}
    </span>
  );
}

// ── Citation indicator ───────────────────────────────────────────────────────
export function CitationIndicator({
  source,
  onClick,
  className,
}: {
  source: string;
  onClick?: () => void;
  className?: string;
}) {
  const Comp = onClick ? 'button' : 'span';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300',
        onClick && 'hover:border-gold/30 hover:text-gold-light transition-colors cursor-pointer',
        className,
      )}
    >
      <Quote size={10} />
      {source}
    </Comp>
  );
}
