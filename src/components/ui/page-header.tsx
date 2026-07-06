import { cn } from '../../lib/utils';
import { TYPOGRAPHY } from '../../constants/designTokens';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  overline?: string;
  className?: string;
  dark?: boolean;
}

export function PageHeader({ title, subtitle, action, overline, className, dark = false }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4', className)}>
      <div className="space-y-2">
        {overline && (
          <p className={cn(TYPOGRAPHY.overline, dark && 'text-gold-light')}>{overline}</p>
        )}
        <h1 className={cn(TYPOGRAPHY.h1, dark && 'text-white')}>{title}</h1>
        {subtitle && (
          <p className={cn(TYPOGRAPHY.caption, 'text-base', dark ? 'text-slate-300' : 'text-slate-500')}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
