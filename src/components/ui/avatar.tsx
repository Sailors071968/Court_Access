// ============================================================================
// CourtAccess — Avatar (Master Collaboration System Program, Phase 4)
// Unified identity presentation: uploaded profile photo → firm/initials
// fallback. Used across collaborators, case teams, header, and lists.
// ============================================================================

import { cn } from '../../lib/utils';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<AvatarSize, string> = {
  xs: 'w-7 h-7 text-[11px]',
  sm: 'w-9 h-9 text-sm',
  md: 'w-11 h-11 text-base',
  lg: 'w-14 h-14 text-lg',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  online?: boolean;
  className?: string;
  /** Highlight the current user / owner with the gold gradient. */
  accent?: boolean;
}

export function Avatar({ name, src, size = 'sm', online, className, accent }: AvatarProps) {
  return (
    <span className={cn('relative inline-flex flex-shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn('rounded-xl object-cover ring-1 ring-white/10', SIZES[size])}
        />
      ) : (
        <span
          className={cn(
            'rounded-xl flex items-center justify-center font-semibold ring-1 ring-white/10',
            accent ? 'ca-gradient-gold text-navy' : 'bg-navy-600 text-slate-100',
            SIZES[size],
          )}
        >
          {initials(name)}
        </span>
      )}
      {online !== undefined && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-navy-800',
            online ? 'bg-emerald-400' : 'bg-slate-500',
          )}
        />
      )}
    </span>
  );
}
