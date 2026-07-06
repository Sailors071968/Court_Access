import type { LucideIcon } from 'lucide-react';
import { Card } from '../../ui/card';
import { SPACING, TYPOGRAPHY } from '../../../constants/designTokens';
import { cn } from '../../../lib/utils';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  tile?: 'gold' | 'blue' | 'violet' | 'emerald';
  className?: string;
}

const TILE_CLASS = {
  gold: 'ca-icon-gold text-gold-light',
  blue: 'ca-icon-blue text-blue-300',
  violet: 'ca-icon-violet text-violet-300',
  emerald: 'ca-icon-emerald text-emerald-300',
};

export function FeatureCard({ icon: Icon, title, description, tile = 'gold', className }: FeatureCardProps) {
  return (
    <Card variant="default" padding="lg" interactive className={cn(className)}>
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mb-5', TILE_CLASS[tile])}>
        <Icon size={22} />
      </div>
      <h3 className={cn(TYPOGRAPHY.h4, 'mb-2')}>{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </Card>
  );
}

interface MarketingSectionProps {
  id?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  variant?: 'base' | 'muted';
  className?: string;
}

export function MarketingSection({
  id,
  title,
  subtitle,
  children,
  variant = 'base',
  className,
}: MarketingSectionProps) {
  return (
    <section
      id={id}
      className={cn(SPACING.section, variant === 'muted' ? 'bg-navy-900' : 'bg-navy-800', className)}
    >
      <div className={SPACING.container}>
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <h2 className={cn(TYPOGRAPHY.h2, 'mb-4')}>{title}</h2>
          {subtitle && <p className="text-lg text-slate-400">{subtitle}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
