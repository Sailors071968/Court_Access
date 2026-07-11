import { cn } from '../../lib/utils';
import { TYPOGRAPHY } from '../../constants/designTokens';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  overline?: string;
  className?: string;
}

export function PageHeader({ title, subtitle, action, overline, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4', className)}>
      <div className="space-y-2">
        {overline && <p className={TYPOGRAPHY.overline}>{overline}</p>}
        <h1 className={TYPOGRAPHY.h1}>{title}</h1>
        {subtitle && <p className="text-base text-slate-300 leading-relaxed">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
