import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from '../ui/card';
import { cn } from '../../lib/utils';

interface ExpandableCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

/**
 * Card whose body expands/collapses (Program 20 — "every card should expand").
 * Reusable across every workspace.
 */
export function ExpandableCard({
  title,
  subtitle,
  icon,
  headerRight,
  children,
  defaultExpanded = true,
  className,
}: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <Card padding="none" className={cn('overflow-hidden', className)}>
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && <div className="text-gold-light flex-shrink-0">{icon}</div>}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {headerRight}
          <ChevronDown size={16} className={cn('text-slate-400 transition-transform duration-200', expanded && 'rotate-180')} />
        </div>
      </button>
      {expanded && <div className="px-5 pb-5 animate-fade-in">{children}</div>}
    </Card>
  );
}
