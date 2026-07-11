// =============================================================================
// CourtAccess — Reusable Intelligence Panels (Program 8)
// =============================================================================

import { type LucideIcon, AlertTriangle, BarChart3, BookOpen, Brain, Clock, HelpCircle, Link2, Scale, Search, Shield, Users } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import type { IntelligencePanelType } from '../../constants/designTokens';

const PANEL_META: Record<
  IntelligencePanelType,
  { label: string; icon: LucideIcon; description: string }
> = {
  case_strength: { label: 'Case Strength', icon: Scale, description: 'Overall defense posture assessment' },
  evidence_confidence: { label: 'Evidence Confidence', icon: Shield, description: 'Reliability of extracted evidence' },
  repository_integrity: { label: 'Repository Integrity', icon: BarChart3, description: 'Chain of custody and completeness' },
  timeline: { label: 'Timeline', icon: Clock, description: 'Chronological case events' },
  contradictions: { label: 'Contradictions', icon: AlertTriangle, description: 'Conflicting statements and facts' },
  knowledge_graph: { label: 'Knowledge Graph', icon: Link2, description: 'Entity and relationship map' },
  authorities: { label: 'Authorities', icon: BookOpen, description: 'Statutes, case law, and jury instructions' },
  evidence_gaps: { label: 'Evidence Gaps', icon: Search, description: 'Missing or incomplete discovery' },
  unknowns: { label: 'Unknowns', icon: HelpCircle, description: 'Unresolved questions requiring review' },
  human_review: { label: 'Human Review', icon: Users, description: 'Items flagged for attorney review' },
  investigation_tasks: { label: 'Investigation Tasks', icon: Brain, description: 'Recommended next steps' },
};

export interface IntelligencePanelProps {
  type: IntelligencePanelType;
  value?: string | number;
  status?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  subtitle?: string;
  onClick?: () => void;
  compact?: boolean;
  className?: string;
}

const statusBadge = {
  success: 'success' as const,
  warning: 'warning' as const,
  danger: 'danger' as const,
  info: 'info' as const,
  neutral: 'default' as const,
};

export function IntelligencePanel({
  type,
  value,
  status = 'neutral',
  subtitle,
  onClick,
  compact = false,
  className,
}: IntelligencePanelProps) {
  const meta = PANEL_META[type];
  const Icon = meta.icon;

  return (
    <Card
      variant="default"
      padding={compact ? 'sm' : 'md'}
      interactive={Boolean(onClick)}
      onClick={onClick}
      className={cn('group', className)}
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl ca-icon-gold flex items-center justify-center flex-shrink-0 transition-colors">
          <Icon size={20} className="text-gold-light" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-white">{meta.label}</h4>
            {value !== undefined && (
              <span className="text-lg font-bold text-white tabular-nums">{value}</span>
            )}
          </div>
          {!compact && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{subtitle ?? meta.description}</p>
          )}
          {status !== 'neutral' && (
            <Badge variant={statusBadge[status]} className="mt-2">
              {status === 'danger' ? 'Attention' : status === 'warning' ? 'Review' : 'Active'}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

export function IntelligenceGrid({
  panels,
  columns = 3,
  className,
}: {
  panels: IntelligencePanelProps[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const colClass = { 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4' };
  return (
    <div className={cn('grid gap-4', colClass[columns], className)}>
      {panels.map((panel) => (
        <IntelligencePanel key={panel.type} {...panel} />
      ))}
    </div>
  );
}

export { PANEL_META };
