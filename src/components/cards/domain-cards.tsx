// =============================================================================
// CourtAccess — Domain Cards (Program 18)
// Progress, Timeline, Evidence, Document, Witness, Authority, Report cards.
// All share the ca-panel surface; all reusable across workspaces.
// =============================================================================

import { FileText, User, Landmark, Fingerprint, Clock, ArrowRight } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ProgressBar } from '../ui/progress';
import { ConfidenceIndicator, StatusBadge } from '../indicators/indicators';
import { cn } from '../../lib/utils';

// ── Progress card ────────────────────────────────────────────────────────────
export function ProgressCard({
  title,
  value,
  description,
  tone = 'gold',
  onClick,
  className,
}: {
  title: string;
  value: number;
  description?: string;
  tone?: 'gold' | 'emerald' | 'blue' | 'red' | 'violet';
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Card interactive={Boolean(onClick)} onClick={onClick} className={className}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-slate-300">{title}</h4>
        <span className="text-lg font-bold text-white tabular-nums">{value}%</span>
      </div>
      <ProgressBar value={value} tone={tone} />
      {description && <p className="text-xs text-slate-400 mt-2">{description}</p>}
    </Card>
  );
}

// ── Timeline card ────────────────────────────────────────────────────────────
export function TimelineCard({
  title,
  date,
  description,
  tag,
  onClick,
  className,
}: {
  title: string;
  date: string;
  description?: string;
  tag?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex gap-3 rounded-xl p-3 transition-colors',
        onClick && 'cursor-pointer hover:bg-white/5',
        className,
      )}
    >
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-lg ca-icon-blue text-blue-300 flex items-center justify-center flex-shrink-0">
          <Clock size={14} />
        </div>
        <div className="w-px flex-1 bg-white/10 mt-1" />
      </div>
      <div className="min-w-0 pb-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white truncate">{title}</p>
          {tag && <Badge variant="default">{tag}</Badge>}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{date}</p>
        {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
      </div>
    </div>
  );
}

// ── Evidence card ────────────────────────────────────────────────────────────
export function EvidenceCard({
  title,
  type,
  status,
  confidence,
  onClick,
  className,
}: {
  title: string;
  type: string;
  status?: string;
  confidence?: number;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Card interactive={Boolean(onClick)} onClick={onClick} padding="sm" className={className}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg ca-icon-gold text-gold-light flex items-center justify-center flex-shrink-0">
          <Fingerprint size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{type}</p>
          <div className="flex items-center gap-2 mt-2">
            {status && <StatusBadge status={status} />}
            {confidence !== undefined && <ConfidenceIndicator score={confidence} showLabel={false} />}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Document card ────────────────────────────────────────────────────────────
export function DocumentCard({
  title,
  meta,
  status,
  onClick,
  className,
}: {
  title: string;
  meta?: string;
  status?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Card interactive={Boolean(onClick)} onClick={onClick} padding="sm" className={className}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg ca-icon-blue text-blue-300 flex items-center justify-center flex-shrink-0">
          <FileText size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{title}</p>
          {meta && <p className="text-xs text-slate-400 mt-0.5">{meta}</p>}
        </div>
        {status && <StatusBadge status={status} />}
      </div>
    </Card>
  );
}

// ── Witness card ─────────────────────────────────────────────────────────────
export function WitnessCard({
  name,
  role,
  tag,
  onClick,
  className,
}: {
  name: string;
  role?: string;
  tag?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Card interactive={Boolean(onClick)} onClick={onClick} padding="sm" className={className}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg ca-icon-violet text-violet-300 flex items-center justify-center flex-shrink-0">
          <User size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{name}</p>
          {role && <p className="text-xs text-slate-400 mt-0.5">{role}</p>}
        </div>
        {tag && <Badge variant="default">{tag}</Badge>}
      </div>
    </Card>
  );
}

// ── Authority card ───────────────────────────────────────────────────────────
export function AuthorityCard({
  citation,
  title,
  relevance,
  onClick,
  className,
}: {
  citation: string;
  title?: string;
  relevance?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Card interactive={Boolean(onClick)} onClick={onClick} padding="sm" className={className}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg ca-icon-emerald text-emerald-300 flex items-center justify-center flex-shrink-0">
          <Landmark size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{citation}</p>
          {title && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{title}</p>}
          {relevance && <p className="text-xs text-slate-400 mt-1">{relevance}</p>}
        </div>
      </div>
    </Card>
  );
}

// ── Report card ──────────────────────────────────────────────────────────────
export function ReportCard({
  title,
  description,
  format,
  onGenerate,
  className,
}: {
  title: string;
  description?: string;
  format?: string;
  onGenerate?: () => void;
  className?: string;
}) {
  return (
    <Card interactive={Boolean(onGenerate)} onClick={onGenerate} className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl ca-icon-gold text-gold-light flex items-center justify-center flex-shrink-0">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{title}</p>
            {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
            {format && <Badge variant="gold" className="mt-2">{format}</Badge>}
          </div>
        </div>
        {onGenerate && <ArrowRight size={16} className="text-slate-400 flex-shrink-0 mt-1" />}
      </div>
    </Card>
  );
}
