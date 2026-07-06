import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  variant?: 'light' | 'dark';
  className?: string;
  linkTo?: string;
}

const sizeMap = {
  sm: { icon: 'w-7 h-7', text: 'text-base', shield: 14 },
  md: { icon: 'w-9 h-9', text: 'text-lg', shield: 18 },
  lg: { icon: 'w-11 h-11', text: 'text-xl', shield: 22 },
};

export function BrandLogo({
  size = 'md',
  showText = true,
  variant = 'light',
  className,
  linkTo = '/',
}: BrandLogoProps) {
  const s = sizeMap[size];
  const content = (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          s.icon,
          'bg-gold-light rounded-xl flex items-center justify-center shadow-gold flex-shrink-0',
        )}
        aria-hidden="true"
      >
        <Shield className="text-navy" size={s.shield} />
      </div>
      {showText && (
        <span
          className={cn(
            s.text,
            'font-bold tracking-tight',
            variant === 'light' ? 'text-white' : 'text-navy',
          )}
        >
          CourtAccess
        </span>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-lg">
        {content}
      </Link>
    );
  }
  return content;
}
