// ============================================
// Court Access — Universal Status Badge Component
// ============================================

import { CheckCircle, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { EVIDENCE_STATUS_CONFIG, MOTION_PRIORITY_CONFIG, TASK_PRIORITY_CONFIG, AI_STATUS_CONFIG, EXPERT_RECOMMENDATION_CONFIG } from '../../constants';
import type { EvidenceStatus, MotionPriority, TaskPriority, AIAnalysisStatus, ExpertRecommendation } from '../../types';

interface EvidenceStatusBadgeProps {
  status: EvidenceStatus;
}

export function EvidenceStatusBadge({ status }: EvidenceStatusBadgeProps) {
  const config = EVIDENCE_STATUS_CONFIG[status];
  const IconMap = {
    'check-circle': CheckCircle,
    'x-circle': XCircle,
    'alert-triangle': AlertTriangle,
    'help-circle': HelpCircle,
  };
  const Icon = IconMap[config.icon as keyof typeof IconMap];

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.bgColor} ${config.textColor}`}>
      <Icon size={14} />
      {config.label}
    </span>
  );
}

interface PriorityBadgeProps {
  priority: MotionPriority;
}

export function MotionPriorityBadge({ priority }: PriorityBadgeProps) {
  const config = MOTION_PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded text-xs font-bold tracking-wide ${config.bgColor} ${config.textColor}`}>
      {config.label}
    </span>
  );
}

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
}

export function TaskPriorityBadge({ priority }: TaskPriorityBadgeProps) {
  const config = TASK_PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded text-xs font-bold tracking-wide ${config.bgColor} ${config.textColor}`}>
      {config.label}
    </span>
  );
}

interface AIStatusBadgeProps {
  status: AIAnalysisStatus;
}

export function AIStatusBadge({ status }: AIStatusBadgeProps) {
  const config = AI_STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
      {status === 'analyzing' && (
        <span className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full" />
      )}
      {status === 'analyzed' && <CheckCircle size={12} />}
      {config.label}
    </span>
  );
}

interface ExpertBadgeProps {
  recommendation: ExpertRecommendation;
}

export function ExpertRecommendationBadge({ recommendation }: ExpertBadgeProps) {
  const config = EXPERT_RECOMMENDATION_CONFIG[recommendation];
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${config.bgColor} ${config.textColor}`}>
      {config.label}
    </span>
  );
}

interface CaseStatusBadgeProps {
  status: string;
}

export function CaseStatusBadge({ status }: CaseStatusBadgeProps) {
  const config: Record<string, { label: string; bgColor: string; textColor: string; dotColor: string }> = {
    active: { label: 'Active', bgColor: 'bg-green-50', textColor: 'text-green-700', dotColor: 'bg-green-500' },
    closed: { label: 'Closed', bgColor: 'bg-white/10', textColor: 'text-slate-300', dotColor: 'bg-gray-400' },
    pending: { label: 'Pending', bgColor: 'bg-amber-50', textColor: 'text-amber-700', dotColor: 'bg-amber-500' },
    archived: { label: 'Archived', bgColor: 'bg-blue-50', textColor: 'text-blue-700', dotColor: 'bg-blue-500' },
  };
  const c = config[status] ?? { label: status, bgColor: 'bg-white/10', textColor: 'text-slate-300', dotColor: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${c.bgColor} ${c.textColor}`}>
      <span className={`w-2 h-2 rounded-full ${c.dotColor}`} />
      {c.label}
    </span>
  );
}
