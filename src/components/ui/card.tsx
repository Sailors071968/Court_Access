import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { ICON_TILES, type IconTile } from '../../constants/designTokens';

const cardVariants = cva('rounded-xl transition-all duration-200', {
  variants: {
    variant: {
      default: 'ca-panel',
      elevated: 'ca-panel shadow-elevated',
      glass: 'bg-navy-600/60 backdrop-blur-lg border border-white/10 text-white',
      highlight: 'ca-panel border-gold/30',
      plain: 'bg-navy-600 border border-white/5',
    },
    padding: {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    },
    interactive: {
      true: 'ca-panel-hover cursor-pointer',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'default',
    padding: 'md',
    interactive: false,
  },
});

interface CardProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, interactive, hover, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, interactive: interactive || hover }), className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-5', className)}>
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  icon,
  value,
  label,
  sublabel,
  trend,
  tile = 'gold',
  highlight,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  sublabel?: string;
  trend?: string;
  tile?: IconTile;
  highlight?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const resolvedTile: IconTile = highlight ? 'gold' : tile;
  return (
    <Card
      variant={highlight ? 'highlight' : 'default'}
      padding="md"
      interactive={Boolean(onClick)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={className}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
    >
      <div className="flex items-start gap-4">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', ICON_TILES[resolvedTile])}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-white tabular-nums leading-tight">{value}</div>
          <div className="text-sm text-slate-400 mt-0.5">{label}</div>
          {sublabel && <div className="text-xs text-slate-500 mt-1">{sublabel}</div>}
          {trend && <div className="text-xs text-emerald-400 mt-1 font-medium">{trend}</div>}
        </div>
      </div>
    </Card>
  );
}
