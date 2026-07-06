import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const cardVariants = cva('rounded-2xl transition-all duration-200', {
  variants: {
    variant: {
      default: 'bg-white border border-slate-200/80 shadow-card',
      elevated: 'bg-white border border-slate-200/60 shadow-elevated',
      glass: 'bg-navy-light/80 backdrop-blur-lg border border-white/10 text-white',
      glassLight: 'bg-white/80 backdrop-blur-md border border-white/60 shadow-card',
      highlight: 'bg-gold-muted/50 border border-gold/20 shadow-card',
      navy: 'bg-navy border border-white/5 text-white shadow-glass',
    },
    padding: {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    },
    interactive: {
      true: 'cursor-pointer hover:shadow-elevated hover:-translate-y-0.5',
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
      className={cn(
        cardVariants({ variant, padding, interactive: interactive || hover }),
        className,
      )}
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
        <h3 className="text-lg font-semibold text-navy">{title}</h3>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  icon,
  value,
  label,
  trend,
  highlight = false,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  trend?: string;
  highlight?: boolean;
  onClick?: () => void;
  className?: string;
}) {
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
      <div className="flex flex-col items-center text-center">
        <div className={cn('mb-3', highlight ? 'text-gold' : 'text-navy-muted')}>{icon}</div>
        <div className={cn('text-2xl font-bold', highlight ? 'text-gold-dark' : 'text-navy')}>{value}</div>
        <div className="text-sm text-slate-500 mt-1">{label}</div>
        {trend && <div className="text-xs text-emerald-600 mt-1 font-medium">{trend}</div>}
      </div>
    </Card>
  );
}
