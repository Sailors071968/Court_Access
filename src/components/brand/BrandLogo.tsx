import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showTagline?: boolean;
  variant?: 'light' | 'dark';
  className?: string;
  linkTo?: string;
}

const sizeMap = {
  sm: { icon: 28, text: 'text-base', tagline: 'text-[7px]' },
  md: { icon: 34, text: 'text-lg', tagline: 'text-[8px]' },
  lg: { icon: 42, text: 'text-xl', tagline: 'text-[9px]' },
};

/** Classical courthouse columns mark — the CourtAccess emblem */
function ColumnsMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ca-gold-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f5c86e" />
          <stop offset="1" stopColor="#C8963E" />
        </linearGradient>
      </defs>
      {/* Pediment */}
      <path d="M20 4L34 12H6L20 4Z" fill="url(#ca-gold-grad)" />
      {/* Architrave */}
      <rect x="6" y="13.5" width="28" height="3" rx="1" fill="url(#ca-gold-grad)" />
      {/* Columns */}
      <rect x="9" y="18" width="3.2" height="13" rx="1" fill="url(#ca-gold-grad)" />
      <rect x="15.4" y="18" width="3.2" height="13" rx="1" fill="url(#ca-gold-grad)" />
      <rect x="21.4" y="18" width="3.2" height="13" rx="1" fill="url(#ca-gold-grad)" />
      <rect x="27.8" y="18" width="3.2" height="13" rx="1" fill="url(#ca-gold-grad)" />
      {/* Base */}
      <rect x="5" y="32.5" width="30" height="3.5" rx="1.2" fill="url(#ca-gold-grad)" />
    </svg>
  );
}

export function BrandLogo({
  size = 'md',
  showText = true,
  showTagline = true,
  variant = 'light',
  className,
  linkTo = '/',
}: BrandLogoProps) {
  const s = sizeMap[size];
  const content = (
    <div className={cn('flex items-center gap-2.5', className)}>
      <ColumnsMark size={s.icon} />
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              s.text,
              'font-bold tracking-tight',
              variant === 'light' ? 'text-white' : 'text-navy',
            )}
          >
            Court<span className="text-gold-light">Access</span>
          </span>
          {showTagline && (
            <span className={cn(s.tagline, 'font-semibold tracking-[0.28em] text-gold/70 mt-1')}>
              TRUTH · EVIDENCE · JUSTICE
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light rounded-lg"
      >
        {content}
      </Link>
    );
  }
  return content;
}
