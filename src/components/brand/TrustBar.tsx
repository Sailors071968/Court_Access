import { Scale, Search, Eye, RefreshCw, Briefcase, Shield } from 'lucide-react';
import { TRUST_MARKERS, CONSTITUTION_TAGLINE } from '../../constants/designTokens';
import { cn } from '../../lib/utils';

const MARKER_ICONS = [Scale, Search, Eye, RefreshCw, Briefcase, Shield];

interface TrustBarProps {
  className?: string;
  compact?: boolean;
}

/**
 * Global constitutional trust bar — appears at the base of every screen
 * (public and authenticated) to reinforce the engineering constitution.
 */
export function TrustBar({ className, compact = false }: TrustBarProps) {
  return (
    <div
      className={cn(
        'border-t border-white/5 bg-navy-900/80 backdrop-blur-sm',
        compact ? 'py-3' : 'py-4',
        className,
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {TRUST_MARKERS.map((marker, i) => {
              const Icon = MARKER_ICONS[i];
              return (
                <span key={marker} className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                  <Icon size={13} className="text-gold-light/80" />
                  {marker}
                </span>
              );
            })}
          </div>
          <p className="text-xs font-semibold tracking-wide text-gold-light/90 whitespace-nowrap">
            {CONSTITUTION_TAGLINE}
          </p>
        </div>
      </div>
    </div>
  );
}
