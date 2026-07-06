import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

/** Loading indicator. Provide `label` for full-block loading state. */
export function Spinner({ size = 20, className, label }: SpinnerProps) {
  if (label) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center" role="status" aria-live="polite">
        <Loader2 size={size} className={cn('animate-spin text-gold-light mb-2', className)} />
        <p className="text-sm text-slate-400">{label}</p>
      </div>
    );
  }
  return <Loader2 size={size} className={cn('animate-spin text-gold-light', className)} role="status" aria-label="Loading" />;
}
