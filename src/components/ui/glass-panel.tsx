import { cn } from '../../lib/utils';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'dark' | 'light';
}

export function GlassPanel({ children, className, variant = 'dark' }: GlassPanelProps) {
  return (
    <div
      className={cn(
        'rounded-2xl backdrop-blur-lg border',
        variant === 'dark'
          ? 'bg-navy-light/80 border-white/10 text-white shadow-glass'
          : 'bg-white/80 border-white/60 text-navy shadow-card',
        className,
      )}
    >
      {children}
    </div>
  );
}
