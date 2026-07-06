import { cn } from '../../lib/utils';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassPanel({ children, className }: GlassPanelProps) {
  return (
    <div
      className={cn(
        'rounded-xl backdrop-blur-lg border border-white/10 bg-navy-600/50 text-white shadow-glass',
        className,
      )}
    >
      {children}
    </div>
  );
}
