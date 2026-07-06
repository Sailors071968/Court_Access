import type { JSX } from 'react';
import { TYPOGRAPHY } from '../../constants/designTokens';
import { cn } from '../../lib/utils';

type TypographyVariant = keyof typeof TYPOGRAPHY;

const defaultElement: Record<TypographyVariant, keyof JSX.IntrinsicElements> = {
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  body: 'p',
  bodyLg: 'p',
  caption: 'p',
  overline: 'span',
};

interface TypographyProps {
  variant?: TypographyVariant;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  children: React.ReactNode;
}

export function Typography({ variant = 'body', as, className, children }: TypographyProps) {
  const Component = as ?? defaultElement[variant];
  return <Component className={cn(TYPOGRAPHY[variant], className)}>{children}</Component>;
}
