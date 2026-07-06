import type { LucideIcon } from 'lucide-react';
import { Card } from '../../ui/card';
import { SPACING, TYPOGRAPHY } from '../../../constants/designTokens';
import { cn } from '../../../lib/utils';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({ icon: Icon, title, description, className }: FeatureCardProps) {
  return (
    <Card variant="default" padding="lg" className={cn('hover:shadow-elevated transition-shadow', className)}>
      <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center mb-5">
        <Icon className="text-gold-light" size={22} />
      </div>
      <h3 className={cn(TYPOGRAPHY.h4, 'mb-2')}>{title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
    </Card>
  );
}

interface MarketingSectionProps {
  id?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  variant?: 'white' | 'muted';
  className?: string;
}

export function MarketingSection({
  id,
  title,
  subtitle,
  children,
  variant = 'white',
  className,
}: MarketingSectionProps) {
  return (
    <section
      id={id}
      className={cn(SPACING.section, variant === 'muted' ? 'bg-surface-muted' : 'bg-white', className)}
    >
      <div className={SPACING.container}>
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className={cn(TYPOGRAPHY.h2, 'mb-4')}>{title}</h2>
          {subtitle && <p className="text-lg text-slate-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
